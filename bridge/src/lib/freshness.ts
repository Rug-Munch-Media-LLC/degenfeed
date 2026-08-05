/**
 * Shared content-freshness policy for ALL bridge providers.
 *
 * The RSS provider ships its own freshness policy (FEED_MAX_AGE_HOURS +
 * friends in rss.ts, exercised by rss-freshness-bias.test.ts). This module
 * is the provider-agnostic counterpart: every other provider filters its
 * fetch pipeline through `filterFreshPosts` so the master feed never shows
 * stale content, regardless of which protocol it came from.
 *
 * Config:
 *   FEED_MAX_AGE_HOURS  — posts older than this are discarded (default 48h).
 *                         0 disables the filter.
 */

export const FEED_MAX_AGE_HOURS = (() => {
  try {
    const raw = process.env.FEED_MAX_AGE_HOURS;
    if (raw !== undefined) {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    /* fall through to default */
  }
  return 48;
})();

/** True when a post's createdAt is inside the max-age window (48h default). */
export function isFreshEnough(createdAt: number, now = Date.now()): boolean {
  if (FEED_MAX_AGE_HOURS <= 0) return true;
  return now - createdAt <= FEED_MAX_AGE_HOURS * 3_600_000;
}

/**
 * Filter an array of posts (or any object with a `createdAt` ms timestamp)
 * to only those inside the max-age window. Idempotent — safe to run over
 * posts that already passed a freshness check.
 */
export function filterFreshPosts<T extends { createdAt: number }>(
  posts: readonly T[],
  now = Date.now(),
): T[] {
  if (FEED_MAX_AGE_HOURS <= 0) return [...posts];
  return posts.filter((p) => isFreshEnough(p.createdAt, now));
}
