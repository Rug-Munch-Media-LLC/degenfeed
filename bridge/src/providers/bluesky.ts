/**
 * Bluesky / PDS Provider
 *
 * Fetches posts from the local Bluesky PDS instance (port 3012).
 * Uses the AT Protocol (XRPc) to get posts from the local PDS and from
 * the public Bluesky API (public.api.bsky.app).
 *
 * The local PDS is a self-hosted Personal Data Server that handles
 * account data for bluesky users on our domain.
 *
 * Since local PDS may have limited content, also fetch from the public
 * Bluesky API for trending crypto/tech content.
 */

import type { UnifiedPost } from '../server';

const PDS_BASE = 'http://127.0.0.1:3012';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

// Crypto/tech actors to follow
const CURATED_ACTORS = [
  'jay.bsky.social',
  'naval.bsky.social',
  'balajis.com',
  'vitalik.eth.xyz',
  'a16z.com',
  'coinbase.com',
  'solana.com',
  'defi.bsky.social',
  'pmarca.bsky.social',
  'cdixon.bsky.social',
  'tier10k.bsky.social',
  'autismcapital.bsky.social',
  'karbonbased.bsky.social',
  'crypto_birb.bsky.social',
];

// Search queries for crypto content
const SEARCH_QUERIES = [
  'bitcoin OR btc',
  'ethereum OR eth',
  'solana',
  'crypto',
  'defi',
  'ai',
  'web3',
];

// ─── Types ───────────────────────────────────────────────────────────

interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      $type?: string;
      external?: { uri: string; title?: string; description?: string };
      images?: Array<{ image: { ref: { link: string } }; alt: string }>;
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

interface BskyFeedResponse {
  feed?: Array<{ post: BskyPostView }>;
  posts?: BskyPostView[];
  cursor?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function guessNiches(text: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower)) niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower)) niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower)) niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp)\b/.test(lower)) niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower)) niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf|compliance)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower)) niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (/\b(web3|blockchain|wallet|did)\b/.test(lower)) niches.push('web3');
  if (/\b(rust|typescript|python|programming|code|dev)\b/.test(lower)) niches.push('tech');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ─────────────────────────────────────────────────────────

export function postToUnified(post: BskyPostView): UnifiedPost {
  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  if (post.record.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.record.embed.external.uri,
      meta: {
        title: post.record.embed.external.title,
        description: post.record.embed.external.description,
      },
    });
  }

  return {
    id: `bluesky:${post.uri}`,
    protocol: 'bluesky',
    author: {
      id: `bluesky:${post.author.did}`,
      primary: { protocol: 'bluesky', id: post.author.did },
      handles: { bluesky: post.author.handle },
      displayName: post.author.displayName || post.author.handle,
      bio: '',
      avatarUrl: post.author.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { did: post.author.did },
    },
    text: post.record.text,
    embeds,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(post.record.text),
  };
}

// ─── Fetch from local PDS ───────────────────────────────────────────

async function fetchFromPds(_limit: number): Promise<UnifiedPost[]> {
  try {
    // First get the PDS info
    const infoRes = await fetch(`${PDS_BASE}/xrpc/com.atproto.server.describeServer`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!infoRes.ok) return [];

    const info = (await infoRes.json()) as { did?: string };
    if (!info.did) return [];

    // Try to get recent posts via the sync endpoint
    const syncRes = await fetch(
      `${PDS_BASE}/xrpc/com.atproto.sync.getLatestCommit?did=${encodeURIComponent(info.did)}`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!syncRes.ok) return [];

    // PDS is running - try to get timeline-like data
    // The PDS may not have bsky endpoints; try the public API instead
    return [];
  } catch {
    return [];
  }
}

// ─── Fetch from public Bluesky API ──────────────────────────────────

async function fetchAuthorFeed(actor: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${Math.min(limit, 50)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as BskyFeedResponse;
    if (!data.feed) return [];

    return data.feed
      .map((f) => f.post)
      .filter(Boolean)
      .slice(0, limit)
      .map(postToUnified);
  } catch {
    return [];
  }
}

async function searchPosts(query: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${BSKY_PUBLIC}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${Math.min(limit, 50)}&sort=latest`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as BskyFeedResponse;
    if (!data.posts) return [];

    return data.posts.slice(0, limit).map(postToUnified);
  } catch {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────

export async function fetchBlueskyPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Try local PDS
  const pdsPosts = await fetchFromPds(Math.ceil(limit / 4));
  all.push(...pdsPosts);

  // Fetch from curated actors
  const actorsToFetch = CURATED_ACTORS.slice(0, 6);
  const actorPromises = actorsToFetch.map((actor) =>
    fetchAuthorFeed(actor, Math.max(2, Math.ceil(limit / actorsToFetch.length))),
  );
  const actorResults = await Promise.allSettled(actorPromises);
  for (const r of actorResults) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // If we don't have enough, search
  if (all.length < limit / 2) {
    const searchPromises = SEARCH_QUERIES.slice(0, 4).map((q) =>
      searchPosts(q, Math.max(3, Math.ceil(limit / 4))),
    );
    const searchResults = await Promise.allSettled(searchPromises);
    for (const r of searchResults) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    const key = p.text.slice(0, 60);
    if (!seen.has(key) && deduped.length < limit) {
      seen.add(key);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Bluesky: ${deduped.length} posts (PDS: ${pdsPosts.length})`);
  return deduped;
}
