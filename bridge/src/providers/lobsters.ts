/**
 * Lobsters bridge provider
 *
 * Integrates Lobste.rs — a computing-focused link aggregation community
 * similar to Hacker News but with a tagging system and high-quality discussion.
 *
 * API: Public JSON endpoints (no auth required for reads)
 * License: 3-Clause BSD
 * Repository: https://github.com/lobsters/lobsters
 *
 * Features:
 * - Top stories from the front page
 * - Tag-filtered stories (programming, crypto, ai, etc.)
 * - Recent comments and discussions
 * - Full-text story content
 *
 * Rate Limits: Generous, no auth needed for reads
 */

import type { UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

const LOBSTERS_API = process.env.LOBSTERS_API_URL || 'https://lobste.rs';

// ─── Types ─────────────────────────────────────────────────────────────

interface LobstersStory {
  short_id: string;
  short_id_url: string;
  created_at: string;
  title: string;
  url: string;
  score: number;
  comment_count: number;
  description: string;
  comments_url: string;
  submitter_user: {
    username: string;
    github_username?: string;
    twitter_username?: string;
  };
  tags: string[];
  marked_as_deleted: boolean;
  is_expired: boolean;
}

interface LobstersComment {
  short_id: string;
  created_at: string;
  updated_at?: string;
  is_deleted: boolean;
  is_moderated: boolean;
  score: number;
  comment: string;
  url: string;
  indentation: number;
  commenting_user: {
    username: string;
    github_username?: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function guessNiches(title: string, description: string, tags: string[]): string[] {
  const niches: string[] = [];
  const lower = `${title} ${description} ${tags.join(' ')}`.toLowerCase();

  if (
    /\b(programming|code|software|dev|engineering|rust|go|python|javascript|typescript|react|backend|frontend|system|design)\b/.test(
      lower,
    )
  )
    niches.push('tech');
  if (
    /\b(ai|artificial|intelligence|machine learning|llm|gpt|deep learning|neural|transformer)\b/.test(
      lower,
    )
  )
    niches.push('ai');
  if (/\b(crypto|blockchain|bitcoin|btc|ethereum|eth|web3|defi|nft|token|wallet)\b/.test(lower))
    niches.push('crypto');
  if (
    /\b(security|privacy|encryption|cryptography|vulnerability|exploit|hack|attack)\b/.test(lower)
  )
    niches.push('security');
  if (/\b(linux|unix|kernel|sysadmin|devops|infra|cloud|server|docker|kubernetes)\b/.test(lower))
    niches.push('oss');
  if (/\b(data|database|sql|nosql|analytics|big data|storage)\b/.test(lower)) niches.push('data');
  if (/\b(startup|business|founder|venture|funding|startup)\b/.test(lower)) niches.push('startup');
  if (/\b(compiler|language|parser|interpreter|runtime|vm|wasm)\b/.test(lower))
    niches.push('programming-languages');
  if (/\b(gaming|game|graphics|render|gpu)\b/.test(lower)) niches.push('gaming');
  if (/\b(math|physics|science|research|academic|paper|theory)\b/.test(lower))
    niches.push('science');
  if (/\b(hardware|chip|cpu|fpga|embedded|iot|robot)\b/.test(lower)) niches.push('hardware');
  if (/\b(web|browser|http|api|rest|graphql|css|html)\b/.test(lower)) niches.push('web');

  if (niches.length === 0) niches.push('tech');
  return niches;
}

function lobstersStoryToPost(story: LobstersStory): UnifiedPost | null {
  if (story.marked_as_deleted || story.is_expired) return null;

  const title = story.title || '';
  const description = story.description || '';
  const text = `${title}\n\n${description}`.trim();
  if (!text) return null;

  const authorName = story.submitter_user?.username || 'anonymous';
  const storyUrl = story.url || '';

  return {
    id: `lobsters:${story.short_id}`,
    protocol: 'lobsters',
    author: {
      id: `lobsters:user:${authorName}`,
      primary: { protocol: 'lobsters', id: authorName },
      handles: { lobsters: authorName || null },
      displayName: authorName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: storyUrl
      ? [
          {
            kind: 'link' as const,
            url: storyUrl,
            meta: { title: story.title, source: 'lobsters' },
          },
        ]
      : [],
    contentType: 'link',
    createdAt: new Date(story.created_at).getTime(),
    metrics: {
      likes: story.score || 0,
      reposts: 0,
      replies: story.comment_count || 0,
      quotes: 0,
      views: story.score ? story.score * 10 : 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: story.score || 0,
        reposts: 0,
        replies: story.comment_count || 0,
        quotes: 0,
      },
    },
    raw: story,
    niches: guessNiches(title, description, story.tags || []),
    community: {
      name: 'lobsters',
      title: 'Lobste.rs',
      instance: 'lobste.rs',
    },
  };
}

function lobstersCommentToPost(comment: LobstersComment): UnifiedPost | null {
  if (comment.is_deleted) return null;

  const text = comment.comment || '';
  if (!text) return null;

  const authorName = comment.commenting_user?.username || 'anonymous';

  return {
    id: `lobsters:comment:${comment.short_id}`,
    protocol: 'lobsters',
    author: {
      id: `lobsters:user:${authorName}`,
      primary: { protocol: 'lobsters', id: authorName },
      handles: { lobsters: authorName || null },
      displayName: authorName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text,
    embeds: [],
    contentType: 'text',
    createdAt: new Date(comment.created_at).getTime(),
    metrics: {
      likes: comment.score || 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: comment.score || 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: comment,
    niches: ['tech'],
    community: {
      name: 'lobsters',
      title: 'Lobste.rs',
      instance: 'lobste.rs',
    },
  };
}

// ─── Data Sources ────────────────────────────────────────────────────────

async function fetchHottestStories(limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${LOBSTERS_API}/hottest.json?limit=${Math.min(limit, 50)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const stories = (await res.json()) as LobstersStory[];
    return stories.map(lobstersStoryToPost).filter((p): p is UnifiedPost => p !== null);
  } catch {
    // console.log(`[bridge] Lobsters hottest error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchRecentComments(limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${LOBSTERS_API}/recent.json?limit=${Math.min(limit, 30)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const comments = (await res.json()) as LobstersComment[];
    return comments.map(lobstersCommentToPost).filter((p): p is UnifiedPost => p !== null);
  } catch {
    // console.log(`[bridge] Lobsters recent error: ${(err as Error).message}`);
    return [];
  }
}

async function fetchTaggedStories(tag: string, limit: number): Promise<UnifiedPost[]> {
  try {
    const url = `${LOBSTERS_API}/t/${tag}.json?limit=${Math.min(limit, 30)}`;
    const res = await $fetch(url, {
      headers: { 'User-Agent': 'DegenFeed-Bridge/0.1' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];

    const stories = (await res.json()) as LobstersStory[];
    return stories.map(lobstersStoryToPost).filter((p): p is UnifiedPost => p !== null);
  } catch {
    // console.log(`[bridge] Lobsters tag ${tag} error: ${(err as Error).message}`);
    return [];
  }
}

// ─── Schema Guardian ────────────────────────────────────────────────────

export const schema = {
  id: 'lobsters',
  name: 'Lobsters',
  description: 'Computing-focused link aggregation & tech discussion community',
  endpoint: '/api/feed/lobsters',
  requiresAuth: false,
  contentType: 'mixed',
};

// ─── Main Fetcher ───────────────────────────────────────────────────────

export async function fetchLobstersPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(5, Math.ceil(limit / 4));

  const [hottest, comments, cryptoStories, aiStories] = await Promise.all([
    fetchHottestStories(perSource),
    fetchRecentComments(Math.max(3, Math.ceil(perSource / 2))),
    fetchTaggedStories('crypto', Math.max(3, Math.ceil(perSource / 3))),
    fetchTaggedStories('ai', Math.max(3, Math.ceil(perSource / 3))),
  ]);

  const all = [...hottest, ...comments, ...cryptoStories, ...aiStories];
  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];

  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  // console.log(`[bridge] Lobsters: ${deduped.length} posts`);
  return deduped;
}

/** @alias */
export const fetch = fetchLobstersPosts;
