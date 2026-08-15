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
  mediaFromEmbeds,
  spamScore,
} from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { getExternalProfileUrl, getPostContentUri } from '@degenfeed/utils';
import type { Env } from '../types';

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

/**
 * Hydrate the in-memory ban/removed-post sets from the persistent REPORTS KV
 * namespace (written by the moderation routes). Bans and post removals only
 * take effect in the feed once this runs; it is invoked at the top of the
 * feed fetch paths. Any KV failure leaves the sets empty — the feed serves
 * normally rather than erroring, at the cost of not filtering.
 */
export async function hydrateModerationState(env: Env): Promise<void> {
  const bannedUsers = new Set<string>();
  const removedPosts = new Set<string>();
  if (!env.REPORTS) {
    setBannedUsers(bannedUsers);
    setRemovedPosts(removedPosts);
    return;
  }
  try {
    const rawIdx = await env.REPORTS.get('mod:bans:index');
    if (rawIdx) {
      const idx = JSON.parse(rawIdx) as { ids?: string[] };
      for (const id of idx.ids ?? []) {
        const banRaw = await env.REPORTS.get(`mod:ban:${id}`);
        if (!banRaw) continue;
        try {
          const ban = JSON.parse(banRaw) as { userId?: string; walletAddress?: string };
          if (ban.userId) {
            bannedUsers.add(ban.userId);
            bannedUsers.add(ban.userId.toLowerCase());
          }
          if (ban.walletAddress) {
            bannedUsers.add(ban.walletAddress);
            bannedUsers.add(ban.walletAddress.toLowerCase());
          }
        } catch {
          // skip corrupt ban entry
        }
      }
    }
    const removed = await env.REPORTS.list({ prefix: 'mod:removed:' });
    for (const key of removed.keys) {
      const postId = key.name.slice('mod:removed:'.length);
      if (postId) {
        removedPosts.add(postId);
        removedPosts.add(postId.toLowerCase());
      }
    }
  } catch {
    // KV unavailable — keep empty sets (safe: nothing filtered)
  }
  setBannedUsers(bannedUsers);
  setRemovedPosts(removedPosts);
}

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

/**
 * Feed-author wire format. Every post served by the API exposes these flat
 * fields on `author` so profile click-through works regardless of protocol:
 *
 *   author.name     → display name (falls back to handle)
 *   author.handle   → `@username` or `user@instance` (no leading @)
 *   author.avatar   → full avatar URL string
 *   author.url      → profile URL on the author's home instance
 *   author.protocol → the post's protocol
 *
 * The canonical `UnifiedIdentity` fields (id, primary, handles,
 * displayName, avatarUrl, …) are preserved alongside — existing consumers
 * keep working while the flat aliases satisfy the API contract.
 */
export type WireAuthor = UnifiedIdentity & {
  name: string;
  handle: string;
  avatar: string;
  url?: string;
  protocol: Protocol;
};

/**
 * Derive the flat `author.handle` for the wire format.
 * Prefers the per-protocol handle; falls back to a protocol-native
 * placeholder so the field is never empty/missing.
 */
function wireHandle(author: UnifiedIdentity, protocol: Protocol): string {
  const handle = (author.handles as Record<string, string | null> | undefined)?.[protocol];
  if (handle && handle.trim()) return handle.trim();
  const keys = author.keys as Record<string, unknown> | undefined;
  if (protocol === 'farcaster' && typeof keys?.fid === 'number') return `fid:${keys.fid}`;
  const primaryId = author.primary?.id;
  if (primaryId) return primaryId;
  return author.displayName || '';
}

/**
 * Augment a single UnifiedPost into the API wire format:
 *  - populate `media` from embeds when the provider left it empty
 *  - stamp flat author aliases (name/handle/avatar/url/protocol)
 */
export function toApiPost(post: UnifiedPost): UnifiedPost {
  if (!post.media || post.media.length === 0) {
    const derived = mediaFromEmbeds(post.embeds);
    if (derived.length > 0) post.media = derived;
  }
  const protocol = post.protocol;
  const author = post.author as WireAuthor;
  author.name = (author.name ?? author.displayName) || wireHandle(author, protocol);
  author.handle = author.handle ?? wireHandle(author, protocol);
  author.avatar = (author.avatar ?? author.avatarUrl) || '';
  author.url = author.url || getExternalProfileUrl(author, protocol) || undefined;
  author.protocol = protocol;
  return post;
}

/**
 * Bulk-augment posts for the API wire format. Mutates in place (the posts
 * are response-bound objects that are never shared after serialization).
 */
export function toApiPosts(posts: UnifiedPost[]): UnifiedPost[] {
  return posts.map(toApiPost);
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
        {
          reactions?: number;
          reposts?: number;
          replies?: number;
          zaps?: number;
        }
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
