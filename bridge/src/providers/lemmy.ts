/**
 * Lemmy Provider
 *
 * Fetches posts from the self-hosted Lemmy instance (port 8536) and from
 * public Lemmy instances via their v3 API. Lemmy is a federated Reddit
 * alternative running ActivityPub.
 *
 * The local instance at port 8536 has DegenFeed communities for crypto,
 * DeFi, NFTs, tech, and web3.
 */

import type { SchemaGuard, UnifiedPost } from '../server';

const LEMMY_LOCAL = 'http://127.0.0.1:8536';

/** Local DegenFeed communities */
const LOCAL_COMMUNITIES = ['crypto', 'defi', 'nfts', 'tech', 'meme', 'web3'];

/** External Lemmy instances for content diversity */
const EXTERNAL_INSTANCES = [
  { url: 'https://lemmy.world', communities: ['cryptocurrency', 'technology', 'web3'] },
  { url: 'https://lemmy.ml', communities: ['bitcoin', 'ethereum', 'technology'] },
  { url: 'https://sh.itjust.works', communities: ['cryptocurrency'] },
  { url: 'https://programming.dev', communities: ['programming', 'rust'] },
  { url: 'https://lemm.ee', communities: ['technology'] },
];

// ─── Types ───────────────────────────────────────────────────────────

interface LemmyPostData {
  id: number;
  name: string;
  body?: string;
  published: string;
  ap_id: string;
  url?: string;
  embed_title?: string;
  embed_description?: string;
  thumbnail_url?: string;
  nsfw: boolean;
  deleted: boolean;
  removed: boolean;
}

interface LemmyPerson {
  id: number;
  name: string;
  display_name?: string;
  avatar?: string;
  actor_id: string;
}

interface LemmyCommunity {
  id: number;
  name: string;
  title: string;
  actor_id: string;
}

interface LemmyCounts {
  upvotes: number;
  downvotes: number;
  score: number;
  comments: number;
}

interface LemmyPostView {
  post: LemmyPostData;
  creator?: { person: LemmyPerson };
  community?: { community: LemmyCommunity };
  counts: LemmyCounts;
}

interface LemmyResponse {
  posts: LemmyPostView[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function guessNiches(text: string, community: string): string[] {
  const niches: string[] = [];
  const lower = text.toLowerCase();
  const commLower = community.toLowerCase();
  if (/\b(btc|bitcoin|satoshi|halving)\b/.test(lower) || commLower === 'bitcoin')
    niches.push('bitcoin');
  if (/\b(eth|ethereum|vitalik|pectra)\b/.test(lower) || commLower === 'ethereum')
    niches.push('ethereum');
  if (/\b(sol|solana|spl)\b/.test(lower) || commLower === 'solana') niches.push('solana');
  if (/\b(defi|liquidity|yield|farm|lp|lending)\b/.test(lower) || commLower === 'defi')
    niches.push('defi');
  if (/\b(nft|art|collectible)\b/.test(lower) || commLower === 'nfts') niches.push('nft');
  if (/\b(ai|artificial|intelligence|llm|agent)\b/.test(lower)) niches.push('ai');
  if (/\b(sec|regulation|etf)\b/.test(lower)) niches.push('regulation');
  if (/\b(meme|pepe|dog|shib)\b/.test(lower) || commLower === 'meme') niches.push('memecoin');
  if (/\b(layer2|l2|arbitrum|optimism|base)\b/.test(lower)) niches.push('layer2');
  if (/\b(security|hack|exploit|audit)\b/.test(lower)) niches.push('security');
  if (
    /\b(rust|typescript|python|programming|code|dev)\b/.test(lower) ||
    commLower === 'programming' ||
    commLower === 'tech'
  )
    niches.push('tech');
  if (/\b(web3|blockchain|wallet)\b/.test(lower) || commLower === 'web3') niches.push('web3');
  if (niches.length === 0) niches.push('crypto');
  return niches;
}

// ─── Mapping ─────────────────────────────────────────────────────────

export function postToUnified(
  pv: LemmyPostView,
  hostname: string,
  communityName: string,
): UnifiedPost | null {
  if (!pv?.post) return null;
  const post = pv.post;
  const person = pv.creator?.person;
  const counts = pv.counts ?? { upvotes: 0, downvotes: 0, score: 0, comments: 0 };

  const text = post.body ? `${post.name}\n\n${post.body}` : post.name;
  const link = post.url || '';
  const createdAt = new Date(post.published).getTime();
  const authorName = person?.display_name || person?.name || `user@${communityName}`;
  const authorId = person ? String(person.id) : communityName;

  return {
    id: `lemmy:${post.id}@${hostname}`,
    protocol: 'lemmy',
    author: {
      id: `lemmy:${authorId}@${hostname}`,
      primary: { protocol: 'lemmy', id: authorId },
      handles: { lemmy: `${person?.name ?? 'unknown'}@${hostname}` },
      displayName: authorName,
      bio: '',
      avatarUrl: person?.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [{ label: 'community', url: `https://${hostname}/c/${communityName}` }],
      keys: {},
    },
    text,
    embeds: link ? [{ kind: 'link', url: link }] : [],
    contentType: link ? 'link' : 'text',
    createdAt: Number.isNaN(createdAt) ? Date.now() : createdAt,
    metrics: {
      likes: counts.upvotes,
      reposts: 0,
      replies: counts.comments,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: counts.upvotes, reposts: 0, replies: counts.comments, quotes: 0 },
    },
    raw: pv,
    niches: guessNiches(text, communityName),
  };
}

// ─── Fetch from instance ────────────────────────────────────────────

async function fetchCommunityPosts(
  baseUrl: string,
  community: string,
  limit: number,
): Promise<UnifiedPost[]> {
  try {
    const hostname = new URL(baseUrl).hostname;
    const url = `${baseUrl}/api/v3/post/list?community_name=${encodeURIComponent(community)}&sort=Hot&limit=${Math.min(limit, 20)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as LemmyResponse;
    if (!data.posts) return [];

    return data.posts
      .map((pv) => postToUnified(pv, hostname, community))
      .filter((p): p is UnifiedPost => p !== null);
  } catch {
    return [];
  }
}

// ─── Main ────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'lemmy',
  name: 'Lemmy',
  description: 'Link aggregator and community discussions — local + external instances',
  endpoint: '/api/feed/lemmy',
  requiresAuth: false,
  contentType: 'mixed',
};

export async function fetchLemmyPosts(limit = 20): Promise<UnifiedPost[]> {
  const all: UnifiedPost[] = [];

  // Fetch from local Lemmy communities
  const localPromises = LOCAL_COMMUNITIES.map((comm) =>
    fetchCommunityPosts(LEMMY_LOCAL, comm, Math.ceil(limit / LOCAL_COMMUNITIES.length)),
  );

  const localResults = await Promise.allSettled(localPromises);
  let localCount = 0;
  for (const r of localResults) {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
      localCount += r.value.length;
    }
  }

  // If local gave us little, try external instances
  if (all.length < 5) {
    const externalTasks: Array<{ url: string; community: string }> = [];
    for (const inst of EXTERNAL_INSTANCES.slice(0, 3)) {
      for (const comm of inst.communities) {
        externalTasks.push({ url: inst.url, community: comm });
      }
    }
    const externalPromises = externalTasks.map((t) => fetchCommunityPosts(t.url, t.community, 3));
    const externalResults = await Promise.allSettled(externalPromises);
    for (const r of externalResults) {
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

  console.log(`[bridge] Lemmy: ${deduped.length} posts (local: ${localCount})`);
  return deduped;
}

/** @alias Use `fetch` as the standardized export name */
export const fetch = fetchLemmyPosts;
