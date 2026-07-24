/**
 * Rate limiter and failure tracker for cross-poster
 */

// ─── Rate Limiter ───────────────────────────────────────────────────────

export class RateLimiter {
  private windows = new Map<string, number[]>();

  /** Check if an action is allowed for a given key */
  allow(key: string, maxPosts: number, windowMs: number): boolean {
    const now = Date.now();
    let timestamps = this.windows.get(key);

    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Prune old entries
    const cutoff = now - windowMs;
    const active = timestamps.filter((t) => t > cutoff);
    this.windows.set(key, active);

    if (active.length >= maxPosts) return false;

    active.push(now);
    return true;
  }

  /** Get remaining capacity for a key */
  remaining(key: string, maxPosts: number, windowMs: number): number {
    const now = Date.now();
    const timestamps = this.windows.get(key) || [];
    const cutoff = now - windowMs;
    const active = timestamps.filter((t) => t > cutoff);
    return Math.max(0, maxPosts - active.length);
  }

  /** Reset rate limiter for a key */
  reset(key: string): void {
    this.windows.delete(key);
  }
}

// ─── Failure Tracker ────────────────────────────────────────────────────

export interface FailureRecord {
  consecutiveFailures: number;
  lastError: string | null;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  backoffUntil: number | null;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
}

export class FailureTracker {
  private records = new Map<string, FailureRecord>();

  /** Record a successful attempt */
  recordSuccess(pairId: string, target: string): void {
    const key = `${pairId}:${target}`;
    const record = this.getOrCreate(key);
    record.consecutiveFailures = 0;
    record.lastSuccessAt = Date.now();
    record.lastAttemptAt = Date.now();
    record.totalAttempts++;
    record.totalSuccesses++;
    record.backoffUntil = null;
  }

  /** Record a failed attempt */
  recordFailure(pairId: string, target: string, error: string): void {
    const key = `${pairId}:${target}`;
    const record = this.getOrCreate(key);
    record.consecutiveFailures++;
    record.lastError = error;
    record.lastAttemptAt = Date.now();
    record.totalAttempts++;
    record.totalFailures++;

    // Exponential backoff: 30s, 1m, 2m, 4m, 8m, 16m, 32m, 1h
    const backoffMs = Math.min(
      30_000 * 2 ** (record.consecutiveFailures - 1),
      3_600_000, // max 1 hour
    );
    record.backoffUntil = Date.now() + backoffMs;
  }

  /** Check if we should attempt (not in backoff) */
  shouldAttempt(pairId: string, target: string): boolean {
    const key = `${pairId}:${target}`;
    const record = this.records.get(key);
    if (!record) return true;
    if (!record.backoffUntil) return true;
    return Date.now() >= record.backoffUntil;
  }

  /** Get stats for a pair */
  getStats(pairId: string, target: string): FailureRecord | null {
    return this.records.get(`${pairId}:${target}`) || null;
  }

  /** Get combined stats for a pair across all targets */
  getPairStats(pairId: string): {
    totalAttempts: number;
    totalSuccesses: number;
    totalFailures: number;
    lastAttemptAt: number | null;
    lastSuccessAt: number | null;
    lastError: string | null;
    consecutiveFailures: number;
  } {
    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let lastAttemptAt: number | null = null;
    let lastSuccessAt: number | null = null;
    let lastError: string | null = null;
    let consecutiveFailures = 0;

    for (const [key, record] of this.records) {
      if (key.startsWith(`${pairId}:`)) {
        totalAttempts += record.totalAttempts;
        totalSuccesses += record.totalSuccesses;
        totalFailures += record.totalFailures;
        if (record.lastAttemptAt && (!lastAttemptAt || record.lastAttemptAt > lastAttemptAt))
          lastAttemptAt = record.lastAttemptAt;
        if (record.lastSuccessAt && (!lastSuccessAt || record.lastSuccessAt > lastSuccessAt))
          lastSuccessAt = record.lastSuccessAt;
        if (record.lastError) lastError = record.lastError;
        consecutiveFailures = Math.max(consecutiveFailures, record.consecutiveFailures);
      }
    }

    return {
      totalAttempts,
      totalSuccesses,
      totalFailures,
      lastAttemptAt,
      lastSuccessAt,
      lastError,
      consecutiveFailures,
    };
  }

  private getOrCreate(key: string): FailureRecord {
    let record = this.records.get(key);
    if (!record) {
      record = {
        consecutiveFailures: 0,
        lastError: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        backoffUntil: null,
        totalAttempts: 0,
        totalSuccesses: 0,
        totalFailures: 0,
      };
      this.records.set(key, record);
    }
    return record;
  }
}
