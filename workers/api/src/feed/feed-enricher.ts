/**
 * feed-enricher — Post enrichment, dedup, content filtering, and auto-moderation.
 *
 * Owns spam filtering + niche enrichment at ingestion, cross-provider
 * deduplication, category/content-type filters, per-user mute filters,
 * the crypto relevance gate, English-language filtering, Nostr
 * engagement enrichment via nostr.band, and auto-moderation hooks.
 */

import {
  checkText,
  deduplicatePosts,
  detectContentType,
  enrichPostNiches,
  isEnglishPost,
  isRelevantPost,
  spamScore,
} from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { getPostContentUri } from '@degenfeed/utils';

// ─── Auto-moderation state ────────────────────────────────────────────

/**
 * Set of banned user IDs (protocol-scoped, e.g. "nostr:abc...").
 * In production this is populated from KV by the feed fetcher.
 */
let _bannedUsers = new Set<string>();

/**
 * Set of removed post IDs.
 */
let _removedPosts = new Set<string>();

/**
 * Set of flagged post IDs that have already been reported.
 * Avoids repeated flagging.
 */
const _flaggedPosts = new Set<string>();

export function setBannedUsers(users: Set<string>): void {
  _bannedUsers = users;
}

export function setRemovedPosts(posts: Set<string>): void {
  _removedPosts = posts;
}

export function addFlaggedPost(postId: string): void {
  _flaggedPosts.add(postId);
}

export function isBannedUser(userId: string): boolean {
  return _bannedUsers.has(userId) || _bannedUsers.has(userId.toLowerCase());
}

export function isRemovedPost(postId: string): boolean {
  return _removedPosts.has(postId) || _removedPosts.has(postId.toLowerCase());
}

// ─── Auto-moderation tags ─────────────────────────────────────────────

// Tag names we attach to post metadata for downstream use
export const MODERATION_TAGS = {
  FLAGGED: 'mod:flagged',
  AUTO_REJECTED: 'mod:auto-rejected',
  AUTO_HIDDEN: 'mod:auto-hidden',
  BANNED_USER: 'mod:banned-user',
  REMOVED_POST: 'mod:removed',
} as const;

// ─── Original enrichment code ─────────────────────────────────────────

/**
 * Drops definite spam (score >= 0.9), auto-rejects banned users and
 * removed posts, auto-flags posts with high spamScore or scam patterns,
 * and marks borderline posts with a spamScore so the ranking engine
 * can demote them instead of hard-filtering. Enriches with niche tags
 * and attaches a df:// URI.
 */
export function sanitizePosts(posts: UnifiedPost[]): UnifiedPost[] {
  return posts
    .filter((p) => {
      // Auto-reject: banned users
      if (p.author.id && isBannedUser(p.author.id)) {
        (p as unknown as Record<string, unknown>).moderationAction = MODERATION_TAGS.BANNED_USER;
        return false;
      }

      // Auto-reject: removed posts
      if (isRemovedPost(p.id)) {
        (p as unknown as Record<string, unknown>).moderationAction = MODERATION_TAGS.REMOVED_POST;
        return false;
      }

      // Auto-reject: definite spam (score >= 0.9)
      const { score: spamScoreV } = spamScore(p);
      if (spamScoreV >= 0.9) {
        (p as unknown as Record<string, unknown>).moderationAction = MODERATION_TAGS.AUTO_REJECTED;
        return false;
      }

      return true;
    })
    .map((p) => {
      const enriched = enrichPostNiches(p);
      enriched.dfUri = getPostContentUri(
        enriched as unknown as {
          protocol: string;
          id: string;
          instance?: string;
          raw?: Record<string, unknown> | null;
        },
      );

      // Attach spam score metadata for downstream ranking
      const { score, signals } = spamScore(p);
      (enriched as unknown as Record<string, unknown>).spamScore = score;
      (enriched as unknown as Record<string, unknown>).spamSignals = signals;

      // Auto-flag: borderline spam (0.8 <= score < 0.9)
      if (score >= 0.8 && score < 0.9) {
        (enriched as unknown as Record<string, unknown>).moderationAction = MODERATION_TAGS.FLAGGED;
        addFlaggedPost(enriched.id);
      }

      // Auto-flag: known scam patterns from moderation config
      const modCheck = checkText(enriched.text);
      if (modCheck.flag && !modCheck.reject) {
        (enriched as unknown as Record<string, unknown>).moderationAction = MODERATION_TAGS.FLAGGED;
        (enriched as unknown as Record<string, unknown>).moderationReasons = modCheck.reasons;
        addFlaggedPost(enriched.id);
      }

      // Auto-reject: certain scam patterns
      if (modCheck.reject) {
        (enriched as unknown as Record<string, unknown>).moderationAction =
          MODERATION_TAGS.AUTO_REJECTED;
        (enriched as unknown as Record<string, unknown>).moderationReasons = modCheck.reasons;
        return null as unknown as UnifiedPost; // filtered below
      }

      return enriched;
    })
    .filter((p): p is UnifiedPost => p !== null);
}

// ─── Everything below is unchanged from the original ──────────────────

export function filterByCategory(posts: UnifiedPost[], category: string): UnifiedPost[] {
  const target = category.toLowerCase();
  return posts.filter((p) => p.niches.map((n) => n.toLowerCase()).includes(target));
}

/** Content type filter: video|article|image|thread|link|text */
export function filterByContentType(posts: UnifiedPost[], type: string): UnifiedPost[] {
  return posts.filter((p) => detectContentType(p) === type);
}

export interface BaseFilterOptions {
  category?: string;
  type?: string;
}

/** Deduplicates the merged provider posts, then applies category and content-type filters. */
export function prepareBasePosts(
  posts: UnifiedPost[],
  opts: BaseFilterOptions = {},
): UnifiedPost[] {
  let out = deduplicatePosts(posts);
  if (opts.category) {
    out = filterByCategory(out, opts.category);
  }
  if (opts.type) {
    out = filterByContentType(out, opts.type);
  }
  return out;
}

/** Filters out muted authors, muted/blocked communities, and posts containing muted words. */
export function applyMuteFilters(
  posts: UnifiedPost[],
  mutedAuthors: Set<string>,
  mutedWords: Set<string>,
  mutedCommunities?: Set<string>,
  blockedCommunities?: Set<string>,
): UnifiedPost[] {
  if (
    mutedAuthors.size === 0 &&
    mutedWords.size === 0 &&
    !mutedCommunities?.size &&
    !blockedCommunities?.size
  )
    return posts;
  return posts.filter((p) => {
    // Muted author
    if (p.author.id && mutedAuthors.has(p.author.id)) return false;

    // Muted / blocked community
    if (p.community) {
      const communityKey = p.community.name.toLowerCase();
      if (mutedCommunities?.has(communityKey)) return false;
      if (blockedCommunities?.has(communityKey)) return false;
      // Also check by actorId if available
      if (p.community.actorId) {
        if (mutedCommunities?.has(p.community.actorId)) return false;
        if (blockedCommunities?.has(p.community.actorId)) return false;
      }
    }

    // Muted words (case-insensitive)
    if (mutedWords.size > 0) {
      const text = `${p.text} ${p.html ?? ''}`.toLowerCase();
      for (const word of mutedWords) {
        if (text.includes(word.toLowerCase())) return false;
      }
    }

    return true;
  });
}

/**
 * Language preference: check the ?lang param and Accept-Language
 * header, defaulting to English-only. Users opt into all languages
 * with ?lang=all.
 */
export function prefersEnglish(langParam: string, acceptLang: string): boolean {
  return langParam !== 'all' && (langParam === 'en' || acceptLang.startsWith('en') || !langParam);
}

export interface UserFilterOptions {
  mutedAuthors: Set<string>;
  mutedWords: Set<string>;
  mutedCommunities?: Set<string>;
  blockedCommunities?: Set<string>;
  /**
   * Skip the crypto-gating relevance filter when the user opts into
   * non-crypto content. The spam filter still applies so we don't
   * drown in junk.
   */
  allowNonCrypto: boolean;
  preferEnglish: boolean;
}

/** Applies mute, relevance, and language filters in the legacy order. */
export function applyUserFilters(posts: UnifiedPost[], opts: UserFilterOptions): UnifiedPost[] {
  let out = applyMuteFilters(
    posts,
    opts.mutedAuthors,
    opts.mutedWords,
    opts.mutedCommunities,
    opts.blockedCommunities,
  );
  out = opts.allowNonCrypto ? out : out.filter(isRelevantPost);
  if (opts.preferEnglish) {
    out = out.filter((p) => isEnglishPost(p.text));
  }
  return out;
}

/**
 * Fetches Nostr zap/reaction counts from nostr.band and merges them
 * into post metrics in place, for engagement enrichment before
 * scoring. Non-critical — failures are logged and swallowed.
 */
export async function enrichNostrEngagement(posts: UnifiedPost[]): Promise<void> {
  const nostrIds = posts
    .filter((p) => p.protocol === 'nostr')
    .map((p) => p.id.replace('nostr:', ''));
  if (nostrIds.length === 0) return;
  try {
    const res = await fetch('https://api.nostr.band/v0/stats/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: nostrIds.slice(0, 50) }),
    });
    if (res.ok) {
      const stats = (await res.json()) as Record<
        string,
        { reactions?: number; reposts?: number; replies?: number; zaps?: number }
      >;
      for (const p of posts) {
        if (p.protocol !== 'nostr') continue;
        const nativeId = p.id.replace('nostr:', '');
        const s = stats[nativeId];
        if (s) {
          if (s.zaps) p.metrics.quotes = s.zaps;
          if (s.reactions) p.metrics.likes = Math.max(p.metrics.likes, s.reactions);
          if (s.reposts) p.metrics.reposts = Math.max(p.metrics.reposts, s.reposts);
          if (s.replies) p.metrics.replies = Math.max(p.metrics.replies, s.replies);
        }
      }
    }
  } catch (err) {
    console.warn('[feed] nostr.band stats fetch failed:', err instanceof Error ? err.message : err);
  }
}

export interface EnrichOptions extends BaseFilterOptions, Partial<UserFilterOptions> {
  mutedCommunities?: Set<string>;
  blockedCommunities?: Set<string>;
}

/**
 * Full enrichment pipeline: dedup → category/type filters → mute
 * filters → relevance gate → language filter → Nostr engagement
 * enrichment. The orchestrator may instead call the granular steps
 * when it needs to interleave side effects (post KV writes, user
 * context loading) between stages.
 */
export async function enrichPosts(
  posts: UnifiedPost[],
  opts: EnrichOptions = {},
): Promise<UnifiedPost[]> {
  const base = prepareBasePosts(posts, opts);
  const filtered = applyUserFilters(base, {
    mutedAuthors: opts.mutedAuthors ?? new Set(),
    mutedWords: opts.mutedWords ?? new Set(),
    mutedCommunities: opts.mutedCommunities,
    blockedCommunities: opts.blockedCommunities,
    allowNonCrypto: opts.allowNonCrypto ?? false,
    preferEnglish: opts.preferEnglish ?? true,
  });
  await enrichNostrEngagement(filtered);
  return filtered;
}
