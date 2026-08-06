/**
 * @degenfeed/web — protocolPreference
 *
 * Persists the last-selected protocol feed so the protocol switcher can
 * surface a "recently viewed" shortcut and restore context between visits.
 *
 * Storage: localStorage key `df_last_protocol` (guarded, SSR-safe).
 */

const KEY = 'df_last_protocol';

export function getLastProtocol(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw && raw.length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export function setLastProtocol(protocolId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, protocolId);
  } catch {
    // storage disabled (private mode) — non-critical
  }
}

export function clearLastProtocol(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
