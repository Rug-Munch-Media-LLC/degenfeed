/**
 * content-dedup — Cross-protocol and URL-based deduplication.
 *
 * Enhanced with:
 *   - RSS content dedup (same article from multiple feeds)
 *   - Origin source preference (prefer original over aggregator)
 *   - Newsletter/RSS cross-dedup (same article via different protocols)
 *   - "Also on" tracking (crossProtocolSources across all sources)
 *   - Aggregator detection (Redlib, Lemmy, etc.)
 *   - Canonical URL matching for article-level dedup
 *
 * Same content posted on Nostr and Farcaster (or Reddit and RSS)
 * should only appear once. Uses content hashing + URL matching
 * and keeps the version with highest engagement.
 */

import type { UnifiedPost } from '@degenfeed/types';

// ─── Known aggregator domains ─────────────────────────────────────

const AGGREGATOR_PATTERNS = [
  /redlib\./i,        // Redlib (privacy Reddit frontend)
  /lemmy\..*/i,        // Lemmy instances
  /reddit\.com/i,      // Reddit native
  /news\.google\.com/i,
  /medium\.com/i,
  /substack\.com/i,
  /ghost\.org/i,
  /feedburner\.com/i,
  /feedproxy\.google\.com/i,
];

// ─── Source quality ranking (higher = better) ────────────────────
// Used to prefer the best source when content appears on multiple protocols

const SOURCE_QUALITY_RANK: Record<string, number> = {
  nostr: 90,
  farcaster: 85,
  bluesky: 85,
  lens: 80,
  mastodon: 80,
  threads: 70,
  // Original RSS from known sources is better than aggregated content
  rss: 75,
  // Aggregated content
  reddit: 60,
  lemmy: 55,
  peertube: 70,
  youtube: 70,
  // Newsletters are often original
  newsletter: 85,
  // Social aggregators
  twitter: 50,
};

// ─── Helpers ──────────────────────────────────────────────────────

function sha256(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(
      /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{200D}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F500}-\u{1F53F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F980}-\u{1F9FF}]|[\u{231A}-\u{231B}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3030}]|[\u{303D}]|[\u{3297}]|[\u{3299}]|[\u{E50A}]/gu,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function contentHash(post: UnifiedPost): string {
  const normalized = normalizeText(post.text);
  if (normalized.length < 20) return '';
  return sha256(normalized);
}

function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  return (text.match(urlRegex) ?? []).map((u) => {
    try {
      const url = new URL(u);
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch {
      return u.replace(/\/$/, '').split('?')[0]!;
    }
  });
}

function engagementScore(post: UnifiedPost): number {
  return (
    (post.metrics.likes ?? 0) * 1 +
    (post.metrics.reposts ?? 0) * 3 +
    (post.metrics.replies ?? 0) * 5 +
    (post.metrics.quotes ?? 0) * 3
  );
}

/**
 * Check if a URL is from an aggregator/republishing source.
 */
function isAggregatorUrl(url: string): boolean {
  return AGGREGATOR_PATTERNS.some((p) => p.test(url));
}

/**
 * Extract the canonical (article) URL from a post.
 * Filters out social media URLs to find the actual shared article.
 */
function extractCanonicalUrl(text: string): string | null {
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const urls = text.match(urlRegex) ?? [];
  // Skip social media URLs and shortlinks
  const skipDomains = ['twitter.com', 'x.com', 'bsky.app', 'warpcast.com', 't.co', 'naddr'];
  for (const url of urls) {
    try {
      const u = new URL(url);
      if (skipDomains.some((d) => u.hostname.includes(d))) continue;
      // Normalize: strip trailing slash, remove tracking params
      return u.origin + u.pathname.replace(/\/$/, '');
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Get article title from embed metadata (for RSS/article dedup).
 */
function articleTitle(post: UnifiedPost): string | null {
  for (const embed of post.embeds) {
    const meta = embed.meta as unknown as Record<string, unknown> | undefined;
    if (meta?.title && typeof meta.title === 'string' && meta.title.length > 5) {
      return meta.title;
    }
  }
  if (post.protocol === 'rss') {
    const firstLine = post.text.trim().split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 5 && firstLine.length < 200) return firstLine;
  }
  return null;
}

// ─── Dedup Result ──────────────────────────────────────────────────

export interface DedupResult {
  posts: UnifiedPost[];
  deduped: number;
  crossProtocol: number;
  urlDedup: number;
  rssDedup: number;
  aggregatorDedup: number;
  canonicalUrlDedup: number;
}

// ─── Main Dedup Function ──────────────────────────────────────────

export function deduplicateCrossProtocol(posts: UnifiedPost[]): DedupResult {
  const contentHashes = new Map<
    string,
    { post: UnifiedPost; score: number; protocols: Set<string> }
  >();
  const urlToPost = new Map<string, { post: UnifiedPost; score: number; protocols: Set<string> }>();
  const canonicalUrls = new Map<string, { post: UnifiedPost; score: number; protocols: Set<string> }>();
  const rssTitles = new Map<string, { post: UnifiedPost; score: number }>();

  let crossProtocol = 0;
  let urlDedup = 0;
  let rssDedup = 0;
  let aggregatorDedup = 0;
  let canonicalUrlDedup = 0;

  const keep = new Map<string, UnifiedPost>();

  for (const post of posts) {
    const score = engagementScore(post);
    const hash = contentHash(post);
    const urls = extractUrls(post.text);
    const canonicalUrl = extractCanonicalUrl(post.text);
    let shouldKeep = true;

    // ── 1. Cross-protocol content hash matching ─────────────────
    if (hash && contentHashes.has(hash)) {
      const existing = contentHashes.get(hash)!;
      existing.protocols.add(post.protocol);
      if (existing.post.protocol !== post.protocol) crossProtocol++;

      // Pick the best source (higher quality rank wins, engagement breaks ties)
      const existingQuality = SOURCE_QUALITY_RANK[existing.post.protocol] ?? 50;
      const incomingQuality = SOURCE_QUALITY_RANK[post.protocol] ?? 50;
      const incomingBetter = incomingQuality > existingQuality || 
        (incomingQuality === existingQuality && score > existing.score);

      if (incomingBetter) {
        const mergedProtocols = new Set([...existing.protocols, post.protocol]);
        contentHashes.set(hash, { post, score, protocols: mergedProtocols });
        keep.delete(existing.post.id);
        keep.set(post.id, post);
      } else {
        const existingEntry = keep.get(existing.post.id);
        if (existingEntry) {
          (existingEntry as unknown as Record<string, unknown>).crossProtocolSources = [
            ...((existingEntry as unknown as Record<string, unknown>).crossProtocolSources as string[] ?? []),
            post.protocol,
          ];
        }
      }
      shouldKeep = false;
    }

    // ── 2. Canonical URL dedup (same article shared across protocols) ──
    if (shouldKeep && canonicalUrl && canonicalUrls.has(canonicalUrl)) {
      const existing = canonicalUrls.get(canonicalUrl)!;
      existing.protocols.add(post.protocol);
      if (existing.post.protocol !== post.protocol) canonicalUrlDedup++;

      const existingQuality = SOURCE_QUALITY_RANK[existing.post.protocol] ?? 50;
      const incomingQuality = SOURCE_QUALITY_RANK[post.protocol] ?? 50;
      const incomingBetter = incomingQuality > existingQuality ||
        (incomingQuality === existingQuality && score > existing.score);

      if (incomingBetter) {
        const mergedProtocols = new Set([...existing.protocols, post.protocol]);
        canonicalUrls.set(canonicalUrl, { post, score, protocols: mergedProtocols });
        keep.delete(existing.post.id);
        keep.set(post.id, post);
      } else {
        const existingEntry = keep.get(existing.post.id);
        if (existingEntry) {
          (existingEntry as unknown as Record<string, unknown>).crossProtocolSources = [
            ...((existingEntry as unknown as Record<string, unknown>).crossProtocolSources as string[] ?? []),
            post.protocol,
          ];
        }
      }
      shouldKeep = false;
    }

    // ── 3. URL-based dedup ──────────────────────────────────────
    if (shouldKeep) {
      for (const url of urls) {
        if (urlToPost.has(url)) {
          const existing = urlToPost.get(url)!;
          existing.protocols.add(post.protocol);

          const existingQuality = SOURCE_QUALITY_RANK[existing.post.protocol] ?? 50;
          const incomingQuality = SOURCE_QUALITY_RANK[post.protocol] ?? 50;
          const incomingBetter = incomingQuality > existingQuality ||
            (incomingQuality === existingQuality && score > existing.score);

          if (incomingBetter) {
            for (const [u, entry] of urlToPost) {
              if (entry.post === existing.post) {
                urlToPost.set(u, { post, score, protocols: existing.protocols });
              }
            }
            keep.delete(existing.post.id);
            keep.set(post.id, post);
            urlDedup++;
          } else {
            const existingEntry = keep.get(existing.post.id);
            if (existingEntry) {
              const sources = new Set([
                ...((existingEntry as unknown as Record<string, unknown>).crossProtocolSources as string[] ?? []),
                post.protocol,
              ]);
              (existingEntry as unknown as Record<string, unknown>).crossProtocolSources = [...sources];
            }
          }
          if (!shouldKeep) break;
          shouldKeep = false;
        } else {
          urlToPost.set(url, {
            post,
            score,
            protocols: new Set([post.protocol]),
          });
        }
      }
    }

    // ── 4. RSS article title dedup ──────────────────────────────
    if (shouldKeep && post.protocol === 'rss') {
      const title = articleTitle(post);
      if (title) {
        const titleKey = title.toLowerCase().slice(0, 100);
        if (rssTitles.has(titleKey)) {
          // Same article from another RSS feed — keep the higher-scored one
          rssDedup++;
          const existing = rssTitles.get(titleKey)!;
          if (score > existing.score) {
            keep.delete(existing.post.id);
            keep.set(post.id, post);
            rssTitles.set(titleKey, { post, score });
          }
          shouldKeep = false;
        } else {
          rssTitles.set(titleKey, { post, score });
        }
      }
    }

    // ── 5. Aggregator dedup ────────────────────────────────────
    if (shouldKeep && canonicalUrl && isAggregatorUrl(canonicalUrl)) {
      // Check if the original article is already kept via a non-aggregator source
      for (const [keptId, keptPost] of keep) {
        const keptUrl = extractCanonicalUrl(keptPost.text);
        if (keptUrl && !isAggregatorUrl(keptUrl)) {
          // See if they share the same content hash
          if (hash && contentHashes.has(hash)) continue; // already handled above
          // Check if the aggregator URL points to the same content
          if (canonicalUrl.includes('reddit.com') || canonicalUrl.includes('redlib.')) {
            aggregatorDedup++;
            shouldKeep = false;
            break;
          }
        }
      }
    }

    // ── Store or skip ──────────────────────────────────────────
    if (shouldKeep && hash) {
      contentHashes.set(hash, {
        post,
        score,
        protocols: new Set([post.protocol]),
      });
      if (canonicalUrl) {
        canonicalUrls.set(canonicalUrl, {
          post,
          score,
          protocols: new Set([post.protocol]),
        });
      }
      keep.set(post.id, post);
    } else if (shouldKeep) {
      if (canonicalUrl) {
        canonicalUrls.set(canonicalUrl, {
          post,
          score,
          protocols: new Set([post.protocol]),
        });
      }
      keep.set(post.id, post);
    }
  }

  const deduped = posts.length - keep.size;

  // Add crossProtocolSources to posts that were cross-protocol merged
  const result = [...keep.values()].map((post) => {
    const hash = contentHash(post);
    if (hash && contentHashes.has(hash)) {
      const entry = contentHashes.get(hash)!;
      if (entry.protocols.size > 1) {
        return {
          ...post,
          crossProtocolSources: [...entry.protocols].filter((p) => p !== post.protocol),
        } as UnifiedPost & { crossProtocolSources?: string[] };
      }
    }
    // Also check canonical URL sources
    const canonicalUrl = extractCanonicalUrl(post.text);
    if (canonicalUrl && canonicalUrls.has(canonicalUrl)) {
      const entry = canonicalUrls.get(canonicalUrl)!;
      if (entry.protocols.size > 1) {
        const existing = (post as unknown as Record<string, unknown>).crossProtocolSources as string[] ?? [];
        const additional = [...entry.protocols].filter((p) => p !== post.protocol && !existing.includes(p));
        if (additional.length > 0) {
          return {
            ...post,
            crossProtocolSources: [...existing, ...additional],
          } as UnifiedPost & { crossProtocolSources?: string[] };
        }
      }
    }
    return post;
  });

  return {
    posts: result,
    deduped,
    crossProtocol,
    urlDedup,
    rssDedup,
    aggregatorDedup,
    canonicalUrlDedup,
  };
}
