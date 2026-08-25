/**
 * @degenfeed/web — server-side feed preload helpers
 *
 * Used by the /feed layout (Server Component) to fetch initial feed data so
 * the SSR HTML embeds real posts instead of a blank feed. The embedded data
 * is rendered client-side immediately after hydration (no network round trip).
 *
 * Reliability rules (learned in production):
 *  - Inside the Docker network the API is reachable via the Docker DNS name
 *    `degenfeed-api:3001`. `host.docker.internal:3101` TIMES OUT from the web
 *    container (the api-server binds host loopback only), so it must never be
 *    used as an SSR base URL.
 *  - SSR must NEVER block on the API: the preload has a hard overall budget
 *    (SSR_PRELOAD_BUDGET_MS). If the API is cold/slow, the layout renders an
 *    empty shell and the client fetches normally — no 6s+ blank screen.
 */

import type { UnifiedPost } from '@degenfeed/types';

/** Per-request timeout — a single protocol must never stall the preload. */
/** Hard overall budget for the whole preload (all protocols in parallel). */
export const SSR_PRELOAD_BUDGET_MS = 1600;
/** Posts per protocol embedded in SSR. 5 protocols × 3 = up to 15 posts. */
const PER_PROTOCOL_LIMIT = 3;
/** Protocols queried for the initial SSR embed. */
const SSR_PROTOCOLS = ['nostr', 'farcaster', 'mastodon', 'bluesky', 'rss'] as const;

/**
 * Resolve the API base URL for SERVER-side fetches.
 *
 * Priority:
 *  1. API_PROXY_TARGET — set in Docker (http://degenfeed-api:3001)
 *  2. NEXT_PUBLIC_WORKER_URL / WORKER_URL — but only when it is NOT the
 *     host.docker.internal fallback (broken inside the web container)
 *  3. Docker DNS default http://degenfeed-api:3001
 */
export function resolveApiBase(): string {
  const explicit = process.env.API_PROXY_TARGET?.trim();
  if (explicit) return explicit;

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL?.trim() || process.env.WORKER_URL?.trim();
  if (
    workerUrl &&
    !workerUrl.includes('host.docker.internal') &&
    !workerUrl.includes('127.0.0.1')
  ) {
    return workerUrl;
  }

  return 'http://degenfeed-api:3001';
}

function mapItem(item: Record<string, unknown>, protocol: string): UnifiedPost {
  return {
    ...(item as unknown as UnifiedPost),
    protocol: (item.protocol as UnifiedPost['protocol']) || (protocol as UnifiedPost['protocol']),
  };
}

/**
 * Fetch initial feed data server-side for SSR embedding.
 *
 * Returns an array of UnifiedPost (possibly empty, possibly partial). Never
 * throws and never blocks longer than SSR_PRELOAD_BUDGET_MS — the caller can
 * render an empty shell and the client will fetch normally.
 */
export async function fetchInitialFeedData(): Promise<UnifiedPost[]> {
  const apiBase = resolveApiBase();
  const protocols = SSR_PROTOCOLS;

  const budgetController = new AbortController();
  const budgetTimer = setTimeout(() => budgetController.abort(), SSR_PRELOAD_BUDGET_MS);

  try {
    const results = await Promise.allSettled(
      protocols.map(async (p) => {
        const res = await fetch(`${apiBase}/api/feed/${p}?limit=${PER_PROTOCOL_LIMIT}`, {
          signal: budgetController.signal,
          // The API caches responses; let Next.js reuse the last preload for
          // 30s so repeat SSR hits don't re-fetch the API for every visitor.
          cache: 'force-cache',
          next: { revalidate: 30 },
        });
        if (!res.ok) return [] as UnifiedPost[];
        const json = (await res.json()) as { data?: Record<string, unknown>[] };
        return (json.data || []).map((item) => mapItem(item, p));
      }),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<UnifiedPost[]> =>
          r.status === 'fulfilled' && Array.isArray(r.value),
      )
      .flatMap((r) => r.value)
      .slice(0, 15);
  } catch {
    // Aborted by budget or network error — return empty, never block SSR.
    return [];
  } finally {
    clearTimeout(budgetTimer);
  }
}
