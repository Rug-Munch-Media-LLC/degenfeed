// Re-export from the source location

export type { RateLimitConfig } from '../src/rate-limiter.js';
export { checkRateLimit, remaining, resetAll, resetLimit } from '../src/rate-limiter.js';
