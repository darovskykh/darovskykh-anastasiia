/**
 * Универсальное логирование событий на бэкенд.
 */
import { apiClient } from './api';

export interface EventLogPayload {
  event_type: string;
  browser?: string;
  payload?: Record<string, unknown>;
  error?: string;
}

/**
 * Отправить событие на бэк. Не блокирует UI.
 */
export function logEvent(
  eventType: string,
  payload: Record<string, unknown> = {},
  error?: string
): void {
  const body: EventLogPayload = {
    event_type: eventType,
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    payload: Object.keys(payload).length ? payload : undefined,
    error: error ?? undefined,
  };

  apiClient
    .post<{ event: string; data?: { ok: boolean } }>('/events', body)
    .catch(() => {});
}
