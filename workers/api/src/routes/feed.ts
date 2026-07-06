import { BskyClient } from '@degenfeed/bluesky-sdk';
import { HubClient } from '@degenfeed/farcaster-sdk';
import { LensClient } from '@degenfeed/lens-sdk';
import { RelayPool } from '@degenfeed/nostr-sdk';
import { type RankingContext, rank } from '@degenfeed/ranking';
import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

const FALLBACK_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
];
const FALLBACK_HUBS = [
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
];
const LENS_FALLBACK = ['https://api-v2.lens.dev/graphql', 'https://api.lens.xyz/graphql'];
const BSKY_FALLBACK = 'https://public.api.bsky.app';

export async function handleHomeFeed(request: Request, env: Env): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const requestedProtocols = (params.get('protocols') ?? 'nostr,farcaster').split(
    ',',
  ) as Protocol[];
  const limit = Number(params.get('limit')) || 25;

  const allPosts: UnifiedPost[] = [];
  const errors: string[] = [];

  // 1. Nostr
  if (requestedProtocols.includes('nostr')) {
    try {
      const relayUrls = (env.RELAY_URLS ?? '').split(',').filter(Boolean);
      const pool = new RelayPool(relayUrls.length > 0 ? relayUrls : FALLBACK_RELAYS, {
        eoseTimeout: 2000,
      });
      const events = await pool.list({ kinds: [1], limit: limit * 3 }, 3000);
      pool.disconnectAll();
      for (const ev of events) {
        allPosts.push({
          id: `nostr:${ev.id}`,
          protocol: 'nostr' as Protocol,
          author: {
            id: `nostr:${ev.pubkey}`,
            primary: { protocol: 'nostr' as const, id: ev.pubkey },
            handles: {
              nostr: ev.pubkey,
              farcaster: null,
              lens: null,
              bluesky: null,
              threads: null,
              rss: null,
              mastodon: null,
            },
            displayName: ev.pubkey.slice(0, 12),
            bio: '',
            avatarUrl: '',
            verified: [],
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: { nostrPubkey: ev.pubkey },
          },
          text: ev.content,
          embeds: [],
          createdAt: ev.created_at * 1000,
          metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: ev,
          niches: [],
        });
      }
    } catch (e) {
      errors.push(`nostr: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // 2. Farcaster
  if (requestedProtocols.includes('farcaster')) {
    try {
      const hubUrl = env.FARCASTER_HUB_URL || FALLBACK_HUBS[0];
      if (hubUrl) {
        const client = new HubClient(hubUrl);
        const sampleFids = [1, 2, 3, 5650, 1234];
        const results = await Promise.allSettled(
          sampleFids.slice(0, 3).map((fid) => client.getCastsByFid(fid, Math.ceil(limit / 3))),
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            for (const cast of result.value) {
              allPosts.push(client.castToUnifiedPost(cast));
            }
          }
        }
      }
    } catch (e) {
      errors.push(`farcaster: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // 3. Lens
  if (requestedProtocols.includes('lens')) {
    try {
      const client = new LensClient(LENS_FALLBACK[0]);
      const pubs = await client.getPublications('0x01', Math.ceil(limit / 2));
      for (const pub of pubs) {
        allPosts.push({
          id: `lens:${pub.id}`,
          protocol: 'lens' as Protocol,
          author: {
            id: `lens:${pub.by.id}`,
            primary: { protocol: 'lens' as const, id: pub.by.id },
            handles: {
              nostr: null,
              farcaster: null,
              lens: pub.by.handle,
              bluesky: null,
              threads: null,
              rss: null,
              mastodon: null,
            },
            displayName: pub.by.metadata?.displayName ?? pub.by.handle,
            bio: '',
            avatarUrl: pub.by.metadata?.picture ?? '',
            verified: [],
            followerCount: 0,
            followingCount: 0,
            links: [],
            keys: {},
          },
          text: pub.metadata.content.slice(0, 500),
          embeds:
            pub.metadata.media?.map((m) => ({ kind: 'image' as const, url: m.original.url })) ?? [],
          createdAt: new Date(pub.createdAt).getTime(),
          metrics: {
            likes: pub.stats.totalAmountOfReactions,
            reposts: pub.stats.totalAmountOfMirrors,
            replies: pub.stats.totalAmountOfComments,
            quotes: 0,
          },
          engagement: {
            viewerLiked: false,
            viewerReposted: false,
            viewerBookmarked: false,
            raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
          },
          raw: pub,
          niches: [],
        });
      }
    } catch (e) {
      errors.push(`lens: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // 4. Bluesky
  if (requestedProtocols.includes('bluesky')) {
    try {
      const client = new BskyClient(BSKY_FALLBACK);
      const { posts: bskyPosts } = await client.getTimeline(limit);
      for (const post of bskyPosts) {
        allPosts.push(client.postToUnifiedPost(post));
      }
    } catch (e) {
      errors.push(`bluesky: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  // Rank
  let ranked = allPosts;
  if (ranked.length > 1) {
    const ctx: RankingContext = {
      viewer: null,
      recentAuthors: new Map(),
      sourceQuality: new Map(),
      viewerNiches: new Set(),
      followed: new Set(),
      now: Date.now(),
    };
    ranked = rank(ranked, ctx);
  }

  if (ranked.length === 0 && errors.length > 0) {
    return jsonResponse(
      { data: [], meta: { total: 0, limit, errors, note: 'All sources failed' } },
      200,
    );
  }
  return jsonResponse({
    data: ranked.slice(0, limit),
    meta: { total: ranked.length, limit, errors: errors.length > 0 ? errors : undefined },
  });
}

export async function handleTrendingFeed(request: Request, env: Env): Promise<Response> {
  const _limit = Number(new URL(request.url).searchParams.get('limit')) || 25;
  // Trending = home feed with broader fetch
  return handleHomeFeed(
    new Request(`${request.url}&protocols=nostr,farcaster,lens,bluesky,threads`),
    env,
  );
}
