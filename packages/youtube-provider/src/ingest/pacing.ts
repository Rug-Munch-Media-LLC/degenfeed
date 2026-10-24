/** Global request pacing: a monotonic token bucket shared by one worker. */

export interface TokenBucketOptions {
  capacity: number;
  refillPerSecond: number;
}

export interface TokenBucket {
  /** Tokens currently available at `nowMs`. */
  available(nowMs: number): number;
  /** Consume one token if possible; false means "wait". */
  tryTake(nowMs: number): boolean;
}

export function createTokenBucket(options: TokenBucketOptions): TokenBucket {
  const { capacity, refillPerSecond } = options;
  let tokens = capacity;
  let lastMs = 0;

  const refill = (nowMs: number): void => {
    if (lastMs === 0) {
      lastMs = nowMs;
      return;
    }
    const elapsed = Math.max(0, nowMs - lastMs);
    tokens = Math.min(capacity, tokens + (elapsed / 1000) * refillPerSecond);
    lastMs = nowMs;
  };

  return {
    available(nowMs) {
      refill(nowMs);
      return tokens;
    },
    tryTake(nowMs) {
      refill(nowMs);
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    },
  };
}
