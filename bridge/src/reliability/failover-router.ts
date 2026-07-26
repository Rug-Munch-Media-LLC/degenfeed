/**
 * Failover Router — Routes to alternate providers when primary fails.
 * Maintains a fallback cache for serving stale data during outages.
 */

import type { UnifiedPost } from '../server/types';

export interface FailoverResult {
  status: 'live' | 'fallback' | 'cached';
  posts: UnifiedPost[];
  source?: string;
  cacheAgeMs?: number;
}

interface FailoverStrategy {
  primary: string;
  fallbacks: string[];
  cacheTTL: number;
}

class FailoverRouter {
  private strategies = new Map<string, FailoverStrategy>();

  register(protocol: string, fallbacks: string[], cacheTTL = 300000): void {
    this.strategies.set(protocol, { primary: protocol, fallbacks, cacheTTL });
  }

  hasStrategy(protocol: string): boolean {
    return this.strategies.has(protocol);
  }

  /**
   * Execute the failover chain for a protocol.
   *
   * 1. Tries the primary provider's fallback list
   * 2. Each fallback is resolved by importing its module dynamically
   * 3. Returns the first fallback that returns posts
   * 4. If all fallbacks fail, returns empty
   */
  async execute(protocol: string, limit: number): Promise<FailoverResult> {
    const strategy = this.strategies.get(protocol);
    if (!strategy || strategy.fallbacks.length === 0) {
      return { status: 'cached', posts: [], cacheAgeMs: 0 };
    }

    for (const fallback of strategy.fallbacks) {
      try {
        const posts = await tryFallbackProvider(fallback, limit);
        if (posts.length > 0) {
          return {
            status: 'fallback',
            posts,
            source: fallback,
          };
        }
      } catch {
        // Fallback failed, try next
      }
    }

    // Check in-memory fallback cache as last resort
    const cached = _fallbackCache.get(protocol);
    if (cached) {
      return {
        status: 'cached',
        posts: cached.posts.slice(0, limit),
        source: protocol,
        cacheAgeMs: Date.now() - cached.fetchedAt,
      };
    }

    return { status: 'cached', posts: [], cacheAgeMs: 0 };
  }
}

/**
 * In-memory fallback cache keyed by protocol -> { posts, timestamp }.
 */
export interface FallbackCacheEntry {
  posts: UnifiedPost[];
  fetchedAt: number;
}

class FallbackCache {
  private cache = new Map<string, FallbackCacheEntry>();
  private maxAge = 300000; // 5 minutes

  set(protocol: string, posts: UnifiedPost[]): void {
    this.cache.set(protocol, { posts, fetchedAt: Date.now() });
  }

  get(protocol: string): FallbackCacheEntry | null {
    const entry = this.cache.get(protocol);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > this.maxAge) {
      this.cache.delete(protocol);
      return null;
    }
    return entry;
  }

  getAge(protocol: string): number | null {
    const entry = this.cache.get(protocol);
    if (!entry) return null;
    return Date.now() - entry.fetchedAt;
  }
}

// ─── Internal fallback cache ─────────────────────────────────────────────
const _fallbackCache = new FallbackCache();
export const fallbackCache = _fallbackCache;

/**
 * Try to fetch from a fallback provider by its protocol key.
 * Dynamically imports the provider module and calls its fetch function.
 */
async function tryFallbackProvider(
  protocol: string,
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    // Map known protocol keys to their module paths
    const providerModules: Record<string, string> = {
      mastodon: '../providers/gotosocial',
      bluesky: '../providers/bluesky',
      nostr: '../providers/nostr',
      farcaster: '../providers/farcaster',
      lens: '../providers/lens',
      reddit: '../providers/redlib',
      rss: '../providers/rss',
      lemmy: '../providers/lemmy',
      peertube: '../providers/peertube',
      pixelfed: '../providers/pixelfed',
      youtube: '../providers/rss', // YouTube via RSS
      owncast: '../providers/owncast',
      writefreely: '../providers/writefreely',
      pleroma: '../providers/pleroma',
      misskey: '../providers/misskey',
      hive: '../providers/hive',
      dtube: '../providers/dtube',
      lbry: '../providers/lbry',
      mirror: '../providers/mirror',
      paragraph: '../providers/paragraph',
      telegram: '../providers/telegram',
      discord: '../providers/discord',
      matrix: '../providers/matrix',
      github: '../providers/github',
      threads: '../providers/threads',
      zora: '../providers/zora',
      mbin: '../providers/mbin',
      kbin: '../providers/kbin',
      immich: '../providers/immich',
      discourse: '../providers/discourse',
      ghost: '../providers/ghost',
      flarum: '../providers/flarum',
      friendica: '../providers/friendica',
      diaspora: '../providers/diaspora',
      subsocial: '../providers/subsocial',
      steem: '../providers/steem',
      gab: '../providers/gab',
      minds: '../providers/minds',
      aether: '../providers/aether',
      scuttlebutt: '../providers/scuttlebutt',
      deso: '../providers/deso',
      session: '../providers/session',
      arena: '../providers/arena',
      microblog: '../providers/microblog',
      bookwyrm: '../providers/bookwyrm',
      mobilizon: '../providers/mobilizon',
      forgejo: '../providers/forgejo',
      bonfire: '../providers/bonfire',
      mitra: '../providers/mitra',
      takahe: '../providers/takahe',
      faircamp: '../providers/faircamp',
      funkwhale: '../providers/funkwhale',
      castopod: '../providers/castopod',
      mediagoblin: '../providers/mediagoblin',
      strfry: '../providers/strfry',
      smokesignal: '../providers/smokesignal',
      atproto: '../providers/atproto',
      arweave: '../providers/arweave',
      orbis: '../providers/orbis',
    };

    const modulePath = providerModules[protocol];
    if (!modulePath) return [];

    const mod = (await import(modulePath)) as {
      fetch?: (limit: number) => Promise<UnifiedPost[]>;
      fetchPosts?: (limit: number) => Promise<UnifiedPost[]>;
      fetchNostrPosts?: (limit: number) => Promise<UnifiedPost[]>;
      fetchFarcasterPosts?: (limit: number) => Promise<UnifiedPost[]>;
      fetchBlueskyPosts?: (limit: number) => Promise<UnifiedPost[]>;
      fetchMastodonPosts?: (limit: number) => Promise<UnifiedPost[]>;
      default?: (limit: number) => Promise<UnifiedPost[]>;
    };

    const fetchFn =
      mod.fetch ?? mod.fetchPosts ?? (mod as Record<string, unknown>)[`fetch${capitalize(protocol)}Posts`] as ((limit: number) => Promise<UnifiedPost[]>) | undefined ?? mod.default;

    if (typeof fetchFn !== 'function') return [];

    return await fetchFn(Math.max(5, Math.ceil(limit)));
  } catch {
    return [];
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const failoverRouter = new FailoverRouter();
