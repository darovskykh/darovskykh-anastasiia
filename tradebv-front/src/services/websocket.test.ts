import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketService } from './websocket';

// Minimal stand-in for the browser WebSocket: every instance is recorded so a
// test can drive open/close/message exactly like a flaky network would.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  static CLOSED = 3;

  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onclose: ((e: { code: number; reason: string; wasClean: boolean }) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    if (this.readyState !== FakeWebSocket.OPEN) throw new Error('not open');
    this.sent.push(data);
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code: 1006, reason: 'test', wasClean: false });
  }

  /** Server accepts the connection. */
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  /** Server answers the auth frame. */
  ackAuth() {
    this.onmessage?.({
      data: JSON.stringify({
        event: '/auth/token',
        success: true,
        data: { user: { id: 'u1' } },
      }),
    });
  }

  /** Server answers a heartbeat. */
  pong() {
    this.onmessage?.({ data: JSON.stringify({ event: '/pong', success: true, data: null }) });
  }

  events(): string[] {
    return this.sent.map(s => JSON.parse(s).event);
  }
}

const flush = () => new Promise(resolve => setImmediate(resolve));

/** Bring a service to the fully-usable (open + authenticated) state. */
async function connectAndAuth(svc: WebSocketService) {
  const promise = svc.connect('tok');
  await flush();
  const ws = FakeWebSocket.instances.at(-1)!;
  ws.open();
  await flush();
  ws.ackAuth();
  await promise;
  return ws;
}

describe('WebSocketService', () => {
  let svc: WebSocketService;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('localStorage', {
      getItem: () => 'tok',
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    svc = new WebSocketService();
  });

  afterEach(() => {
    svc.disconnect();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is not "connected" until authenticated', async () => {
    const promise = svc.connect('tok');
    await flush();
    const ws = FakeWebSocket.instances.at(-1)!;

    ws.open();
    await flush();
    // Socket is OPEN here. Treating that as connected is what let turns be
    // written to an unauthenticated socket, which the backend 401s and drops.
    expect(svc.isConnected()).toBe(false);

    ws.ackAuth();
    await promise;
    expect(svc.isConnected()).toBe(true);
    expect(svc.getState()).toBe('connected');
  });

  it('keeps reconnecting past the old 5-attempt ceiling', async () => {
    await connectAndAuth(svc);
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Fail every subsequent attempt: the socket closes without ever opening.
    for (let i = 0; i < 8; i++) {
      FakeWebSocket.instances.at(-1)!.close();
      await flush();
      await vi.advanceTimersByTimeAsync(60_000);
      await flush();
    }

    // The old client gave up permanently after 5 tries (~15s of backoff) and
    // the chat stayed dead until a page reload.
    expect(FakeWebSocket.instances.length).toBeGreaterThan(6);
    expect(svc.getState()).toBe('reconnecting');
  });

  it('caps reconnect backoff at 30s', async () => {
    await connectAndAuth(svc);
    for (let i = 0; i < 12; i++) {
      FakeWebSocket.instances.at(-1)!.close();
      await flush();
      await vi.advanceTimersByTimeAsync(60_000);
      await flush();
    }
    const before = FakeWebSocket.instances.length;
    FakeWebSocket.instances.at(-1)!.close();
    await flush();
    await vi.advanceTimersByTimeAsync(31_000);
    await flush();
    expect(FakeWebSocket.instances.length).toBeGreaterThan(before);
  });

  it('delivers a turn sent while the socket is down once it comes back', async () => {
    await connectAndAuth(svc);

    FakeWebSocket.instances.at(-1)!.close();
    await flush();

    // The user hits send during the outage.
    svc.sendSimulationMessage('case-1', { type: 'text_message', content: 'hi' });
    expect(svc.getState()).not.toBe('connected');

    await vi.advanceTimersByTimeAsync(2_000);
    await flush();
    const revived = FakeWebSocket.instances.at(-1)!;
    revived.open();
    await flush();
    revived.ackAuth();
    await flush();

    // Previously this sat in the queue forever, because the queue only flushed
    // on auth and reconnection had already been abandoned.
    expect(revived.events()).toContain('/simulation/chat/case-1');
    expect(svc.isConnected()).toBe(true);
  });

  it('replaces a socket whose peer stopped answering pings', async () => {
    const dead = await connectAndAuth(svc);
    const count = FakeWebSocket.instances.length;

    // The peer is gone but never sent a close frame, so readyState stays OPEN
    // and every write lands in a void — this is the state a user experiences
    // as the persona typing forever.
    await vi.advanceTimersByTimeAsync(95_000);
    await flush();

    expect(dead.readyState).toBe(FakeWebSocket.CLOSED);
    expect(FakeWebSocket.instances.length).toBeGreaterThan(count);
    expect(svc.isConnected()).toBe(false);
  });

  it('keeps a socket alive as long as pongs come back', async () => {
    const ws = await connectAndAuth(svc);
    const count = FakeWebSocket.instances.length;

    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(30_000);
      await flush();
      ws.pong();
    }

    expect(ws.readyState).toBe(FakeWebSocket.OPEN);
    expect(FakeWebSocket.instances).toHaveLength(count);
    expect(svc.isConnected()).toBe(true);
  });

  it('does not resurrect the socket after an explicit disconnect', async () => {
    await connectAndAuth(svc);
    const count = FakeWebSocket.instances.length;

    svc.disconnect();
    await vi.advanceTimersByTimeAsync(60_000);
    await flush();

    // disconnect() -> close() -> onclose used to schedule a reconnect, leaving
    // a zombie socket that re-authenticated forever with no handlers attached.
    expect(FakeWebSocket.instances).toHaveLength(count);
    expect(svc.getState()).toBe('offline');
  });

  it('does not open a second socket when connect races a reconnect', async () => {
    await connectAndAuth(svc);
    const count = FakeWebSocket.instances.length;

    // Page code calls connect() while the service is already live.
    await svc.connect('tok');
    await svc.connect('tok');
    await flush();

    expect(FakeWebSocket.instances).toHaveLength(count);
  });

  it('routes a reply to the handler after a reconnect', async () => {
    const seen: any[] = [];
    svc.on('/simulation/chat/case-1', d => seen.push(d));
    await connectAndAuth(svc);

    FakeWebSocket.instances.at(-1)!.close();
    await flush();
    await vi.advanceTimersByTimeAsync(2_000);
    await flush();
    const revived = FakeWebSocket.instances.at(-1)!;
    revived.open();
    await flush();
    revived.ackAuth();
    await flush();

    revived.onmessage?.({
      data: JSON.stringify({
        event: '/simulation/chat/case-1',
        success: true,
        data: { type: 'ai_response', message: 'hello' },
      }),
    });

    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe('hello');
  });
});
