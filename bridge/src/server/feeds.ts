import { fetchAetherPosts } from '../providers/aether';
import { fetchAkkomaPosts } from '../providers/akkoma';
// Bridge providers that exist but were never registered
import { fetchArenaPosts } from '../providers/arena';
import { fetchArweavePosts } from '../providers/arweave';
import { fetchBlueskyPosts } from '../providers/bluesky';
import { fetchBonfirePosts } from '../providers/bonfire';
// NEW PROTOCOL IMPORTS - 2026-07-26
import { fetchBookWyrmPosts } from '../providers/bookwyrm';
import { fetchCastopodPosts } from '../providers/castopod';
import { fetchCeramicPosts } from '../providers/ceramic';
import { fetchCyberConnectPosts } from '../providers/cyberconnect';
import { fetchDeSoPosts } from '../providers/deso';
// Adapter-based protocols — now have bridge wrappers
import { fetchDiasporaPosts } from '../providers/diaspora';
import { fetchDiscordPosts } from '../providers/discord';
import { fetchDiscoursePosts } from '../providers/discourse';
import { fetchDTubePosts } from '../providers/dtube';
import { fetchEpicyonPosts } from '../providers/epicyon';
// New 2026-07-25: Faircamp
import { fetchFaircampPosts } from '../providers/faircamp';
import { fetchFarcasterPosts } from '../providers/farcaster';
import { fetchFirefishPosts } from '../providers/firefish';
import { fetchForgejoPosts } from '../providers/forgejo';
import { fetchFriendicaPosts } from '../providers/friendica';
import { fetchFunkwhalePosts } from '../providers/funkwhale';
import { fetchGabPosts } from '../providers/gab';
import { fetchGhostPosts } from '../providers/ghost';
import { fetchGitHubPosts } from '../providers/github';
import { fetchMastodonPosts } from '../providers/gotosocial';
import { fetchGuppePosts } from '../providers/guppe';
import { fetchHeadscalePosts } from '../providers/headscale';
import { fetchHivePosts } from '../providers/hive';
import { fetchHubzillaPosts } from '../providers/hubzilla';
import { fetchHuddle01Posts } from '../providers/huddle01';
import { fetchIceshrimpPosts } from '../providers/iceshrimp';
import { fetchImmichPosts } from '../providers/immich';
import { fetchIpfsClusterPosts } from '../providers/ipfs-cluster';
import { fetchKbinPosts } from '../providers/kbin';
import { fetchKnownPosts } from '../providers/known';
import { fetchLBRYPosts } from '../providers/lbry';
import { fetchLemmyPosts } from '../providers/lemmy';
import { fetchLensPosts } from '../providers/lens';
import { fetchMatrixPosts } from '../providers/matrix';
import { fetchMbinPosts } from '../providers/mbin';
import { fetchMediaGoblinPosts } from '../providers/mediagoblin';
import { fetchMicroblogPosts } from '../providers/microblog';
import { fetchMindsPosts } from '../providers/minds';
import { fetchMirrorPosts } from '../providers/mirror';
import { fetchMisskeyPosts } from '../providers/misskey';
import { fetchMitraPosts } from '../providers/mitra';
import { fetchMobilizonPosts } from '../providers/mobilizon';
import { fetchNostrPosts } from '../providers/nostr';
import { fetchOrbisPosts } from '../providers/orbis';
import { fetchOwncastPosts } from '../providers/owncast';
import { fetchPeerTubePosts } from '../providers/peertube';
import { fetchPixelfedPosts } from '../providers/pixelfed';
import { fetchPleromaPosts } from '../providers/pleroma';
import { fetchPlumePosts } from '../providers/plume';
import { fetchPubliiPosts } from '../providers/publii';
import { fetchPushPosts } from '../providers/push';
import { fetchRedditPosts } from '../providers/redlib';
import { fetch as fetchRssPosts } from '../providers/rss';
import { fetchRssBridgePosts } from '../providers/rssbridge';
import { fetchScuttlebuttPosts } from '../providers/scuttlebutt';
import { fetchSessionPosts } from '../providers/session';
import { fetchSharkeyPosts } from '../providers/sharkey';
import { fetchSteemPosts } from '../providers/steem';
import { fetchStreamsPosts } from '../providers/streams';
import { fetchStrfryPosts } from '../providers/strfry';
import { fetchSublinksPosts } from '../providers/sublinks';
import { fetchSubsocialPosts } from '../providers/subsocial';
import { fetchTablelandPosts } from '../providers/tableland';
import { fetchTakahePosts } from '../providers/takahe';
// Bridge providers for telegram, discord, matrix, github
import { fetchTelegramPosts } from '../providers/telegram';
import { fetchThreadsPosts } from '../providers/threads';
import { fetchWriteFreelyPosts } from '../providers/writefreely';
import { fetchXmtpPosts } from '../providers/xmtp';
import { fetchYggdrasilPosts } from '../providers/yggdrasil';
import { fetchZoraPosts } from '../providers/zora';
import type { UnifiedPost } from './types';

type ProviderFetcher = (limit: number) => Promise<UnifiedPost[]>;

export const PROVIDERS: Record<string, { name: string; fetch: ProviderFetcher }> = {
  // ─── Original Providers ─────────────────────────────────────────
  mastodon: { name: 'Mastodon/GTS', fetch: fetchMastodonPosts },
  reddit: { name: 'Reddit/Redlib', fetch: fetchRedditPosts },
  rss: { name: 'RSS+Newsletter (100+ sources)', fetch: fetchRssPosts },
  newsletter: {
    name: 'Newsletters (Substack/Medium/Mirror/Paragraph/Ghost/Beehiiv)',
    fetch: async (limit) => {
      const { fetchNewsletterPosts } = await import('../providers/rss');
      return fetchNewsletterPosts(limit);
    },
  },
  rssbridge: { name: 'RSS-Bridge (legacy)', fetch: fetchRssBridgePosts },
  lemmy: { name: 'Lemmy', fetch: fetchLemmyPosts },
  peertube: { name: 'PeerTube', fetch: fetchPeerTubePosts },
  bluesky: { name: 'Bluesky/PDS', fetch: fetchBlueskyPosts },
  nostr: { name: 'Nostr', fetch: fetchNostrPosts },
  farcaster: { name: 'Farcaster', fetch: fetchFarcasterPosts },
  lens: { name: 'Lens', fetch: fetchLensPosts },
  pixelfed: { name: 'Pixelfed', fetch: fetchPixelfedPosts },
  threads: { name: 'Threads (Meta)', fetch: fetchThreadsPosts },
  zora: { name: 'Zora (NFT)', fetch: fetchZoraPosts },
  dtube: { name: 'DTube (Hive Video)', fetch: fetchDTubePosts },
  lbry: { name: 'Odysee/LBRY (Video)', fetch: fetchLBRYPosts },
  gab: { name: 'Gab / Dissenter', fetch: fetchGabPosts },
  minds: { name: 'Minds (Crypto Social)', fetch: fetchMindsPosts },
  aether: { name: 'Aether (P2P Communities)', fetch: fetchAetherPosts },
  scuttlebutt: { name: 'Scuttlebutt/SSB', fetch: fetchScuttlebuttPosts },
  hive: { name: 'Hive Blog', fetch: fetchHivePosts },
  mirror: { name: 'Mirror.xyz (Articles)', fetch: fetchMirrorPosts },
  funkwhale: { name: 'Funkwhale (Audio/Music)', fetch: fetchFunkwhalePosts },
  castopod: { name: 'Castopod (Podcasting)', fetch: fetchCastopodPosts },
  writefreely: { name: 'WriteFreely / Write.as', fetch: fetchWriteFreelyPosts },
  mediagoblin: { name: 'MediaGoblin', fetch: fetchMediaGoblinPosts },
  owncast: { name: 'Owncast (Live Streaming)', fetch: fetchOwncastPosts },

  // ─── ActivityPub Ecosystem (NEW) ────────────────────────────────
  bookwyrm: { name: 'BookWyrm (Federated Books)', fetch: fetchBookWyrmPosts },
  mobilizon: { name: 'Mobilizon (Federated Events)', fetch: fetchMobilizonPosts },
  forgejo: { name: 'Forgejo/Gitea (Git Repos)', fetch: fetchForgejoPosts },
  bonfire: { name: 'Bonfire (Federated Social)', fetch: fetchBonfirePosts },
  mitra: { name: 'Mitra (Lightweight Microblog)', fetch: fetchMitraPosts },
  takahe: { name: 'Takahē (Multi-Domain Fedi)', fetch: fetchTakahePosts },

  // ─── Blockchain Social (NEW) ────────────────────────────────────
  orbis: { name: 'Orbis (Ceramic Social)', fetch: fetchOrbisPosts },
  xmtp: { name: 'XMTP (Web3 Messaging)', fetch: fetchXmtpPosts },
  push: { name: 'Push Protocol (Web3 Notifications)', fetch: fetchPushPosts },
  huddle01: { name: 'Huddle01 (Decentralized Video)', fetch: fetchHuddle01Posts },

  // ─── Data/Storage (NEW) ─────────────────────────────────────────
  ceramic: { name: 'Ceramic/ComposeDB', fetch: fetchCeramicPosts },
  tableland: { name: 'Tableland (Decentralized DB)', fetch: fetchTablelandPosts },

  // ─── Unregistered Providers (existing files, newly bound) ─────────
  arena: { name: 'Arena.social (Social Trading on Avalanche)', fetch: fetchArenaPosts },
  deso: { name: 'DeSo / Bitclout (Layer-1 Social Blockchain)', fetch: fetchDeSoPosts },
  microblog: { name: 'Micro.blog (IndieWeb Microblogging)', fetch: fetchMicroblogPosts },
  session: { name: 'Session / SOGS (Privacy Messenger)', fetch: fetchSessionPosts },
  steem: { name: 'Steem (Blockchain Social Rewards)', fetch: fetchSteemPosts },
  subsocial: { name: 'Subsocial (Polkadot Social)', fetch: fetchSubsocialPosts },
  cyberconnect: { name: 'CyberConnect (Web3 Social Graph)', fetch: fetchCyberConnectPosts },

  // ─── Adapter-based Protocols (now bridged) ───────────────────────
  diaspora: { name: 'Diaspora* (Federated Social)', fetch: fetchDiasporaPosts },
  friendica: { name: 'Friendica (Fediverse Compatible)', fetch: fetchFriendicaPosts },
  pleroma: { name: 'Pleroma / Akkoma (Lightweight Fedi)', fetch: fetchPleromaPosts },
  misskey: { name: 'Misskey / Firefish (Rich Media Fedi)', fetch: fetchMisskeyPosts },

  // ─── Class-based providers (audius, rarible) ─────────────────────
  audius: {
    name: 'Audius (Decentralized Music)',
    fetch: async (limit: number) => {
      const { AudiusProvider } = await import('../providers/audius');
      const p = new AudiusProvider();
      const raw = await p.fetch({ limit } as any);
      return (raw || []).slice(0, limit).map((r: any) => p.normalize(r));
    },
  },
  rarible: {
    name: 'Rarible Protocol (NFT Market Activity)',
    fetch: async (limit: number) => {
      const { RaribleProvider } = await import('../providers/rarible');
      const p = new RaribleProvider();
      const raw = await p.fetch({ limit } as any);
      return (raw || []).slice(0, limit).map((r: any) => p.normalize(r));
    },
  },

  // ─── New Headless Protocol: Faircamp ─────────────────────────────
  faircamp: { name: 'Faircamp (Self-Hosted Music Sites)', fetch: fetchFaircampPosts },

  // ─── Messaging & Social Platforms ──────────────────────────────
  telegram: { name: 'Telegram (Channels & Groups)', fetch: fetchTelegramPosts },
  discord: { name: 'Discord (Communities)', fetch: fetchDiscordPosts },
  matrix: { name: 'Matrix (Decentralized Chat)', fetch: fetchMatrixPosts },
  github: { name: 'GitHub (Dev Activity)', fetch: fetchGitHubPosts },

  // ─── ActivityPub Extras (moved from DEFAULT_PREFERENCES) ──────────
  kbin: { name: 'Kbin / Mbin (Federated Hybrid)', fetch: fetchKbinPosts },
  hubzilla: { name: 'Hubzilla (Nomadic Identity)', fetch: fetchHubzillaPosts },
  streams: { name: 'Streams (Nomadic Identity)', fetch: fetchStreamsPosts },
  guppe: { name: 'Guppe (Federated Groups)', fetch: fetchGuppePosts },
  epicyon: { name: 'Epicyon (Ultralight ActivityPub)', fetch: fetchEpicyonPosts },
  sublinks: { name: 'Sublinks (Lightweight Lemmy)', fetch: fetchSublinksPosts },
  firefish: { name: 'Firefish (Misskey Fork)', fetch: fetchFirefishPosts },
  iceshrimp: { name: 'Iceshrimp (Misskey Fork)', fetch: fetchIceshrimpPosts },
  sharkey: { name: 'Sharkey (Misskey + Mastodon API)', fetch: fetchSharkeyPosts },
  akkoma: { name: 'Akkoma (Pleroma Fork)', fetch: fetchAkkomaPosts },

  // ─── FINAL PUSH: New Protocols (2026-07-27) ─────────────────────────
  plume: { name: "'Plume (Federated Blogging)'", fetch: fetchPlumePosts },
  known: { name: "'Known (IndieWeb Publishing)'", fetch: fetchKnownPosts },
  ipfsCluster: { name: "'IPFS Cluster (Decentralized Pinning)'", fetch: fetchIpfsClusterPosts },
  arweave: { name: "'Arweave (Permaweb Gateway)'", fetch: fetchArweavePosts },
  strfry: { name: "'strfry (Nostr Search Relay)'", fetch: fetchStrfryPosts },
  publii: { name: "'Publii (Desktop Static CMS)'", fetch: fetchPubliiPosts },
  mbin: { name: 'Mbin (Active Kbin Fork)', fetch: fetchMbinPosts },
  immich: { name: 'Immich (Self-Hosted Photos)', fetch: fetchImmichPosts },
  discourse: { name: 'Discourse (Forum + ActivityPub)', fetch: fetchDiscoursePosts },
  ghost: { name: 'Ghost (Headless CMS)', fetch: fetchGhostPosts },
  headscale: { name: 'Headscale (Mesh VPN)', fetch: fetchHeadscalePosts },
  yggdrasil: { name: 'Yggdrasil (Decentralized Mesh)', fetch: fetchYggdrasilPosts },
};

/** Race a promise against a timeout (milliseconds) */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[bridge] ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Build a deduplicated feed from multiple protocols */
export async function buildFeed(
  protocols: string[],
  limit: number,
): Promise<{ posts: UnifiedPost[]; meta: Record<string, unknown> }> {
  const perProtocol: Record<string, number> = {};
  const errors: string[] = [];
  const notices: string[] = [];

  const activeProtocols = protocols.filter((p) => p in PROVIDERS);
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
      'bookwyrm',
      'bonfire',
    );

  const perProviderLimit = Math.max(5, Math.ceil((limit * 1.5) / activeProtocols.length));
  const FETCH_TIMEOUT_MS = 10000; // 10s per-provider timeout
  const results = await Promise.allSettled(
    activeProtocols.map(async (protocol) => {
      const provider = PROVIDERS[protocol];
      if (!provider) return { protocol, posts: [] as UnifiedPost[] };
      try {
        const posts = await withTimeout(
          provider.fetch(perProviderLimit),
          FETCH_TIMEOUT_MS,
          `provider:${protocol}`,
        );
        return { protocol, posts };
      } catch (err) {
        return {
          protocol,
          posts: [] as UnifiedPost[],
          error: err instanceof Error ? err.message : 'unknown error',
        };
      }
    }),
  );

  const allPosts: UnifiedPost[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { protocol, posts, error } = result.value;
      perProtocol[protocol] = posts.length;
      allPosts.push(...posts);
      if (error) errors.push(`${protocol}: ${error}`);
    } else
      errors.push(
        `provider: ${result.reason instanceof Error ? result.reason.message : 'unknown'}`,
      );
  }

  for (const [protocol, count] of Object.entries(perProtocol))
    console.log(`[bridge] ${protocol}: ${count} posts`);

  if (allPosts.length === 0) {
    notices.push('All content sources returned no data. Check that backend services are running.');
    return {
      posts: [],
      meta: {
        total: 0,
        limit,
        perProtocol,
        errors: errors.length > 0 ? errors : undefined,
        notices,
        page: 1,
        fetchedAt: Date.now(),
        source: 'live',
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

  console.log(
    `[bridge] Built feed: ${deduped.length} posts from ${Object.keys(perProtocol).length} sources`,
  );
  return {
    posts: deduped,
    meta: {
      total: deduped.length,
      limit,
      perProtocol,
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
      // ── Tier 1: Core Social ──────────────────────────────
      'mastodon',
      'nostr',
      'farcaster',
      'lens',
      'bluesky',
      // ── Tier 2: Established ──────────────────────────────
      'reddit',
      'rss',
      'lemmy',
      'peertube',
      'pixelfed',
      'dtube',
      'lbry',
      'hive',
      'mirror',
      'funkwhale',
      'castopod',
      'writefreely',
      'pleroma',
      'misskey',
      'subsocial',
      'steem',
      // ── Tier 3: ActivityPub Ecosystem ────────────────────
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
      // ── Tier 4: Experimental ─────────────────────────────
      'gab',
      'minds',
      'aether',
      'scuttlebutt',
      'deso',
      'session',
      'cyberconnect',
      'arena',
      'microblog',
      'faircamp',
      'orbis',
      'ceramic',
      // ── Messaging & Dev Platforms ─────────────────────────
      'telegram',
      'discord',
      'matrix',
      'github',
      // ── Tier 5: Infrastructure ───────────────────────────
      'xmtp',
      'push',
      'huddle01',
      'tableland',
      // ── NFT / Music ──────────────────────────────────────
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
