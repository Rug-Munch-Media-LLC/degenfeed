import { fetchBlueskyPosts } from '../providers/bluesky';
import { fetchFarcasterPosts } from '../providers/farcaster';
import { fetchMastodonPosts } from '../providers/gotosocial';
import { fetchLemmyPosts } from '../providers/lemmy';
import { fetchLensPosts } from '../providers/lens';
import { fetchNostrPosts } from '../providers/nostr';
import { fetchPeerTubePosts } from '../providers/peertube';
import { fetchPixelfedPosts } from '../providers/pixelfed';
import { fetchRedditPosts } from '../providers/redlib';
import { fetch as fetchRssPosts } from '../providers/rss';
import { fetchRssBridgePosts } from '../providers/rssbridge';
import { fetchThreadsPosts } from '../providers/threads';
import { fetchZoraPosts } from '../providers/zora';
import { fetchDTubePosts } from '../providers/dtube';
import { fetchLBRYPosts } from '../providers/lbry';
import { fetchGabPosts } from '../providers/gab';
import { fetchMindsPosts } from '../providers/minds';
import { fetchAetherPosts } from '../providers/aether';
import { fetchScuttlebuttPosts } from '../providers/scuttlebutt';
import { fetchHivePosts } from '../providers/hive';
import { fetchMirrorPosts } from '../providers/mirror';
import { fetchCastopodPosts } from '../providers/castopod';
import { fetchFunkwhalePosts } from '../providers/funkwhale';
import { fetchMediaGoblinPosts } from '../providers/mediagoblin';
import { fetchOwncastPosts } from '../providers/owncast';
import { fetchWriteFreelyPosts } from '../providers/writefreely';
// NEW PROTOCOL IMPORTS - 2026-07-26
import { fetchBookWyrmPosts } from '../providers/bookwyrm';
import { fetchMobilizonPosts } from '../providers/mobilizon';
import { fetchForgejoPosts } from '../providers/forgejo';
import { fetchBonfirePosts } from '../providers/bonfire';
import { fetchMitraPosts } from '../providers/mitra';
import { fetchTakahePosts } from '../providers/takahe';
import { fetchOrbisPosts } from '../providers/orbis';
import { fetchXmtpPosts } from '../providers/xmtp';
import { fetchPushPosts } from '../providers/push';
import { fetchHuddle01Posts } from '../providers/huddle01';
import { fetchCeramicPosts } from '../providers/ceramic';
import { fetchTablelandPosts } from '../providers/tableland';
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
};

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
      'mastodon', 'reddit', 'rss', 'lemmy', 'bluesky', 'nostr',
      'farcaster', 'lens', 'pixelfed', 'bookwyrm', 'bonfire',
    );

  const perProviderLimit = Math.max(5, Math.ceil((limit * 1.5) / activeProtocols.length));
  const results = await Promise.allSettled(
    activeProtocols.map(async (protocol) => {
      const provider = PROVIDERS[protocol];
      if (!provider) return { protocol, posts: [] as UnifiedPost[] };
      try {
        const posts = await provider.fetch(perProviderLimit);
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
        total: 0, limit, perProtocol,
        errors: errors.length > 0 ? errors : undefined,
        notices, page: 1, fetchedAt: Date.now(), source: 'live',
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
      total: deduped.length, limit, perProtocol,
      errors: errors.length > 0 ? errors : undefined,
      notices: notices.length > 0 ? notices : undefined,
      fetchedAt: Date.now(), source: 'live',
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
    crypto: 100, defi: 90, nft: 50, ai: 70, solana: 60,
    ethereum: 80, books: 40, events: 50, music: 40, video: 30,
  },
  algorithmTransparent: false,
  freshnessPreference: 50,
  creatorDiversity: 5,
  exploreRatio: 30,
  activePreset: null,
  feedMixConfig: {
    sources: [
      'mastodon', 'reddit', 'rss', 'lemmy', 'peertube',
      'bluesky', 'nostr', 'farcaster', 'lens', 'pixelfed',
      'dtube', 'lbry', 'gab', 'minds', 'aether',
      'scuttlebutt', 'hive', 'mirror', 'funkwhale', 'castopod',
      'writefreely', 'mediagoblin', 'owncast',
      // NEW SOURCES
      'bookwyrm', 'mobilizon', 'forgejo', 'bonfire', 'mitra', 'takahe',
      'orbis', 'xmtp', 'push', 'huddle01', 'ceramic', 'tableland',
    ],
    contentTypes: {
      posts: 100, images: 40, videos: 20, links: 30,
      threads: 40, books: 25, events: 20, code: 15,
      notifications: 10, live: 15, data: 10,
    },
    recencyWeight: 1.0,
    engagementWeight: 1.0,
    exploreRatio: 30,
  },
  savedMixes: [],
};
