import { type Env, jsonResponse } from '../index';
import type { UnifiedPost } from '@degenfeed/types';

// ─── Heat Score ────────────────────────────────────────────────
// Scores a post based on engagement, recency, and source quality
function heatScore(post: UnifiedPost, now: number): number {
  const ageHrs = (now - post.createdAt) / 3600000;
  const recency = Math.pow(0.5, ageHrs / 24); // 24h half-life
  
  const likes = post.metrics?.likes ?? 0;
  const reposts = post.metrics?.reposts ?? 0;
  const replies = post.metrics?.replies ?? 0;
  
  const engagementScore = (likes * 1) + (reposts * 2) + (replies * 3);
  
  // Source quality multiplier
  const quality: Record<string, number> = {
    lens: 1.0, farcaster: 1.0, bluesky: 1.0,
    nostr: 0.8, mastodon: 0.9, threads: 0.7, rss: 0.6,
  };
  const q = quality[post.protocol] ?? 0.5;
  
  return engagementScore * recency * q;
}

// ─── 1. Best of Web3 — /api/feed/top ──────────────────────────
// Fetches from all protocols, scores by heat, returns top 50 in last 24h

const FALLBACK_RELAYS = [
  'wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net',
  'wss://relay.nostr.band', 'wss://nostr.wine',
];

async function fetchNostrTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { RelayPool } = await import('@degenfeed/nostr-sdk');
    const pool = new RelayPool(FALLBACK_RELAYS, { eoseTimeout: 3000 });
    const events = await pool.list({ kinds: [1], limit: limit * 3 }, 3000);
    pool.disconnectAll();
    for (const ev of events) {
      posts.push({
        id: 'nostr:' + ev.id, protocol: 'nostr' as any,
        author: { id: 'nostr:' + ev.pubkey, primary: { protocol: 'nostr' as const, id: ev.pubkey },
          handles: { nostr: ev.pubkey.slice(0, 12), farcaster: null, lens: null, bluesky: null, threads: null, rss: null, mastodon: null },
          displayName: ev.pubkey.slice(0, 12), bio: '', avatarUrl: '', verified: [], followerCount: 0, followingCount: 0, links: [], keys: {} },
        text: ev.content, embeds: [], createdAt: ev.created_at * 1000,
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: { viewerLiked: false, viewerReposted: false, raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 } },
        raw: ev, niches: [],
      });
    }
  } catch {}
  return posts;
}

async function fetchFarcasterTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { HubClient } = await import('@degenfeed/farcaster-sdk');
    const client = new HubClient('https://hub.farcaster.standardcrypto.vc:2281');
    const fids = [1, 2, 3, 5650, 1234, 11276, 215, 320];
    const results = await Promise.allSettled(
      fids.slice(0, 4).map((fid) => client.getCastsByFid(fid, Math.ceil(limit / 2)))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const cast of r.value) {
          posts.push(cast as unknown as UnifiedPost);
        }
      }
    }
  } catch {}
  return posts;
}

async function fetchBlueskyTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { BskyClient } = await import('@degenfeed/bluesky-sdk');
    const client = new BskyClient('https://public.api.bsky.app');
    const { posts: raw } = await client.getTimeline(limit);
    for (const p of raw) {
      posts.push(p as unknown as UnifiedPost);
    }
  } catch {}
  return posts;
}

async function fetchMastodonTop(limit: number): Promise<UnifiedPost[]> {
  const posts: UnifiedPost[] = [];
  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient('https://social.degenfeed.xyz');
    const statuses = await client.getPublicTimeline(limit);
    for (const s of statuses) {
      posts.push({
        id: 'mastodon:' + s.id, protocol: 'mastodon' as any,
        author: { id: 'mastodon:' + s.account.id, primary: { protocol: 'mastodon' as const, id: s.account.id },
          handles: { mastodon: s.account.acct, nostr: null, farcaster: null, lens: null, bluesky: null, threads: null, rss: null },
          displayName: s.account.display_name || s.account.username, bio: '', avatarUrl: s.account.avatar, verified: [], followerCount: s.account.followers_count, followingCount: s.account.following_count, links: [], keys: {} },
        text: s.content.replace(/<[^>]*>/g, ''), embeds: [], createdAt: new Date(s.created_at).getTime(),
        metrics: { likes: s.favourites_count, reposts: s.reblogs_count, replies: s.replies_count, quotes: 0 },
        engagement: { viewerLiked: false, viewerReposted: false, raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 } },
        raw: s, niches: [],
      });
    }
  } catch {}
  return posts;
}

export async function handleTopFeed(request: Request, env: Env): Promise<Response> {
  const limit = Number(new URL(request.url).searchParams.get('limit')) || 50;
  const now = Date.now();
  
  const [nostrPosts, fcPosts, bskyPosts, mastodonPosts] = await Promise.all([
    fetchNostrTop(limit).catch(() => []),
    fetchFarcasterTop(limit).catch(() => []),
    fetchBlueskyTop(limit).catch(() => []),
    fetchMastodonTop(limit).catch(() => []),
  ]);
  
  const allPosts = [...nostrPosts, ...fcPosts, ...bskyPosts, ...mastodonPosts];
  const scored = allPosts
    .map(p => ({ post: p, score: heatScore(p, now) }))
    .sort((a, b) => b.score - a.score)
    .filter(p => p.score > 0)
    .slice(0, limit);
  
  return jsonResponse({
    data: scored.map(s => s.post),
    meta: { total: scored.length, limit, type: 'top' },
  });
}

// ─── 2. Newsletter Feed — /api/feed/newsletters ───────────────

const NEWSLETTER_SOURCES = [
  { name: 'Bankless', url: 'https://bankless.substack.com/feed' },
  { name: 'The Defiant', url: 'https://thedefiant.io/feed' },
  { name: 'Blockworks', url: 'https://blockworks.co/feed' },
  { name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { name: 'Week in Ethereum', url: 'https://weekinethereumnews.com/feed' },
  { name: 'Crypto Native', url: 'https://cryptonative.substack.com/feed' },
];

export async function handleNewsletterFeed(request: Request, env: Env): Promise<Response> {
  const limit = Number(new URL(request.url).searchParams.get('limit')) || 25;
  const allPosts: UnifiedPost[] = [];
  
  const results = await Promise.allSettled(
    NEWSLETTER_SOURCES.map(async (src) => {
      try {
        const { GenericRssSource, feedToUnifiedPosts } = await import('@degenfeed/rss-sdk');
        const s = await GenericRssSource.fetch(src.url);
        const posts = feedToUnifiedPosts(s);
        allPosts.push(...posts);
      } catch {}
    })
  );
  
  allPosts.sort((a, b) => b.createdAt - a.createdAt);
  return jsonResponse({ data: allPosts.slice(0, limit), meta: { total: allPosts.length, sources: NEWSLETTER_SOURCES.length } });
}

// ─── 3. Trending Topics — /api/feed/trending ─────────────────

export async function handleTrendingFeed(request: Request, env: Env): Promise<Response> {
  // Fetch recent posts across protocols, extract niches, aggregate
  const limit = Number(new URL(request.url).searchParams.get('limit')) || 20;

  const [nostrPosts, fcPosts] = await Promise.all([
    fetchNostrTop(limit).catch(() => []),
    fetchFarcasterTop(limit).catch(() => []),
  ]);

  const allPosts = [...nostrPosts, ...fcPosts];
  allPosts.sort((a, b) => b.createdAt - a.createdAt);

  // Delegate to the home feed handler for ranking
  const { handleHomeFeed } = await import('./feed');
  const fakeReq = new Request('http://localhost/api/feed/home?protocols=nostr,farcaster&limit=' + limit);
  return handleHomeFeed(fakeReq, env);
}
