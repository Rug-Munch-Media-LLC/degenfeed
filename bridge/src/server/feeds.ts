/**
 * Bridge Feed Builder
 *
 * Registry of all protocol providers with error handling,
 * circuit breakers, failover, and rate limiting.
 *
 * Last cleanup: 2026-07-25 — Removed 14 dead providers, implemented 8 real ones
 */

import { fetchAetherPosts } from '../providers/aether';
import { fetchArenaPosts } from '../providers/arena';
import { fetchArweavePosts } from '../providers/arweave';
import { fetchAtprotoPosts } from '../providers/atproto';
import { fetchBlueskyPosts } from '../providers/bluesky';
import { fetchBonfirePosts } from '../providers/bonfire';
import { fetchBookWyrmPosts } from '../providers/bookwyrm';
import { fetchCastopodPosts } from '../providers/castopod';
import { fetchCeramicPosts } from '../providers/ceramic';
import { fetchCyberConnectPosts } from '../providers/cyberconnect';
import { fetchDeSoPosts } from '../providers/deso';
import { fetchDiasporaPosts } from '../providers/diaspora';
import { fetchDiscordPosts } from '../providers/discord';
import { fetchDiscoursePosts } from '../providers/discourse';
import { fetchDTubePosts } from '../providers/dtube';
import { fetchFaircampPosts } from '../providers/faircamp';
import { fetchFarcasterPosts } from '../providers/farcaster';
import { fetchFlarumPosts } from '../providers/flarum';
import { fetchForgejoPosts } from '../providers/forgejo';
import { fetchFriendicaPosts } from '../providers/friendica';
import { fetchFunkwhalePosts } from '../providers/funkwhale';
import { fetchGabPosts } from '../providers/gab';
import { fetchGhostPosts } from '../providers/ghost';
import { fetchGitHubPosts } from '../providers/github';
// ─── Real Provider Imports ─────────────────────────────────────────
import { fetchMastodonPosts } from '../providers/gotosocial';
import { fetchHivePosts } from '../providers/hive';
import { fetchHuddle01Posts } from '../providers/huddle01';
import { fetchImmichPosts } from '../providers/immich';
import { fetchKbinPosts } from '../providers/kbin';
import { fetchLBRYPosts } from '../providers/lbry';
import { fetchLemmyPosts } from '../providers/lemmy';
import { fetchLensPosts } from '../providers/lens';
import { fetchMatrixPosts } from '../providers/matrix';
import { fetchMbinPosts } from '../providers/mbin';
import { fetchMediaGoblinPosts } from '../providers/mediagoblin';
import { fetchMicroblogPosts } from '../providers/microblog';
import { fetchMindsPosts } from '../providers/minds';
import { fetchMirrorPosts } from '../providers/mirror';
// ─── NEW Real Provider Imports (2026-07-25) ────────────────────────
import { fetchMisskeyPosts } from '../providers/misskey';
import { fetchMitraPosts } from '../providers/mitra';
import { fetchMobilizonPosts } from '../providers/mobilizon';
import { fetchNostrPosts } from '../providers/nostr';
import { fetchOrbisPosts } from '../providers/orbis';
import { fetchOwncastPosts } from '../providers/owncast';
import { fetchParagraphPosts } from '../providers/paragraph';
import { fetchPeerTubePosts } from '../providers/peertube';
import { fetchPixelfedPosts } from '../providers/pixelfed';
import { fetchPleromaPosts } from '../providers/pleroma';
import { fetchPushPosts } from '../providers/push';
import { fetchRedditPosts } from '../providers/redlib';
import { fetch as fetchRssPosts } from '../providers/rss';
import { fetchRssBridgePosts } from '../providers/rssbridge';
import { fetchScuttlebuttPosts } from '../providers/scuttlebutt';
import { fetchSessionPosts } from '../providers/session';
import { fetchEvents as fetchSmokeSignalEvents } from '../providers/smokesignal';
import { fetchSteemPosts } from '../providers/steem';
import { fetchStrfryPosts } from '../providers/strfry';
import { fetchSubsocialPosts } from '../providers/subsocial';
import { fetchTablelandPosts } from '../providers/tableland';
import { fetchTakahePosts } from '../providers/takahe';
import { fetchTelegramPosts } from '../providers/telegram';
import { fetchThreadsPosts } from '../providers/threads';
import { fetchWriteFreelyPosts } from '../providers/writefreely';
// ─── Infrastructure Providers (status-only, not in main feed) ─────
import { fetchXmtpPosts } from '../providers/xmtp';
import { fetchZoraPosts } from '../providers/zora';
import type { RateLimitConfig } from '../rate-limiter';
import { checkRateLimit } from '../rate-limiter';
import { providerCircuitBreaker } from '../reliability/circuit-breaker';
import { failoverRouter, fallbackCache } from '../reliability/failover-router';
import { healthDashboard } from '../reliability/health-dashboard';
import {
  registerAllProvidersWithCircuitBreaker,
  registerFailoverStrategies,
} from '../reliability/register-all';
import { deadLetterQueue } from '../reliability/retry';
import { getSeedContent } from './seed-content';
import type { UnifiedPost } from './types';

interface ProviderEntry {
  name: string;
  fetch: ProviderFetcher;
  rateLimit?: RateLimitConfig;
  category?: 'content' | 'infrastructure';
}

type ProviderFetcher = (limit: number) => Promise<UnifiedPost[]>;

export const PROVIDERS: Record<string, ProviderEntry> = {
  // ═══════════════════════════════════════════════════════════════════
  // TIER 1: Core Social
  // ═══════════════════════════════════════════════════════════════════
  mastodon: {
    name: 'Mastodon/GTS',
    fetch: fetchMastodonPosts,
    rateLimit: { maxRequests: 300, windowMs: 300_000 },
    category: 'content',
  },
  bluesky: {
    name: 'Bluesky/PDS',
    fetch: fetchBlueskyPosts,
    rateLimit: { maxRequests: 3000, windowMs: 300_000 },
    category: 'content',
  },
  nostr: {
    name: 'Nostr',
    fetch: fetchNostrPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  farcaster: {
    name: 'Farcaster',
    fetch: fetchFarcasterPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  lens: {
    name: 'Lens',
    fetch: fetchLensPosts,
    rateLimit: { maxRequests: 50, windowMs: 60_000 },
    category: 'content',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 2: Established Platforms
  // ═══════════════════════════════════════════════════════════════════
  reddit: {
    name: 'Reddit/Redlib',
    fetch: fetchRedditPosts,
    rateLimit: { maxRequests: 600, windowMs: 600_000 },
    category: 'content',
  },
  rss: {
    name: 'RSS+Newsletter (100+ sources)',
    fetch: fetchRssPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  newsletter: {
    name: 'Newsletters (Substack/Medium/Mirror/Paragraph/Ghost/Beehiiv)',
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
    fetch: async (limit) => {
      const { fetchNewsletterPosts } = await import('../providers/rss');
      return fetchNewsletterPosts(limit);
    },
  },
  rssbridge: {
    name: 'RSS-Bridge (legacy)',
    fetch: fetchRssBridgePosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  lemmy: {
    name: 'Lemmy',
    fetch: fetchLemmyPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  peertube: {
    name: 'PeerTube',
    fetch: fetchPeerTubePosts,
    rateLimit: { maxRequests: 50, windowMs: 60_000 },
    category: 'content',
  },
  pixelfed: { name: 'Pixelfed', fetch: fetchPixelfedPosts, category: 'content' },
  threads: { name: 'Threads (Meta)', fetch: fetchThreadsPosts, category: 'content' },
  zora: { name: 'Zora (NFT)', fetch: fetchZoraPosts, category: 'content' },
  dtube: { name: 'DTube (Hive Video)', fetch: fetchDTubePosts, category: 'content' },
  lbry: { name: 'Odysee/LBRY (Video)', fetch: fetchLBRYPosts, category: 'content' },
  gab: { name: 'Gab / Dissenter', fetch: fetchGabPosts, category: 'content' },
  minds: { name: 'Minds (Crypto Social)', fetch: fetchMindsPosts, category: 'content' },
  aether: { name: 'Aether (P2P Communities)', fetch: fetchAetherPosts, category: 'content' },
  scuttlebutt: { name: 'Scuttlebutt/SSB', fetch: fetchScuttlebuttPosts, category: 'content' },
  hive: { name: 'Hive Blog', fetch: fetchHivePosts, category: 'content' },
  paragraph: {
    name: 'Paragraph.xyz (Farcaster Articles)',
    fetch: fetchParagraphPosts,
    category: 'content',
  },
  mirror: { name: 'Mirror.xyz (Articles)', fetch: fetchMirrorPosts, category: 'content' },
  funkwhale: { name: 'Funkwhale (Audio/Music)', fetch: fetchFunkwhalePosts, category: 'content' },
  castopod: { name: 'Castopod (Podcasting)', fetch: fetchCastopodPosts, category: 'content' },
  writefreely: {
    name: 'WriteFreely / Write.as',
    fetch: fetchWriteFreelyPosts,
    category: 'content',
  },
  mediagoblin: { name: 'MediaGoblin', fetch: fetchMediaGoblinPosts, category: 'content' },
  owncast: { name: 'Owncast (Live Streaming)', fetch: fetchOwncastPosts, category: 'content' },
  arena: {
    name: 'Arena.social (Social Trading on Avalanche)',
    fetch: fetchArenaPosts,
    category: 'content',
  },
  deso: {
    name: 'DeSo / Bitclout (Layer-1 Social Blockchain)',
    fetch: fetchDeSoPosts,
    category: 'content',
  },
  microblog: {
    name: 'Micro.blog (IndieWeb Microblogging)',
    fetch: fetchMicroblogPosts,
    category: 'content',
  },
  session: {
    name: 'Session / SOGS (Privacy Messenger)',
    fetch: fetchSessionPosts,
    category: 'content',
  },
  steem: { name: 'Steem (Blockchain Social Rewards)', fetch: fetchSteemPosts, category: 'content' },
  subsocial: {
    name: 'Subsocial (Polkadot Social)',
    fetch: fetchSubsocialPosts,
    category: 'content',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 3: ActivityPub Ecosystem
  // ═══════════════════════════════════════════════════════════════════
  bookwyrm: { name: 'BookWyrm (Federated Books)', fetch: fetchBookWyrmPosts, category: 'content' },
  mobilizon: {
    name: 'Mobilizon (Federated Events)',
    fetch: fetchMobilizonPosts,
    category: 'content',
  },
  forgejo: { name: 'Forgejo/Gitea (Git Repos)', fetch: fetchForgejoPosts, category: 'content' },
  bonfire: { name: 'Bonfire (Federated Social)', fetch: fetchBonfirePosts, category: 'content' },
  mitra: { name: 'Mitra (Lightweight Microblog)', fetch: fetchMitraPosts, category: 'content' },
  takahe: { name: 'Takahē (Multi-Domain Fedi)', fetch: fetchTakahePosts, category: 'content' },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 4: Federated Microblogging (NEW real implementations)
  // ═══════════════════════════════════════════════════════════════════
  misskey: {
    name: 'Misskey (Rich Media Fedi)',
    fetch: fetchMisskeyPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  pleroma: {
    name: 'Pleroma / Akkoma (Lightweight Fedi)',
    fetch: fetchPleromaPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  friendica: {
    name: 'Friendica (Fediverse Compatible)',
    fetch: fetchFriendicaPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  diaspora: {
    name: 'Diaspora* (Federated Social)',
    fetch: fetchDiasporaPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 5: Federated Content Aggregation (NEW real implementations)
  // ═══════════════════════════════════════════════════════════════════
  kbin: {
    name: 'Kbin / Mbin (Federated Hybrid)',
    fetch: fetchKbinPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  mbin: {
    name: 'Mbin (Active Kbin Fork)',
    fetch: fetchMbinPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  flarum: {
    name: 'Flarum (Federated Forums)',
    fetch: fetchFlarumPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 6: Decentralized Storage / Web3 Content (real implementations)
  // ═══════════════════════════════════════════════════════════════════
  arweave: {
    name: 'Arweave (Permaweb Gateway)',
    fetch: fetchArweavePosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  orbis: { name: 'Orbis (Ceramic Social)', fetch: fetchOrbisPosts, category: 'content' },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 7: Messaging & Dev Platforms
  // ═══════════════════════════════════════════════════════════════════
  telegram: {
    name: 'Telegram (Channels & Groups)',
    fetch: fetchTelegramPosts,
    category: 'content',
  },
  discord: { name: 'Discord (Communities)', fetch: fetchDiscordPosts, category: 'content' },
  matrix: { name: 'Matrix (Decentralized Chat)', fetch: fetchMatrixPosts, category: 'content' },
  github: {
    name: 'GitHub (Dev Activity)',
    fetch: fetchGitHubPosts,
    rateLimit: { maxRequests: 60, windowMs: 3_600_000 },
    category: 'content',
  },
  discourse: {
    name: 'Discourse (Forum + ActivityPub)',
    fetch: fetchDiscoursePosts,
    category: 'content',
  },
  ghost: { name: 'Ghost (Headless CMS)', fetch: fetchGhostPosts, category: 'content' },
  immich: { name: 'Immich (Self-Hosted Photos)', fetch: fetchImmichPosts, category: 'content' },
  faircamp: {
    name: 'Faircamp (Self-Hosted Music Sites)',
    fetch: fetchFaircampPosts,
    category: 'content',
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 8: Class-based providers
  // ═══════════════════════════════════════════════════════════════════
  audius: {
    name: 'Audius (Decentralized Music)',
    category: 'content',
    fetch: async (limit: number) => {
      const { AudiusProvider } = await import('../providers/audius');
      const p = new AudiusProvider();
      const raw = await p.fetch({ limit } as any);
      return (raw || []).slice(0, limit).map((r: any) => p.normalize(r));
    },
  },
  rarible: {
    name: 'Rarible Protocol (NFT Market Activity)',
    category: 'content',
    fetch: async (limit: number) => {
      const { RaribleProvider } = await import('../providers/rarible');
      const p = new RaribleProvider();
      const raw = await p.fetch({ limit } as any);
      return (raw || []).slice(0, limit).map((r: any) => p.normalize(r));
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TIER 9: Cross-Protocol / AT Protocol
  // ═══════════════════════════════════════════════════════════════════
  atproto: {
    name: 'AT Protocol (Bluesky/Public)',
    fetch: fetchAtprotoPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  smokesignal: {
    name: 'Smoke Signal (AT Protocol Events)',
    fetch: fetchSmokeSignalEvents,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  strfry: {
    name: 'strfry (Nostr Search Relay)',
    fetch: fetchStrfryPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },

  // ═══════════════════════════════════════════════════════════════════
  // INFRASTRUCTURE PROVIDERS (status-only, excluded from main feed)
  // ═══════════════════════════════════════════════════════════════════
  xmtp: {
    name: 'XMTP (Web3 Messaging — Infra)',
    fetch: fetchXmtpPosts,
    category: 'infrastructure',
  },
  ceramic: {
    name: 'Ceramic/ComposeDB — Infra',
    fetch: fetchCeramicPosts,
    category: 'infrastructure',
  },
  tableland: {
    name: 'Tableland (Decentralized DB — Infra)',
    fetch: fetchTablelandPosts,
    category: 'infrastructure',
  },
  cyberconnect: {
    name: 'CyberConnect (Web3 Social Graph — Infra)',
    fetch: fetchCyberConnectPosts,
    category: 'infrastructure',
  },
  push: {
    name: 'Push Protocol (Web3 Notifications — Infra)',
    fetch: fetchPushPosts,
    category: 'infrastructure',
  },
  huddle01: {
    name: 'Huddle01 (Decentralized Video — Infra)',
    fetch: fetchHuddle01Posts,
    category: 'infrastructure',
  },
};

// ─── Reliability Initialization ─────────────────────────────────────────
let reliabilityInitialized = false;

export function initializeReliability(): void {
  if (reliabilityInitialized) return;
  reliabilityInitialized = true;

  registerAllProvidersWithCircuitBreaker();
  registerFailoverStrategies(PROVIDERS);

  console.log('[reliability] All providers registered with circuit breakers and failover');
}

/** Race a promise against a timeout (milliseconds) using AbortController */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  const controller = new AbortController();
  const timeoutPromise = new Promise<T>((_, reject) => {
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error(`[bridge] ${label} timed out after ${ms}ms`));
    }, ms);
    // Clean up timeout if promise settles first
    void promise.then(() => clearTimeout(id)).catch(() => clearTimeout(id));
  });
  return Promise.race([promise, timeoutPromise]);
}

/** Build a deduplicated feed from multiple protocols with reliability */
export async function buildFeed(
  protocols: string[],
  limit: number,
): Promise<{ posts: UnifiedPost[]; meta: Record<string, unknown> }> {
  // Lazy-initialize reliability on first data request (not at module import)
  initializeReliability();

  const perProtocol: Record<string, number> = {};
  const errors: string[] = [];
  const notices: string[] = [];
  const providerSources: Record<string, string> = {};
  const cacheAges: Record<string, number> = {};

  // Only include content providers (exclude infrastructure)
  const activeProtocols = protocols.filter(
    (p) => p in PROVIDERS && PROVIDERS[p].category !== 'infrastructure',
  );
  if (activeProtocols.length === 0)
    activeProtocols.push(
      'mastodon',
      'reddit',
      'rss',
      'lemmy',
      'bluesky',
      'nostr',
      'farcaster',
      'lens',
      'pixelfed',
    );

  const perProviderLimit = Math.max(5, Math.ceil((limit * 1.5) / activeProtocols.length));
  const FETCH_TIMEOUT_MS = 10000;

  const results = await Promise.allSettled(
    activeProtocols.map(async (protocol) => {
      const provider = PROVIDERS[protocol];
      if (!provider) return { protocol, posts: [] as UnifiedPost[] };

      providerCircuitBreaker.register(protocol);

      if (!providerCircuitBreaker.isAllowed(protocol)) {
        const cached = fallbackCache.get(protocol);
        if (cached) {
          const ageMs = Date.now() - cached.fetchedAt;
          console.log(`[reliability] ${protocol}: Circuit open, serving ${ageMs}ms old cache`);
          return {
            protocol,
            posts: cached.posts.slice(0, perProviderLimit),
            source: 'cached',
            cacheAgeMs: ageMs,
            notice: 'degraded (circuit open, using cache)',
          };
        }
        return { protocol, posts: [] as UnifiedPost[], error: 'Circuit breaker open' };
      }

      if (provider.rateLimit) {
        const key = `provider:${protocol}`;
        if (!checkRateLimit(key, provider.rateLimit)) {
          const cached = fallbackCache.get(protocol);
          if (cached) {
            return {
              protocol,
              posts: cached.posts.slice(0, perProviderLimit),
              source: 'cached',
              cacheAgeMs: Date.now() - cached.fetchedAt,
              notice: 'rate-limited (using cache)',
            };
          }
          return { protocol, posts: [] as UnifiedPost[], notice: 'rate-limited' };
        }
      }

      try {
        healthDashboard.recordFetch(protocol);
        // Fetch with timeout but NO retry — if a provider times out,
        // we want to fail fast and try the fallback or cache.
        // Retrying slow providers compounds delays and blocks the feed.
        const posts = await withTimeout(
          provider.fetch(perProviderLimit),
          FETCH_TIMEOUT_MS,
          `provider:${protocol}`,
        );

        healthDashboard.recordSuccess(protocol, FETCH_TIMEOUT_MS);
        providerCircuitBreaker.recordSuccess(protocol);
        fallbackCache.set(protocol, posts);

        return { protocol, posts, source: 'live' };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        healthDashboard.recordFailure(protocol, FETCH_TIMEOUT_MS);

        if (failoverRouter.hasStrategy(protocol)) {
          try {
            const failoverResult = await failoverRouter.execute(protocol, perProviderLimit);
            if (failoverResult.status === 'fallback') {
              return {
                protocol,
                posts: failoverResult.posts,
                source: 'fallback',
                notice: `using fallback: ${failoverResult.source}`,
              };
            }
            if (failoverResult.status === 'cached') {
              return {
                protocol,
                posts: failoverResult.posts,
                source: 'cached',
                cacheAgeMs: failoverResult.cacheAgeMs,
                notice: 'degraded using cache',
              };
            }
          } catch {
            /* failover also failed */
          }
        }

        const cached = fallbackCache.get(protocol);
        if (cached) {
          const ageMs = Date.now() - cached.fetchedAt;
          return {
            protocol,
            posts: cached.posts.slice(0, perProviderLimit),
            source: 'cached',
            cacheAgeMs: ageMs,
            notice: 'degraded using cache',
          };
        }

        deadLetterQueue.enqueue({
          id: `${protocol}-${Date.now()}`,
          providerKey: protocol,
          operation: 'fetch',
          error: errMsg,
          exhaustedRetries: 3,
        });

        return { protocol, posts: [] as UnifiedPost[], error: errMsg };
      }
    }),
  );

  const allPosts: UnifiedPost[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { protocol, posts, error, notice, source, cacheAgeMs } = result.value as any;
      perProtocol[protocol] = posts.length;
      providerSources[protocol] = source ?? 'live';
      if (cacheAgeMs) cacheAges[protocol] = cacheAgeMs;
      allPosts.push(...posts);
      if (error) errors.push(`${protocol}: ${error}`);
      if (notice) notices.push(`${protocol}: ${notice}`);
    } else {
      errors.push(
        `provider: ${result.reason instanceof Error ? result.reason.message : 'unknown'}`,
      );
    }
  }

  for (const [protocol, count] of Object.entries(perProtocol))
    console.log(`[bridge] ${protocol}: ${count} posts`);

  if (allPosts.length === 0) {
    notices.push('All content sources returned no data. Serving demo content.');
    // NEVER return empty — serve seed/demo content so the feed always has something
    const seedPosts = getSeedContent(limit);
    for (const p of seedPosts) {
      (p as Record<string, unknown>)._demo = true;
    }
    return {
      posts: seedPosts,
      meta: {
        total: seedPosts.length,
        limit,
        perProtocol,
        providerSources,
        cacheAges,
        errors: errors.length > 0 ? errors : undefined,
        notices,
        page: 1,
        fetchedAt: Date.now(),
        source: 'demo',
        isDemo: true,
        demoNote:
          'Connect more protocols to see real content. Configure Nostr, Farcaster, Bluesky, or Mastodon at app.degenfeed.xyz/settings',
      },
    };
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of allPosts) {
    const key = p.text.slice(0, 80);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  const degradedCount = Object.keys(cacheAges).length;

  console.log(
    '[bridge] Built feed: ' +
      deduped.length +
      ' posts from ' +
      Object.keys(perProtocol).length +
      ' sources' +
      (degradedCount > 0 ? ` (${degradedCount} degraded)` : ''),
  );
  return {
    posts: deduped,
    meta: {
      total: deduped.length,
      limit,
      perProtocol,
      providerSources,
      cacheAges: Object.keys(cacheAges).length > 0 ? cacheAges : undefined,
      degraded: degradedCount > 0 ? degradedCount : undefined,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: Date.now(),
      source: 'live',
    },
  };
}

export const DEFAULT_PREFERENCES = {
  hideLowQuality: false,
  hideLowQualityThreshold: 1.0,
  allowNonCrypto: false,
  recencyWeight: 1.0,
  engagementWeight: 1.0,
  showOriginalContent: false,
  minEngagement: 0,
  maxPerNiche: 5,
  topicWeights: {
    crypto: 100,
    defi: 90,
    nft: 50,
    ai: 70,
    solana: 60,
    ethereum: 80,
    books: 40,
    events: 50,
    music: 40,
    video: 30,
  },
  algorithmTransparent: false,
  freshnessPreference: 50,
  creatorDiversity: 5,
  exploreRatio: 30,
  activePreset: null,
  feedMixConfig: {
    sources: [
      'mastodon',
      'nostr',
      'farcaster',
      'lens',
      'bluesky',
      'reddit',
      'rss',
      'smokesignal',
      'lemmy',
      'peertube',
      'pixelfed',
      'dtube',
      'lbry',
      'hive',
      'mirror',
      'paragraph',
      'funkwhale',
      'castopod',
      'writefreely',
      'pleroma',
      'misskey',
      'subsocial',
      'steem',
      'diaspora',
      'friendica',
      'mediagoblin',
      'bookwyrm',
      'mobilizon',
      'forgejo',
      'bonfire',
      'mitra',
      'takahe',
      'owncast',
      'kbin',
      'mbin',
      'flarum',
      'arweave',
      'gab',
      'minds',
      'aether',
      'scuttlebutt',
      'deso',
      'session',
      'arena',
      'microblog',
      'faircamp',
      'orbis',
      'telegram',
      'discord',
      'matrix',
      'github',
      'discourse',
      'ghost',
      'immich',
      'audius',
      'rarible',
    ],
    contentTypes: {
      posts: 100,
      images: 40,
      videos: 20,
      links: 30,
      threads: 40,
      books: 25,
      events: 20,
      code: 15,
      notifications: 10,
      live: 15,
      data: 10,
    },
    recencyWeight: 1.0,
    engagementWeight: 1.0,
    exploreRatio: 30,
  },
  savedMixes: [],
};
