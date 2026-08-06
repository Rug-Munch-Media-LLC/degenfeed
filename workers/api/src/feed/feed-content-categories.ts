/**
 * feed-content-categories — Content-type category taxonomy and feed builder.
 *
 * Supports browsing by content category (social, video, audio, newsletters,
 * discussion, markets, governance, reading) across ALL protocols, used by
 * GET /api/feed/category/{category}.
 *
 * Unlike the niche taxonomy in feed-categories.ts (defi, nft, …), these
 * categories describe the FORMAT of the content, not its subject matter.
 * Each category maps to a set of protocols and/or content types so the
 * builder can return top posts from every protocol that produces that
 * format.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { detectContentType } from '@degenfeed/feed-core';

// ─── Taxonomy ────────────────────────────────────────────────────────

export const CONTENT_CATEGORY_SLUGS = [
  'social',
  'video',
  'audio',
  'newsletters',
  'discussion',
  'markets',
  'governance',
  'reading',
] as const;

export type ContentCategorySlug = (typeof CONTENT_CATEGORY_SLUGS)[number];

export const CONTENT_CATEGORY_SET = new Set<string>(CONTENT_CATEGORY_SLUGS);

export interface ContentCategoryDef {
  slug: ContentCategorySlug;
  label: string;
  emoji: string;
  /** Protocols that primarily produce this content format. */
  protocols: Protocol[];
  /** Content types (as detected by detectContentType) that qualify. */
  contentTypes?: string[];
  /** Keyword signals for subject-based categories (markets, governance). */
  keywords?: string[];
}

export const CONTENT_CATEGORIES: Record<ContentCategorySlug, ContentCategoryDef> = {
  social: {
    slug: 'social',
    label: 'Social',
    emoji: '\u{1F4AC}',
    protocols: [
      'nostr',
      'farcaster',
      'lens',
      'bluesky',
      'mastodon',
      'threads',
      'telegram',
      'discord',
      'pixelfed',
      'pleroma',
      'misskey',
      'friendica',
      'diaspora',
    ],
    contentTypes: ['text', 'thread', 'image'],
  },
  video: {
    slug: 'video',
    label: 'Video',
    emoji: '\u{1F3AC}',
    protocols: ['youtube', 'peertube', 'dtube', 'lbry', 'owncast', 'loops', 'vimeo', 'twitch'],
    contentTypes: ['video'],
  },
  audio: {
    slug: 'audio',
    label: 'Audio',
    emoji: '\u{1F3A7}',
    protocols: ['castopod', 'funkwhale', 'soundcloud', 'faircamp', 'audius'],
    contentTypes: ['podcast'],
    keywords: ['podcast', 'audio', 'episode', 'listen'],
  },
  newsletters: {
    slug: 'newsletters',
    label: 'Newsletters',
    emoji: '\u{1F4E9}',
    protocols: ['substack', 'medium', 'paragraph', 'mirror', 'ghost', 'writefreely', 'rss'],
    contentTypes: ['article'],
  },
  discussion: {
    slug: 'discussion',
    label: 'Discussion',
    emoji: '\u{1F5E3}\u{FE0F}',
    protocols: ['lemmy', 'reddit', 'kbin', 'mbin', 'discourse', 'lobsters', 'tildes'],
  },
  markets: {
    slug: 'markets',
    label: 'Markets',
    emoji: '\u{1F4C8}',
    protocols: ['polymarket', 'zora', 'opensea', 'snapshot'],
    keywords: ['market', 'price', 'trading', 'polymarket', 'odds', 'prediction'],
  },
  governance: {
    slug: 'governance',
    label: 'Governance',
    emoji: '\u{2696}\u{FE0F}',
    protocols: ['snapshot', 'tally', 'dao', 'governance'],
    keywords: ['governance', 'proposal', 'vote', 'voting', 'snapshot', 'dao', 'forum'],
  },
  reading: {
    slug: 'reading',
    label: 'Reading',
    emoji: '\u{1F4DA}',
    protocols: ['bookwyrm', 'writefreely', 'mirror', 'paragraph', 'substack', 'medium', 'ghost'],
    contentTypes: ['article'],
  },
};

export function isContentCategory(slug: string): slug is ContentCategorySlug {
  return CONTENT_CATEGORY_SET.has(slug.toLowerCase());
}

// ─── Feed builder ────────────────────────────────────────────────────

export interface ContentCategoryFeedOptions {
  /** Max posts to return (default 50). */
  limit?: number;
  /** Max posts per author (default 3). */
  maxPerAuthor?: number;
  /** Max posts per protocol (default 10). */
  maxPerProtocol?: number;
}

export interface ContentCategoryFeedResult {
  posts: Array<UnifiedPost & { categoryScore: number }>;
  meta: {
    totalFiltered: number;
    uniqueAuthors: number;
    uniqueProtocols: number;
    category: ContentCategorySlug;
  };
}

/**
 * Build a feed for a content-type category from a merged set of posts.
 * Filters by the category's protocol whitelist + content types, then ranks
 * by engagement with a recency tiebreak — mirroring the quality scoring
 * used by the niche category feed builder.
 */
export function buildContentCategoryFeed(
  posts: UnifiedPost[],
  category: ContentCategorySlug,
  opts: ContentCategoryFeedOptions = {},
): ContentCategoryFeedResult {
  const limit = opts.limit ?? 50;
  const maxPerAuthor = opts.maxPerAuthor ?? 3;
  const maxPerProtocol = opts.maxPerProtocol ?? 10;
  const def = CONTENT_CATEGORIES[category];

  const protocols = new Set<string>(def.protocols);
  const contentTypes = new Set<string>(def.contentTypes ?? []);
  const keywords = def.keywords ?? [];

  const scored: Array<UnifiedPost & { categoryScore: number }> = [];

  for (const p of posts) {
    if (protocols.size > 0 && !protocols.has(p.protocol)) continue;

    let score = 0.5;
    if (contentTypes.size > 0) {
      const ct = detectContentType(p);
      if (!contentTypes.has(ct)) continue;
      score += 0.2;
    }
    if (keywords.length > 0) {
      const text = `${p.text} ${p.html ?? ''}`.toLowerCase();
      if (!keywords.some((k) => text.includes(k))) continue;
      score += 0.2;
    }
    // Engagement lift
    const engagement =
      p.metrics.likes + p.metrics.reposts * 2 + p.metrics.replies * 3 + (p.metrics.quotes ?? 0);
    if (engagement > 0) score += Math.min(0.3, Math.log10(engagement + 1) * 0.1);

    scored.push({ ...p, categoryScore: score });
  }

  // Sort: category score desc, then engagement desc, then recency desc
  scored.sort((a, b) => {
    if (b.categoryScore !== a.categoryScore) return b.categoryScore - a.categoryScore;
    const engA =
      a.metrics.likes + a.metrics.reposts * 2 + a.metrics.replies * 3 + (a.metrics.quotes ?? 0);
    const engB =
      b.metrics.likes + b.metrics.reposts * 2 + b.metrics.replies * 3 + (b.metrics.quotes ?? 0);
    if (engB !== engA) return engB - engA;
    return b.createdAt - a.createdAt;
  });

  // Diversity: max N per author + per protocol
  const authorCounts = new Map<string, number>();
  const protocolCounts = new Map<string, number>();
  const filtered: Array<UnifiedPost & { categoryScore: number }> = [];

  for (const p of scored) {
    const authorKey = p.author.id;
    const protocolKey = p.protocol;

    const authorCt = authorCounts.get(authorKey) ?? 0;
    if (authorCt >= maxPerAuthor) continue;

    const protoCt = protocolCounts.get(protocolKey) ?? 0;
    if (protoCt >= maxPerProtocol) continue;

    filtered.push(p);
    authorCounts.set(authorKey, authorCt + 1);
    protocolCounts.set(protocolKey, protoCt + 1);

    if (filtered.length >= limit) break;
  }

  return {
    posts: filtered,
    meta: {
      totalFiltered: filtered.length,
      uniqueAuthors: authorCounts.size,
      uniqueProtocols: protocolCounts.size,
      category,
    },
  };
}
