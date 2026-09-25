// WebSocket service for real-time communication with backend

const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL;

type MessageHandler = (data: any) => void;
type ErrorHandler = (error: Event) => void;

// crypto.randomUUID needs a secure context; fall back for http/dev so a turn is
// never sent without the id the stateful controller requires.
function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// 'connected' means open AND authenticated — the only state in which a message
// actually reaches the backend. Everything else is surfaced to the UI so a
// stalled turn never looks like the persona is silently thinking.
export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';
type StateHandler = (state: ConnectionState, info: { queued: number }) => void;

interface QueuedMessage {
  event: string;
  data: any;
  method: string;
  queuedAt: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private errorHandlers: ErrorHandler[] = [];
  private stateHandlers: StateHandler[] = [];
  private isAuthenticated = false;
  private state: ConnectionState = 'offline';

  // Reconnection is unbounded on purpose. A simulation tab is open for 30+
  // minutes; a network blip longer than a few retries used to kill the socket
  // permanently and every later turn was queued into a dead connection, which
  // the user experienced as the persona hanging until they reloaded.
  private shouldReconnect = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectPromise: Promise<void> | null = null;

  private messageQueue: QueuedMessage[] = [];
  private queueWatchdog: ReturnType<typeof setInterval> | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPongAt = 0;
  // Cloudflare cuts idle WS at 100s; LLM routing can take 60-90s mid-turn.
  private static readonly HEARTBEAT_INTERVAL_MS = 30_000;
  // A socket the peer has dropped stays readyState===OPEN in the browser until
  // something forces a write error, so pings kept "succeeding" into a dead
  // connection and every turn after it vanished. Two unanswered pings mean the
  // socket is gone regardless of what readyState claims.
  private static readonly PONG_TIMEOUT_MS = 75_000;
  private static readonly RECONNECT_BASE_MS = 1_000;
  private static readonly RECONNECT_MAX_MS = 30_000;
  private static readonly AUTH_TIMEOUT_MS = 10_000;
  // A turn stuck in the queue this long is reported to the user rather than
  // left to look like a slow reply.
  private static readonly QUEUE_STUCK_MS = 20_000;
  private static readonly MAX_QUEUE = 50;

  constructor() {
    if (typeof window !== 'undefined') {
      // A tab restored from background/sleep keeps a socket the OS already
      // dropped; both events force an immediate liveness re-check.
      window.addEventListener('online', () => this.ensureConnected());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.ensureConnected();
      });
    }
  }

  // ─── state ────────────────────────────────────────────────────────────────

  onStateChange(handler: StateHandler): () => void {
    this.stateHandlers.push(handler);
    return () => {
      const i = this.stateHandlers.indexOf(handler);
      if (i > -1) this.stateHandlers.splice(i, 1);
    };
  }

  private setState(next: ConnectionState) {
    if (this.state === next) return;
    this.state = next;
    const info = { queued: this.messageQueue.length };
    this.stateHandlers.forEach(h => {
      try {
        h(next, info);
      } catch (e) {
        console.error('State handler failed:', e);
      }
    });
  }

  getState(): ConnectionState {
    return this.state;
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────

  connect(token?: string): Promise<void> {
    // Idempotent: callers do `if (!isConnected()) connect()`, and onclose
    // schedules its own reconnect. Without this guard those two races produced
    // several live sockets for one tab, each re-authenticating and each
    // receiving a copy of every reply.
    if (this.connectPromise) return this.connectPromise;
    if (this.isConnected()) return Promise.resolve();

    this.shouldReconnect = true;
    const authToken = token ?? localStorage.getItem('auth_token') ?? undefined;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      try {
        this.teardownSocket();
        this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

        const ws = new WebSocket(`${WS_BASE_URL}/ws`);
        this.ws = ws;

        ws.onopen = () => {
          this.startHeartbeat();
          if (!authToken) {
            this.setState('connected');
            this.reconnectAttempts = 0;
            resolve();
            return;
          }
          this.authenticate(authToken)
            .then(() => resolve())
            .catch(err => {
              // A socket that is open but unauthenticated silently 401s every
              // send. Drop it and let the backoff bring up a clean one.
              console.error('WebSocket auth failed:', err);
              try {
                ws.close();
              } catch {
                /* already closing — onclose still schedules the retry */
              }
              reject(err);
            });
        };

        ws.onmessage = event => {
          try {
            this.handleMessage(JSON.parse(event.data));
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = error => {
          this.errorHandlers.forEach(handler => handler(error));
          reject(error);
        };

        ws.onclose = event => {
          console.log('WebSocket disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          this.isAuthenticated = false;
          this.stopHeartbeat();
          if (this.ws === ws) this.ws = null;
          this.connectPromise = null;
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          } else {
            this.setState('offline');
          }
          reject(new Error(`WebSocket closed (${event.code})`));
        };
      } catch (error) {
        this.connectPromise = null;
        reject(error);
      }
    });

    // The promise is only a handle for the initial caller; reconnection owns
    // liveness from here, so a rejection must not become an unhandled one.
    this.connectPromise.catch(() => undefined).finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private teardownSocket() {
    if (!this.ws) return;
    const old = this.ws;
    this.ws = null;
    old.onopen = null;
    old.onmessage = null;
    old.onerror = null;
    old.onclose = null;
    try {
      old.close();
    } catch {
      /* nothing to close */
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldReconnect) return;

    this.setState('reconnecting');
    const exp = Math.min(
      WebSocketService.RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      WebSocketService.RECONNECT_MAX_MS
    );
    // Jitter keeps every open tab from retrying on the same tick after an
    // outage.
    const delay = exp / 2 + Math.random() * (exp / 2);
    this.reconnectAttempts++;
    console.log(`Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        // onclose/onerror already scheduled the next attempt.
      });
    }, delay);
  }

  private ensureConnected() {
    if (!this.shouldReconnect || this.isConnected() || this.connectPromise) return;
    // Come back immediately rather than waiting out a long backoff.
    this.reconnectAttempts = 0;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.connect().catch(() => undefined);
  }

  private authenticate(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const handler = (data: any) => {
        if (settled) return;
        settled = true;
        this.off('/auth/token', handler);
        clearTimeout(timer);

        if (data?.user) {
          this.isAuthenticated = true;
          // Reset only after a *usable* connection, not on socket open — an
          // open socket that fails auth would otherwise reset the backoff and
          // spin.
          this.reconnectAttempts = 0;
          this.setState('connected');
          this.flushMessageQueue();
          resolve();
        } else {
          this.isAuthenticated = false;
          reject(new Error('Authentication failed'));
        }
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.off('/auth/token', handler);
        reject(new Error('Authentication timeout'));
      }, WebSocketService.AUTH_TIMEOUT_MS);

      this.on('/auth/token', handler);
      this.sendRaw('/auth/token', { token });
    });
  }

  // ─── queue ────────────────────────────────────────────────────────────────

  private startQueueWatchdog() {
    if (this.queueWatchdog) return;
    this.queueWatchdog = setInterval(() => {
      if (this.messageQueue.length === 0) {
        this.stopQueueWatchdog();
        return;
      }
      const oldest = this.messageQueue[0];
      if (Date.now() - oldest.queuedAt > WebSocketService.QUEUE_STUCK_MS) {
        // Tell the UI the turn never left the browser. Previously this state
        // was indistinguishable from "the persona is thinking".
        this.setState('reconnecting');
        console.warn(
          `⚠️ ${this.messageQueue.length} message(s) stuck in queue for ` +
            `${Math.round((Date.now() - oldest.queuedAt) / 1000)}s`
        );
      }
    }, 5_000);
  }

  private stopQueueWatchdog() {
    if (this.queueWatchdog) {
      clearInterval(this.queueWatchdog);
      this.queueWatchdog = null;
    }
  }

  private enqueue(event: string, data: any, method: string) {
    if (this.messageQueue.length >= WebSocketService.MAX_QUEUE) {
      throw new Error(
        `WebSocket queue overflow (${WebSocketService.MAX_QUEUE}); dropping ${event}`
      );
    }
    this.messageQueue.push({ event, data, method, queuedAt: Date.now() });
    this.startQueueWatchdog();
    this.ensureConnected();
  }

  private flushMessageQueue() {
    if (this.messageQueue.length === 0) return;

    const messages = [...this.messageQueue];
    this.messageQueue = [];
    this.stopQueueWatchdog();
    console.log(`📤 Flushing ${messages.length} queued message(s)`);

    for (const message of messages) {
      // Re-queues itself if the socket died again between flush and write.
      this.send(message.event, message.data, message.method);
    }
  }

  // ─── messaging ────────────────────────────────────────────────────────────

  private sendRaw(event: string, data: any, method: string = 'POST') {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send ${event}: socket not open`);
    }
    this.ws.send(JSON.stringify({ event, method, data }));
  }

  send(event: string, data: any, method: string = 'POST') {
    if (!this.isConnected()) {
      console.warn('⚠️ WebSocket not ready, queueing message:', event);
      this.enqueue(event, data, method);
      return;
    }

    try {
      this.sendRaw(event, data, method);
    } catch (error) {
      console.warn('⚠️ Send failed, queueing message:', event, error);
      this.enqueue(event, data, method);
    }
  }

  private handleMessage(message: any) {
    const { event, data, success, error } = message;

    if (!success && error) {
      console.error('WebSocket error response:', error);
      const handlers = this.messageHandlers.get(event);
      if (handlers) handlers.forEach(handler => handler({ error, success: false }));
      return;
    }

    if (event === '/pong') {
      this.lastPongAt = Date.now();
      return;
    }

    const handlers = this.messageHandlers.get(event);
    if (handlers) handlers.forEach(handler => handler(data));

    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) wildcardHandlers.forEach(handler => handler({ event, data }));
  }

  on(event: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(event)) this.messageHandlers.set(event, []);
    this.messageHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(event);
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.push(handler);
  }

  sendSimulationMessage(caseId: string, payload: {
    type: 'text_message' | 'audio_message' | 'non_verbal' | 'end_simulation';
    simulation_id?: string;  // Can be UUID string or numeric string
    content?: string;
    audio_data?: string;
    file_name?: string;
    format?: string;
    action?: string;
    lang?: string;
    recording_completed?: boolean;
    request_id?: string;
  }) {
    // Per-turn idempotency key. The stateful persona controller applies a turn
    // exactly once by request_id, so a queued turn re-sent on reconnect
    // (flushMessageQueue re-emits the same data object) carries the same id and
    // is de-duped instead of producing a second reply. Legacy personas ignore it.
    const withRequestId = { ...payload, request_id: payload.request_id ?? newRequestId() };
    this.send(`/simulation/chat/${caseId}`, withRequestId);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPongAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;

      if (Date.now() - this.lastPongAt > WebSocketService.PONG_TIMEOUT_MS) {
        console.warn('⚠️ No pong within timeout — treating socket as dead');
        // close() fires onclose, which reconnects and flushes the queue.
        this.ws.close();
        return;
      }

      try {
        this.sendRaw('/ping', {});
      } catch {
        // onclose drives the reconnect.
      }
    }, WebSocketService.HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect() {
    // Must come first: the close below fires onclose, which would otherwise
    // resurrect the socket this call is tearing down — and the revived one had
    // no handlers left, so replies vanished.
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    this.stopQueueWatchdog();
    this.teardownSocket();
    this.connectPromise = null;
    this.isAuthenticated = false;
    this.messageQueue = [];
    this.messageHandlers.clear();
    this.errorHandlers = [];
    this.setState('offline');
  }

  // Open alone is not enough: an unauthenticated socket accepts writes and the
  // backend answers 401, losing the turn.
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
}

// Singleton instance
export const wsService = new WebSocketService();
