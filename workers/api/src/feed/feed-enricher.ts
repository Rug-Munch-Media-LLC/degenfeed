/**
 * feed-enricher — Post enrichment, dedup, and content filtering.
 *
 * Owns spam filtering + niche enrichment at ingestion, cross-provider
 * deduplication, category/content-type filters, per-user mute filters,
 * the crypto relevance gate, English-language filtering, and Nostr
 * engagement enrichment via nostr.band.
 */

import {
  deduplicatePosts,
  detectContentType,
  enrichPostNiches,
  isEnglishPost,
  isRelevantPost,
  isSpamPost,
} from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { getPostContentUri } from '@degenfeed/utils';

/** Drops spam posts, enriches with niche tags, and attaches a df:// URI. */
export function sanitizePosts(posts: UnifiedPost[]): UnifiedPost[] {
  return posts
    .filter((p) => !isSpamPost(p))
    .map((p) => {
      const enriched = enrichPostNiches(p);
      enriched.dfUri = getPostContentUri(enriched);
      return enriched;
    });
}

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

/** Filters out muted authors and posts containing muted words. */
export function applyMuteFilters(
  posts: UnifiedPost[],
  mutedAuthors: Set<string>,
  mutedWords: Set<string>,
): UnifiedPost[] {
  if (mutedAuthors.size === 0 && mutedWords.size === 0) return posts;
  return posts.filter((p) => {
    if (p.author.id && mutedAuthors.has(p.author.id)) return false;
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
  let out = applyMuteFilters(posts, opts.mutedAuthors, opts.mutedWords);
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

export interface EnrichOptions extends BaseFilterOptions, Partial<UserFilterOptions> {}

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
    allowNonCrypto: opts.allowNonCrypto ?? false,
    preferEnglish: opts.preferEnglish ?? true,
  });
  await enrichNostrEngagement(filtered);
  return filtered;
}
