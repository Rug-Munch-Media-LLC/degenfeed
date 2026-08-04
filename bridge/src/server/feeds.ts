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
import { fetchBandcampPosts } from '../providers/bandcamp';
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
import { fetchGancioPosts } from '../providers/gancio';
import { fetchGhostPosts } from '../providers/ghost';
import { fetchGitHubPosts } from '../providers/github';
// ─── Real Provider Imports ─────────────────────────────────────────
import { fetchMastodonPosts } from '../providers/gotosocial';
import { fetchHivePosts } from '../providers/hive';
import { fetchHuddle01Posts } from '../providers/huddle01';
import { fetchImmichPosts } from '../providers/immich';
import { fetchJuiceboxPosts } from '../providers/juicebox';
import { fetchKbinPosts } from '../providers/kbin';
import { fetchLBRYPosts } from '../providers/lbry';
import { fetchLemmyPosts } from '../providers/lemmy';
import { fetchLensPosts } from '../providers/lens';
import { fetchLitPosts } from '../providers/lit';
import { fetchLobstersPosts } from '../providers/lobsters';
import { fetchLoopsPosts } from '../providers/loops';
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
import { fetchNostrGroupsPosts } from '../providers/nostr-groups';
import { fetchOpenSeaPosts } from '../providers/opensea';
import { fetchOrbisPosts } from '../providers/orbis';
import { fetchOwncastPosts } from '../providers/owncast';
import { fetchParagraphPosts } from '../providers/paragraph';
import { fetchPeerTubePosts } from '../providers/peertube';
import { fetchPieFedPosts } from '../providers/piefed';
import { fetchPixelfedPosts } from '../providers/pixelfed';
import { fetchPleromaPosts } from '../providers/pleroma';
import { fetchPushPosts } from '../providers/push';
import { fetchRedditPosts } from '../providers/redlib';
import { fetch as fetchRssPosts } from '../providers/rss';
import { fetchRssBridgePosts } from '../providers/rssbridge';
import { fetchScuttlebuttPosts } from '../providers/scuttlebutt';
import { fetchSessionPosts } from '../providers/session';
import { fetchEvents as fetchSmokeSignalEvents } from '../providers/smokesignal';
import { fetchSnapshotPosts } from '../providers/snapshot';
import { fetchSoundCloudPosts } from '../providers/soundcloud';
import { fetchSteemPosts } from '../providers/steem';
import { fetchStrfryPosts } from '../providers/strfry';
import { fetchSubsocialPosts } from '../providers/subsocial';
import { fetchTablelandPosts } from '../providers/tableland';
import { fetchTakahePosts } from '../providers/takahe';
import { fetchTallyPosts } from '../providers/tally';
import { fetchTelegramPosts } from '../providers/telegram';
import { fetchThreadsPosts } from '../providers/threads';
import { fetchTwitchPosts } from '../providers/twitch';
import { fetchUnlockPosts } from '../providers/unlock';
import { fetchVimeoPosts } from '../providers/vimeo';
import { fetchWordPressPosts } from '../providers/wordpress';
import { fetchWriteFreelyPosts } from '../providers/writefreely';
// ─── Infrastructure Providers (status-only, not in main feed) ─────
import { fetchXmtpPosts } from '../providers/xmtp';
import { fetchYouTubePosts } from '../providers/youtube';
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
import { feedCache } from './response-cache';
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
    name: 'Newsletters (Substack/Medium/Mirror/Paragraph/Ghost)',
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
    fetch: async (limit) => {
      const { fetchNewsletterPosts } = await import('../providers/newsletter');
      return fetchNewsletterPosts(limit);
    },
  },
  podcast: {
    name: 'Podcasts (Bankless/Unchained/Empire/0xResearch/etc.)',
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
    fetch: async (limit) => {
      const { fetchPodcastPosts } = await import('../providers/rss');
      return fetchPodcastPosts(limit);
    },
  },
  youtube: {
    name: 'YouTube (Crypto/Tech/AI Channels)',
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
    fetch: fetchYouTubePosts,
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
  piefed: { name: 'PieFed', fetch: fetchPieFedPosts, category: 'content' },
  threads: {
    name: 'Threads (Meta)',
    fetch: fetchThreadsPosts,
    rateLimit: { maxRequests: 40, windowMs: 600_000 },
    category: 'content',
  },
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
      const raw = await p.fetch({ limit });
      return (raw || []).slice(0, limit).map((r) => p.normalize(r));
    },
  },
  rarible: {
    name: 'Rarible Protocol (NFT Market Activity)',
    category: 'content',
    fetch: async (limit: number) => {
      const { RaribleProvider } = await import('../providers/rarible');
      const p = new RaribleProvider();
      const raw = await p.fetch({ limit });
      return (raw || []).slice(0, limit).map((r) => p.normalize(r));
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
  // ═══════════════════════════════════════════════════════════════════
  // TIER 10: New Protocol Integrations (2026-07-26)
  // ═══════════════════════════════════════════════════════════════════
  gancio: {
    name: 'Gancio (Federated Events)',
    fetch: fetchGancioPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  soundcloud: {
    name: 'SoundCloud (Music RSS)',
    fetch: fetchSoundCloudPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  bandcamp: {
    name: 'Bandcamp (Music Releases)',
    fetch: fetchBandcampPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  vimeo: {
    name: 'Vimeo (Professional Video)',
    fetch: fetchVimeoPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  loops: {
    name: 'Loops (Self-Hosted Short Video)',
    fetch: fetchLoopsPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  twitch: {
    name: 'Twitch (Live Streams & Clips)',
    fetch: fetchTwitchPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  wordpress: {
    name: 'WordPress + ActivityPub',
    fetch: fetchWordPressPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  'nostr-groups': {
    name: 'Nostr Groups (NIP-29)',
    fetch: fetchNostrGroupsPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },

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

  // ═══════════════════════════════════════════════════════════════════
  // PROTOCOL EXPANSION PACK — OpenSea, Lobsters, DAO Governance
  // ═══════════════════════════════════════════════════════════════════
  opensea: {
    name: 'OpenSea (NFT Marketplace)',
    fetch: fetchOpenSeaPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  lobsters: {
    name: 'Lobste.rs (Tech Link Aggregation)',
    fetch: fetchLobstersPosts,
    rateLimit: { maxRequests: 60, windowMs: 60_000 },
    category: 'content',
  },
  snapshot: {
    name: 'Snapshot (DAO Governance Voting)',
    fetch: fetchSnapshotPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  tally: {
    name: 'Tally (DAO Governance & Treasury)',
    fetch: fetchTallyPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  juicebox: {
    name: 'Juicebox (DAO Funding & Projects)',
    fetch: fetchJuiceboxPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  unlock: {
    name: 'Unlock Protocol (Token-Gated Membership)',
    fetch: fetchUnlockPosts,
    rateLimit: { maxRequests: 30, windowMs: 60_000 },
    category: 'content',
  },
  lit: {
    name: 'Lit Protocol (Decentralized Key Mgmt)',
    fetch: fetchLitPosts,
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

/**
 * Race a promise against a timeout (milliseconds).
 *
 * CRITICAL: This properly handles the losing promise's rejection to prevent
 * unhandled rejections that cause SIGABRT. The old implementation used
 * Promise.race which left the losing promise's rejection unhandled.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[bridge] ${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Process an array of items with a concurrency limit.
 * Runs at most `concurrency` promises simultaneously.
 * Returns results in order. Each item's fn is expected to catch its own errors
 * and return a result — this does not catch per-item exceptions.
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from<R>({ length: items.length });
  const queue = items.map((item, index) => ({ item, index }));

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;
      const { item, index } = entry;
      results[index] = await fn(item);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    worker().catch((err) => {
      console.error('[bridge] Worker error:', err);
    }),
  );
  await Promise.all(workers);
  return results;
}

// ─── Feed Result Cache ───────────────────────────────────────────────────
// Fixes the 20s cold start: the bridge aggregates 30+ providers on the first
// request after a restart (Promise.all across providers, slow ones up to 15s).
// Caching complete feed results with a 30s TTL means cold starts hit the
// cache instead of providers, and prewarmFeedCache() warms it at startup so
// the first user request is fast.

/** Protocol set used by the HTTP handler when the client omits `protocols`. */
export const DEFAULT_HOME_PROTOCOLS = [
  'mastodon',
  'reddit',
  'rss',
  'newsletter',
  'lemmy',
  'peertube',
  'youtube',
  'bluesky',
  'nostr',
  'farcaster',
  'lens',
  'pixelfed',
  'zora',
];

/**
 * Discovery mode pool — content protocols a user would NOT normally see on
 * the home feed. buildFeedInternal occasionally injects a small slice from
 * 1-2 of these (rotating on a 60s window) so the feed surfaces diverse
 * protocols the user hasn't opted into. Posts are flagged `_discovery`.
 */
const DISCOVERY_POOL = [
  'minds',
  'hive',
  'steem',
  'diaspora',
  'friendica',
  'pleroma',
  'misskey',
  'kbin',
  'mbin',
  'lobsters',
  'snapshot',
  'tally',
  'juicebox',
  'unlock',
  'gancio',
  'soundcloud',
  'bandcamp',
  'vimeo',
  'twitch',
  'wordpress',
  'mirror',
  'paragraph',
  'funkwhale',
  'castopod',
  'writefreely',
  'owncast',
  'dtube',
  'lbry',
  'gab',
  'arena',
  'bookwyrm',
  'mobilizon',
  'forgejo',
  'bonfire',
  'mitra',
  'takahe',
  'mediagoblin',
  'flarum',
  'discourse',
  'ghost',
  'github',
  'telegram',
  'discord',
  'matrix',
  'opensea',
  'smokesignal',
  'arweave',
  'faircamp',
  'orbis',
];

/**
 * Select 1-2 discovery protocols NOT in the active set.
 *
 * Deterministic within a 60s window so concurrent single-flight requests and
 * the 60s result cache stay consistent, but the selection rotates every
 * minute so the feed gradually surfaces new protocols over time.
 */
export function selectDiscoveryProtocols(active: string[], now = Date.now()): string[] {
  const candidates = DISCOVERY_POOL.filter(
    (p) => !active.includes(p) && PROVIDERS[p] && PROVIDERS[p].category === 'content',
  );
  if (candidates.length === 0) return [];
  const windowIdx = Math.floor(now / 60_000);
  const count = Math.min(2, candidates.length);
  const selected: string[] = [];
  for (let i = 0; i < count; i++) {
    selected.push(candidates[(windowIdx * 5 + i * 7) % candidates.length]);
  }
  return selected;
}

const FEED_CACHE_TTL_MS = 60_000; // 60s — matches HTTP-level response cache TTL
const FEED_CACHE_MAX_ENTRIES = 20;

interface FeedResult {
  posts: UnifiedPost[];
  meta: Record<string, unknown>;
}

interface FeedCacheEntry {
  data: FeedResult;
  expiresAt: number;
}

const feedResultCache = new Map<string, FeedCacheEntry>();
/** Single-flight lock: coalesce concurrent requests for the same protocol set. */
const feedInFlight = new Map<string, Promise<FeedResult>>();

/**
 * Cache key is the protocol set only (limit-agnostic) — a cached result built
 * at a given limit can serve any request with a smaller limit via slicing.
 */
function feedCacheKey(protocols: string[]): string {
  return `feed:${[...protocols].sort().join(',')}`;
}

function resolveActiveProtocols(protocols: string[]): string[] {
  const active = protocols.filter(
    (p) => p in PROVIDERS && PROVIDERS[p].category !== 'infrastructure',
  );
  return active.length > 0 ? active : [...DEFAULT_HOME_PROTOCOLS];
}

/**
 * Defensive copy so callers (HTTP layer) can mutate meta.page / posts
 * (e.g. demo-content seeding) without corrupting the shared cache entry.
 */
function cloneFeedResult(data: FeedResult): FeedResult {
  return {
    posts: data.posts.slice(),
    meta: {
      ...data.meta,
      notices: Array.isArray(data.meta.notices) ? [...data.meta.notices] : data.meta.notices,
      errors: Array.isArray(data.meta.errors) ? [...data.meta.errors] : data.meta.errors,
    },
  };
}

function getCachedFeed(key: string): FeedResult | null {
  const entry = feedResultCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  return null;
}

function setCachedFeed(key: string, data: FeedResult): void {
  if (!feedResultCache.has(key) && feedResultCache.size >= FEED_CACHE_MAX_ENTRIES) {
    // Evict the entry that expires soonest to bound memory
    let oldestKey: string | null = null;
    let oldestExpiry = Infinity;
    for (const [k, e] of feedResultCache) {
      if (e.expiresAt < oldestExpiry) {
        oldestExpiry = e.expiresAt;
        oldestKey = k;
      }
    }
    if (oldestKey) feedResultCache.delete(oldestKey);
  }
  feedResultCache.set(key, { data, expiresAt: Date.now() + FEED_CACHE_TTL_MS });
}

/**
 * Build a deduplicated feed from multiple protocols with reliability.
 *
 * Cached: fresh results are served from a 30s TTL cache (limit-agnostic),
 * and concurrent identical requests coalesce into a single provider fetch.
 */

// ─── Cross-protocol dedup + interleave ──────────────────────────────────
// Same content can arrive on multiple protocols (bridged posts, cross-posted
// threads, duplicated news links). A single normalized fingerprint catches
// exact dupes; a URL fingerprint catches bridged copies that add a prefix
// (e.g. "via nostr:" / "cross-posted from X"). After dedup we interleave so
// the feed never shows more than MAX_CONSECUTIVE_SAME_PROTOCOL posts from
// one protocol in a row.

/** Hard cap on consecutive posts from the same protocol in any multi-protocol feed. */
export const MAX_CONSECUTIVE_SAME_PROTOCOL = 3;

/**
 * Normalize post text into a stable, comparable fingerprint.
 * - lowercase
 * - strip URLs (they differ per protocol for the same content)
 * - strip @mentions (bridged copies often prepend the source handle)
 * - strip punctuation/whitespace runs
 */
export function textFingerprint(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/@[\w.-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an embed/link URL for cross-protocol comparison.
 * Strips protocol, www., trailing slashes and common tracking params so the
 * same article/video linked from Nostr/Farcaster/Bluesky matches.
 */
export function urlFingerprint(url: string): string {
  let u = (url || '').trim();
  try {
    const parsed = new URL(u);
    u = (parsed.hostname || '').replace(/^www\./, '') + parsed.pathname;
  } catch {
    const cleaned = u
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split(/[?#]/)[0];
    u = cleaned ?? u;
  }
  return u.replace(/\/+$/, '').toLowerCase();
}

/** Extract URL fingerprints from a post's embeds + inline links. */
function postUrlFingerprints(p: UnifiedPost): string[] {
  const urls: string[] = [];
  for (const e of p.embeds || []) {
    if (e.url) urls.push(urlFingerprint(e.url));
  }
  const inline = (p.text || '').match(/https?:\/\/[^\s]+/g);
  if (inline) for (const u of inline) urls.push(urlFingerprint(u));
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Dedup + interleave a batch of cross-protocol posts.
 *
 * Dedup keys, in priority order:
 *  1. normalized text fingerprint (min 24 chars to avoid false positives on
 *     generic one-liners) — catches identical bridged/cross-posted copies
 *  2. URL fingerprint when the text fingerprint is too short to be reliable —
 *     catches "check this out https://..." copies across protocols
 *
 * Interleave: pass-based round-robin over protocols. Each pass takes at most
 * `maxConsecutive` posts from a protocol (default MAX_CONSECUTIVE_SAME_PROTOCOL,
 * clamped to it), so a run of same-protocol posts can NEVER exceed the cap —
 * even when one protocol dominates and every other source is exhausted.
 * A single-source feed (e.g. /api/feed/owncast) is exempt from the cap and
 * returns its full list so volume is never sacrificed when only one protocol
 * has content.
 */
export function dedupeAndInterleave(
  posts: UnifiedPost[],
  limit: number,
  options: { maxConsecutive?: number } = {},
): UnifiedPost[] {
  const maxConsecutive = Math.min(
    Math.max(1, options.maxConsecutive ?? MAX_CONSECUTIVE_SAME_PROTOCOL),
    MAX_CONSECUTIVE_SAME_PROTOCOL,
  );
  const seenText = new Set<string>();
  const seenUrls = new Set<string>();
  const unique: UnifiedPost[] = [];

  for (const p of posts) {
    const fp = textFingerprint(p.text);
    const urls = postUrlFingerprints(p);

    // Strong text match → duplicate (same content, possibly bridged)
    if (fp.length >= 24) {
      if (seenText.has(fp)) continue;
      seenText.add(fp);
      // Once text matched, also remember its URLs so a URL-only copy later
      // (e.g. text truncated to just the link) is deduped too.
      for (const u of urls) seenUrls.add(u);
      unique.push(p);
      continue;
    }

    // Short text — rely on URL match to catch cross-protocol copies.
    let isDup = false;
    for (const u of urls) {
      if (seenUrls.has(u)) {
        isDup = true;
        break;
      }
    }
    if (isDup) continue;
    for (const u of urls) seenUrls.add(u);
    unique.push(p);
  }

  // Group remaining unique posts by protocol for interleaving.
  const byProtocol = new Map<string, UnifiedPost[]>();
  for (const p of unique) {
    const arr = byProtocol.get(p.protocol);
    if (arr) arr.push(p);
    else byProtocol.set(p.protocol, [p]);
  }

  const nonEmpty = [...byProtocol.entries()].filter(([, arr]) => arr.length > 0);
  if (nonEmpty.length === 0) return [];
  // Single-source feed — the diversity cap does not apply; return up to limit.
  if (nonEmpty.length === 1) return nonEmpty[0][1].slice(0, limit);

  // Deterministic but varied order: rotate the starting protocol so the same
  // post list from cache can still produce different mixes per request when
  // served sliced (limit changes rotate the start point).
  const order = nonEmpty.map(([p]) => p).sort();
  const startIdx = order.length > 0 ? limit % order.length : 0;
  const rotated = [...order.slice(startIdx), ...order.slice(0, startIdx)];

  const interleaved: UnifiedPost[] = [];
  let lastProtocol: string | null = null;
  let consecutive = 0;

  while (interleaved.length < limit) {
    let pushedThisPass = false;
    for (const proto of rotated) {
      const arr = byProtocol.get(proto);
      if (!arr || arr.length === 0) continue;

      // Live sources = protocols that still have posts to emit this pass.
      let liveSources = 0;
      for (const a of byProtocol.values()) if (a.length > 0) liveSources++;

      // Enforce the contiguous-run cap: never exceed `maxConsecutive` posts
      // from the same protocol in a row while OTHER protocols still have
      // content. When the protocol is the sole remaining source, the cap is
      // waived so the feed still fills to `limit` (volume over diversity —
      // there is nothing left to interleave with).
      const wouldExceedCap =
        proto === lastProtocol && consecutive >= maxConsecutive && liveSources > 1;
      if (wouldExceedCap) continue;

      const take = Math.min(maxConsecutive, arr.length, limit - interleaved.length);
      for (let i = 0; i < take; i++) {
        interleaved.push(arr.shift()!);
      }
      consecutive = proto === lastProtocol ? consecutive + take : take;
      lastProtocol = proto;
      pushedThisPass = true;
      if (interleaved.length >= limit) break;
    }
    // No protocol produced anything this pass — everything is exhausted.
    if (!pushedThisPass) break;
  }

  return interleaved;
}

export async function buildFeed(
  protocols: string[],
  limit: number,
): Promise<{ posts: UnifiedPost[]; meta: Record<string, unknown> }> {
  // Lazy-initialize reliability on first data request (not at module import)
  initializeReliability();

  const activeProtocols = resolveActiveProtocols(protocols);
  const key = feedCacheKey(activeProtocols);

  // 1) Fresh cache hit — serve immediately (sliced to the requested limit)
  const cached = getCachedFeed(key);
  if (cached) {
    if (cached.posts.length >= limit) {
      return {
        posts: cached.posts.slice(0, limit),
        meta: {
          ...cached.meta,
          limit,
          total: Math.min(cached.posts.length, limit),
          source: cached.meta.source ?? 'cached',
        },
      };
    }
    // Cached result is smaller than the requested limit — rebuild below
  }

  // 2) Single-flight: coalesce concurrent requests for the same protocol set
  const inFlight = feedInFlight.get(key);
  if (inFlight) return inFlight;

  const promise = buildFeedInternal(activeProtocols, limit);
  feedInFlight.set(key, promise);
  try {
    const result = await promise;
    setCachedFeed(key, result);
    return cloneFeedResult(result);
  } finally {
    feedInFlight.delete(key);
  }
}

/** Uncached feed aggregation — used by buildFeed() behind the result cache. */
async function buildFeedInternal(
  activeProtocols: string[],
  limit: number,
): Promise<{ posts: UnifiedPost[]; meta: Record<string, unknown> }> {
  const perProtocol: Record<string, number> = {};
  const errors: string[] = [];
  const notices: string[] = [];
  const providerSources: Record<string, string> = {};
  const cacheAges: Record<string, number> = {};

  // ── Discovery mode ─────────────────────────────────────────────────
  // Multi-protocol feeds (home, for-you, trending) get 1-2 extra protocols
  // injected from DISCOVERY_POOL — content the user didn't opt into, so the
  // feed occasionally surfaces diverse protocols. Single-protocol feeds
  // (e.g. /api/feed/nostr) stay pure. Discovery posts are flagged
  // `_discovery` and surface naturally through the capped interleave.
  const discoveryProtocols =
    activeProtocols.length >= 3 ? selectDiscoveryProtocols(activeProtocols) : [];
  const fetchProtocols = [...new Set([...activeProtocols, ...discoveryProtocols])];

  const perProviderLimit = Math.max(
    3,
    Math.ceil((limit * 1.2) / Math.max(fetchProtocols.length, 1)),
  );
  // Global per-provider timeout. 5s bounds cold-start aggregation latency to
  // ~5s (slowest expected providers: Hubble Farcaster 3.5s, Mastodon/GTS 5s)
  // while slow/broken providers (e.g. Reddit multi-strategy) get cut fast
  // instead of stalling the whole feed for 15-20s. The result cache makes any
  // per-provider truncation invisible to repeat requests.
  const FETCH_TIMEOUT_MS = 5000;
  const MAX_CONCURRENT = 20; // Limit to 20 concurrent provider fetches to prevent OOM

  const results = await runWithConcurrencyLimit(
    fetchProtocols,
    MAX_CONCURRENT,
    async (protocol) => {
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
            // Failover fallbacks can be slow (unbounded before) — cap them so a
            // failed provider can never extend the feed latency past 3s extra.
            const failoverResult = await withTimeout(
              failoverRouter.execute(protocol, perProviderLimit),
              3_000,
              `failover:${protocol}`,
            );
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
    },
  );

  const allPosts: UnifiedPost[] = [];
  for (const result of results) {
    const { protocol, posts, error, notice, source, cacheAgeMs } = result as {
      protocol?: string;
      posts?: UnifiedPost[];
      source?: string;
      notice?: string;
      cacheAgeMs?: number;
      error?: string;
    };
    if (!protocol) continue; // Skip results that might be from failed providers
    perProtocol[protocol] = posts?.length ?? 0;
    providerSources[protocol] = source ?? 'live';
    if (cacheAgeMs) cacheAges[protocol] = cacheAgeMs;
    if (posts) {
      // Flag discovery-mode posts so callers can distinguish injected content.
      const isDiscovery = discoveryProtocols.includes(protocol);
      for (const p of posts) {
        if (isDiscovery) (p as Record<string, unknown>)._discovery = true;
      }
      allPosts.push(...posts);
    }
    if (error) errors.push(`${protocol}: ${error}`);
    if (notice) notices.push(`${protocol}: ${notice}`);
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
        discoveryProtocols,
        page: 1,
        fetchedAt: Date.now(),
        source: 'demo',
        isDemo: true,
        demoNote:
          'Connect more protocols to see real content. Configure Nostr, Farcaster, Bluesky, or Mastodon at app.degenfeed.xyz/settings',
      },
    };
  }

  const deduped = dedupeAndInterleave(allPosts, limit);

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
      discoveryProtocols: discoveryProtocols.length > 0 ? discoveryProtocols : undefined,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: Date.now(),
      source: 'live',
    },
  };
}

/**
 * Pre-warm the feed result cache at startup so the first user request after a
 * bridge restart hits cache instead of re-aggregating 30+ providers.
 *
 * Fire-and-forget: never throws. Warm the protocol sets the app actually
 * requests (HTTP default home set, the frontend 7-protocol set, and trending)
 * at limit=50 so the limit-agnostic cache can serve any request with a smaller
 * limit while keeping the prewarm itself fast.
 *
 * Also seeds the HTTP-level stale-while-revalidate cache (feedCache) with the
 * exact keys the route handlers use, so even the very first request after a
 * restart is served from cache instead of triggering a synchronous rebuild.
 */
export async function prewarmFeedCache(): Promise<void> {
  const started = Date.now();
  try {
    console.log('[feeds] Pre-warming feed result cache...');

    // Slow-protocol direct warm-up FIRST, bypassing the 5s buildFeed fetch
    // wrapper (FETCH_TIMEOUT_MS). These providers hold their own internal
    // caches (rssCache in rss.ts, nostr profileCache, peertube category
    // cache) that buildFeed's per-provider timeout would starve:
    //   - RSS cold fetch spans ~262 feeds and takes 8-9s — far over the 5s
    //     buildFeed cap. Warming it directly here means /api/feed/rss and
    //     the home feed hit a full 50-post rssCache instead of a poisoned
    //     few-post result written by the killed background continuation.
    //   - PeerTube local + federated instance fan-out benefits from the
    //     category map being cached before the first user request.
    //   - Nostr relay connections + profile cache benefit from one early
    //     fan-out while the event loop is still quiet.
    // Each direct warm is individually fire-and-forget with allSettled so a
    // slow provider can never block the rest of the prewarm or crash it.
    await Promise.allSettled([fetchRssPosts(50), fetchPeerTubePosts(20), fetchNostrPosts(20)]);
    console.log(`[feeds] Slow-protocol caches pre-warmed in ${Date.now() - started}ms`);

    const targets: Array<{ protocols: string[]; limit: number }> = [
      // limit=50: RSS provider early-exits after ~50 raw posts (~3s total build),
      // and the limit-agnostic cache serves any request with limit <= 50.
      { protocols: DEFAULT_HOME_PROTOCOLS, limit: 50 },
      {
        protocols: ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'reddit', 'rss'],
        limit: 50,
      },
      { protocols: ['mastodon', 'reddit', 'rss', 'nostr', 'farcaster', 'lens'], limit: 50 },
    ];
    for (const target of targets) {
      await buildFeed(target.protocols, target.limit);
      // Seed the HTTP-level SWR cache with the same key shape index.ts uses
      // (`feed:${protocols.sort()}:${limit}`) so a first hit is instant.
      const httpKey = `feed:${[...target.protocols].sort().join(',')}:${target.limit}`;
      await feedCache.getOrFetch(
        httpKey,
        async () => {
          const result = await buildFeed(target.protocols, target.limit);
          return { posts: result.posts, meta: result.meta };
        },
        FEED_CACHE_TTL_MS,
      );
    }
    console.log(`[feeds] Feed cache pre-warmed in ${Date.now() - started}ms`);
  } catch (err) {
    console.error('[feeds] Feed cache pre-warm failed:', err);
  }
}

/**
 * Periodically re-warm the feed caches so they never fully expire between
 * user visits. Unref'd — does not keep the process alive.
 */
export function startFeedCacheRefresher(intervalMs = 55_000): NodeJS.Timeout {
  return setInterval(() => {
    void prewarmFeedCache();
  }, intervalMs).unref();
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
      'youtube',
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
      'gancio',
      'soundcloud',
      'bandcamp',
      'vimeo',
      'twitch',
      'wordpress',
      'nostr-groups',
      'rarible',
      'opensea',
      'lobsters',
      'snapshot',
      'tally',
      'juicebox',
      'unlock',
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
