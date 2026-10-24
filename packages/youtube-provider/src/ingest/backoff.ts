/**
 * Per-channel exponential backoff. Pure: caller persists the returned state.
 * A 404/410 (channel gone) parks the channel for `maxMs` instead of hammering it.
 */

export interface BackoffState {
  failures: number;
  nextAttemptAtMs: number;
}

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** Injected for deterministic tests. */
  rng?: () => number;
}

export type FailureKind = 'transient' | 'gone';

const DEFAULTS = { baseMs: 60_000, maxMs: 6 * 60 * 60_000 };

/** Next state after a failure at `nowMs`. Jitter is ±20%. */
export function nextBackoff(
  previous: BackoffState | undefined,
  nowMs: number,
  kind: FailureKind = 'transient',
  options: BackoffOptions = {},
): BackoffState {
  const baseMs = options.baseMs ?? DEFAULTS.baseMs;
  const maxMs = options.maxMs ?? DEFAULTS.maxMs;
  const rng = options.rng ?? Math.random;
  const failures = (previous?.failures ?? 0) + 1;
  if (kind === 'gone') return { failures, nextAttemptAtMs: nowMs + maxMs };
  const raw = Math.min(maxMs, baseMs * 2 ** (failures - 1));
  const jitter = 0.8 + rng() * 0.4;
  return { failures, nextAttemptAtMs: nowMs + Math.round(raw * jitter) };
}

/** True when the channel may be polled again. */
export function isReady(state: BackoffState | undefined, nowMs: number): boolean {
  return !state || nowMs >= state.nextAttemptAtMs;
}

/** Clear the backoff after a successful poll. */
export function resetBackoff(): BackoffState {
  return { failures: 0, nextAttemptAtMs: 0 };
}
