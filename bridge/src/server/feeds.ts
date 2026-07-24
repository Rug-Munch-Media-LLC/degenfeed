import { fetchBlueskyPosts } from '../providers/bluesky';
import { fetchFarcasterPosts } from '../providers/farcaster';
import { fetchMastodonPosts } from '../providers/gotosocial';
import { fetchLemmyPosts } from '../providers/lemmy';
import { fetchLensPosts } from '../providers/lens';
import { fetchNostrPosts } from '../providers/nostr';
import { fetchPeerTubePosts } from '../providers/peertube';
import { fetchPixelfedPosts } from '../providers/pixelfed';
import { fetchRedditPosts } from '../providers/redlib';
import { fetchRssBridgePosts } from '../providers/rssbridge';
import { fetchZoraPosts } from '../providers/zora';
import type { UnifiedPost } from './types';

type ProviderFetcher = (limit: number) => Promise<UnifiedPost[]>;

export const PROVIDERS: Record<string, { name: string; fetch: ProviderFetcher }> = {
  mastodon: { name: 'Mastodon/GTS', fetch: fetchMastodonPosts },
  reddit: { name: 'Reddit/Redlib', fetch: fetchRedditPosts },
  rss: { name: 'RSS-Bridge', fetch: fetchRssBridgePosts },
  lemmy: { name: 'Lemmy', fetch: fetchLemmyPosts },
  peertube: { name: 'PeerTube', fetch: fetchPeerTubePosts },
  bluesky: { name: 'Bluesky/PDS', fetch: fetchBlueskyPosts },
  nostr: { name: 'Nostr', fetch: fetchNostrPosts },
  farcaster: { name: 'Farcaster', fetch: fetchFarcasterPosts },
  lens: { name: 'Lens', fetch: fetchLensPosts },
  pixelfed: { name: 'Pixelfed', fetch: fetchPixelfedPosts },
  zora: { name: 'Zora (NFT)', fetch: fetchZoraPosts },
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
      'mastodon',
      'reddit',
      'rss',
      'lemmy',
      'bluesky',
      'nostr',
      'farcaster',
      'lens',
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
  topicWeights: { crypto: 100, defi: 90, nft: 50, ai: 70, solana: 60, ethereum: 80 },
  algorithmTransparent: false,
  freshnessPreference: 50,
  creatorDiversity: 5,
  exploreRatio: 30,
  activePreset: null,
  feedMixConfig: {
    sources: [
      'mastodon',
      'reddit',
      'rss',
      'lemmy',
      'peertube',
      'bluesky',
      'nostr',
      'farcaster',
      'lens',
      'pixelfed',
    ],
    contentTypes: { posts: 100, images: 40, videos: 20, links: 30, threads: 40 },
    recencyWeight: 1.0,
    engagementWeight: 1.0,
    exploreRatio: 30,
  },
  savedMixes: [],
};
