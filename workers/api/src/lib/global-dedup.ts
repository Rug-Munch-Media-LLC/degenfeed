/**
 * global-dedup — Cross-platform universal deduplication registry.
 *
 * Tracks ALL content across ALL protocols with 15 dedup methods.
 * One piece of content appears exactly once, regardless of protocol.
 *
 * Designed to be called BEFORE scoring in the feed pipeline so dupes
 * are removed before ranking/sorting.
 *
 * Storage: DEDUP KV namespace (persistent) + CACHE KV for bloom filters.
 *
 * Dedup layers:
 *   1. SHA-256 content hash (exact match)
 *   2. Normalized URL matching (remove utm, tracking, fragments)
 *   3. Title Levenshtein distance (<85% similarity = dupe)
 *   4. First 200 chars normalized similarity
 *   5. Image perceptual hash (for visual content)
 *   6. Link canonical URL matching
 *   7. Author + title combination
 *   8. Domain + slug matching
 *   9. OG metadata matching
 *  10. Cross-protocol ID mapping (same post on Nostr and Farcaster)
 *  11. Quote-posting detection (repost of same content)
 *  12. Thread detection (same thread, merged)
 *  13. Timestamp proximity (same time ±5min from same author)
 *  14. Embedded content detection (tweet in article = dupe of original tweet)
 *  15. RSS GUID dedup (RSS standard)
 */

import type { Env } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface DedupFingerprint {
  /** SHA-256 of normalized content */
  contentHash: string;
  /** Normalized URLs found in content */
  urlHashes: string[];
  /** Normalized title hash (SHA-256 of normalized title) */
  titleFingerprint: string;
  /** Source protocol name */
  sourceProtocol: string;
  /** Source-specific identifier */
  sourceId: string;
  /** Unix ms when first seen */
  firstSeen: number;
  /** Which dedup method caught this */
  matchedBy?: string;
  /** Cluster ID for grouping all copies of the same content */
  clusterId?: string;
}

export interface DedupCluster {
  /** Cluster ID — stable across all copies */
  clusterId: string;
  /** All copies in this cluster (ordered by firstSeen) */
  copies: DedupFingerprint[];
  /** The canonical content hash */
  canonicalHash: string;
  /** Total copies across all protocols */
  copyCount: number;
  /** Protocols this content appeared on */
  protocols: string[];
  /** When this cluster was first created */
  createdAt: number;
  /** When this cluster was last updated */
  updatedAt: number;
}

export interface DedupResult {
  /** Whether this content is a duplicate */
  isDuplicate: boolean;
  /** Which method triggered the dupe detection */
  method: string | null;
  /** The cluster ID if duplicate */
  clusterId: string | null;
  /** Confidence score 0-1 */
  confidence: number;
  /** How many copies exist (including this one) */
  copyCount: number;
  /** Protocols this content was found on */
  protocols: string[];
  /** The canonical/first-seen post reference */
  canonicalReference?: { protocol: string; id: string };
}

export interface DedupCheckRequest {
  text?: string;
  title?: string;
  url?: string;
  protocol: string;
  sourceId: string;
  authorId?: string;
  authorName?: string;
  createdAt?: number;
  embedUrls?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  rssGuid?: string;
  rootId?: string;
  parentId?: string;
}

export interface SeenContentEntry {
  fingerprintHash: string;
  clusterId: string;
  seenAt: number;
  protocol: string;
  sourceId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

const LEVENSHTEIN_SIMILARITY_THRESHOLD = 0.85;
const _FIRST_200_SIMILARITY_THRESHOLD = 0.8;
const TIMESTAMP_PROXIMITY_MS = 5 * 60 * 1000; // 5 minutes
const BLOOM_FILTER_KEY = 'dedup:bloom:v1';
const _CLUSTER_INDEX_KEY = 'dedup:clusters:index';
const FINGERPRINT_PREFIX = 'dedup:fp:';
const CLUSTER_PREFIX = 'dedup:cluster:';
const CROSS_MAP_PREFIX = 'dedup:xmap:';

// ─── SHA-256 helpers (using Web Crypto API) ─────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.normalize('NFKC'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Text normalization ──────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{200D}]/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.toLowerCase());
    // Remove tracking params
    const trackParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'ref',
      'source',
      'si',
      'mc_cid',
      'mc_eid',
    ];
    for (const p of trackParams) u.searchParams.delete(p);
    // Normalize path
    u.pathname = u.pathname.replace(/\/+$/, '').replace(/\/+/g, '/');
    // Remove fragments (except if it's an actual content anchor)
    u.hash = '';
    return u.origin + u.pathname + u.search;
  } catch {
    return url.toLowerCase().replace(/\/$/, '').split('?')[0] ?? url;
  }
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Levenshtein distance (for title/prefix matching) ────────────────────

function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  if (an < bn) return levenshteinDistance(b, a);

  const prev: number[] = new Array(bn + 1);
  const curr: number[] = new Array(bn + 1);
  for (let j = 0; j <= bn; j++) {
    prev[j] = j;
    curr[j] = 0;
  }

  for (let i = 1; i <= an; i++) {
    curr[0] = i;
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        (prev[j] as number) + 1,
        (curr[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
    }
    for (let j = 0; j <= bn; j++) prev[j] = curr[j] as number;
  }
  return prev[bn] as number;
}

function normalizedLevenshteinSim(a: string, b: string): number {
  const normA = normalizeText(a).slice(0, 200);
  const normB = normalizeText(b).slice(0, 200);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - levenshteinDistance(normA, normB) / maxLen;
}

// ─── Jaccard similarity for word-set comparison ──────────────────────────

function _wordSet(text: string): Set<string> {
  return new Set(
    normalizeText(text)
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

function _jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = a.size < b.size ? b : a;
  for (const w of smaller) {
    if (larger.has(w)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}

// ─── Image perceptual hash (URL-pattern based, no image decoding) ────────
// Uses URL structure + file name patterns as pHash proxy.
// Reused from feed-core's imagePerceptualFingerprint logic.

function imagePerceptualFingerprint(embedUrls: string[]): string | null {
  const imageExts = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp']);
  const fingerprints: string[] = [];

  for (const url of embedUrls) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/+$/, '');
      const ext = path.split('.').pop()?.toLowerCase() || '';
      if (!imageExts.has(ext)) continue;

      const name =
        path
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') || '';
      const strippedName = name
        .replace(/[-_]?(small|thumb|tiny|medium|large|original|full|resize|crop)[-_]?/gi, '')
        .replace(/[_-]?\d+x\d+[_-]?/gi, '');

      fingerprints.push(
        strippedName.length > 3
          ? `phash:${strippedName.toLowerCase()}`
          : `phash:${u.hostname}${path.toLowerCase()}`,
      );
    } catch {
      fingerprints.push(`phash:${url}`);
    }
  }

  return fingerprints.length > 0 ? fingerprints.sort().join('||') : null;
}

// ─── Embed URL extractor ─────────────────────────────────────────────────

function extractEmbedUrls(text: string, embeds?: Array<{ url: string; kind?: string }>): string[] {
  const urls: string[] = [];
  // Extract URLs from text
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const textUrls = text.match(urlRegex) ?? [];
  urls.push(...textUrls);
  // Add embed URLs
  if (embeds) {
    for (const e of embeds) {
      if (e.url) urls.push(e.url);
    }
  }
  return [...new Set(urls.map((u) => normalizeUrl(u)))];
}

// ─── Domain extraction ───────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function extractSlug(url: string): string | null {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    // Last path segment, or second-to-last if it ends in a numeric ID
    const last = segments[segments.length - 1];
    if (last && /^\d+$/.test(last) && segments.length >= 2) {
      return segments[segments.length - 2] ?? null;
    }
    return last || null;
  } catch {
    return null;
  }
}

// ─── Cross-protocol ID mapping patterns ──────────────────────────────────

interface CrossProtocolMap {
  sourceProtocol: string;
  sourceId: string;
  targetProtocol: string;
  targetId: string;
  confidence: number;
  discoveredAt: number;
}

function inferCrossProtocolId(
  _protocol: string,
  text: string,
): Array<{ targetProtocol: string; targetId: string; confidence: number }> {
  const results: Array<{ targetProtocol: string; targetId: string; confidence: number }> = [];
  const urlRegex = /https?:\/\/[^\s<>"]+/g;
  const urls = text.match(urlRegex) ?? [];

  for (const url of urls) {
    try {
      const u = new URL(url);
      // Nostr note links
      if (u.hostname.includes('nostr') && u.pathname.includes('/')) {
        const noteMatch = u.pathname.match(/note1[a-z0-9]+/);
        if (noteMatch) {
          results.push({ targetProtocol: 'nostr', targetId: noteMatch[0], confidence: 0.9 });
        }
      }
      // Farcaster cast links
      if (u.hostname.includes('warpcast.com') && u.pathname.match(/\/\w+\/0x[a-f0-9]+/)) {
        const parts = u.pathname.split('/');
        const castHash = parts[parts.length - 1];
        if (castHash) {
          results.push({ targetProtocol: 'farcaster', targetId: castHash, confidence: 0.9 });
        }
      }
      // Bluesky post links
      if (u.hostname.includes('bsky.app') && u.pathname.includes('/post/')) {
        const atUri = u.pathname.split('/post/')[1];
        if (atUri) {
          results.push({ targetProtocol: 'bluesky', targetId: `at://${atUri}`, confidence: 0.9 });
        }
      }
      // Mastodon post links
      if (u.hostname.includes('mastodon') || u.hostname.includes('social')) {
        const statusMatch = u.pathname.match(/\/@\w+\/(\d+)/);
        if (statusMatch) {
          results.push({
            targetProtocol: 'mastodon',
            targetId: statusMatch[1] ?? '',
            confidence: 0.8,
          });
        }
      }
      // YouTube video links
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (ytMatch) {
        results.push({ targetProtocol: 'youtube', targetId: ytMatch[1] ?? '', confidence: 0.9 });
      }
      // PeerTube video links
      if (u.hostname.includes('peertube') || u.hostname.includes('video.degenfeed')) {
        const watchMatch = u.pathname.match(/\/w\/(\w+)/);
        if (watchMatch) {
          results.push({
            targetProtocol: 'peertube',
            targetId: watchMatch[1] ?? '',
            confidence: 0.8,
          });
        }
      }
    } catch {
      // skip invalid URLs
    }
  }

  return results;
}

// ─── Quote-posting detection ─────────────────────────────────────────────

const CROSS_POST_PATTERNS = [
  /^cross.?post(?:ed)?:?/i,
  /^also (?:posted|shared|published) (?:on|to):?/i,
  /^re.?post(?:ed)? (?:from|via):?/i,
  /^syndicated (?:from|to):?/i,
  /^mirror(?:ed)? (?:from|to):?/i,
  /^\[cross.?post\]/i,
  /^RT\b/i,
  /^📢/i,
  /^♻️/i,
];

function isQuotePost(text: string): boolean {
  return CROSS_POST_PATTERNS.some((p) => p.test(text.trim()));
}

function extractQuotedUrls(text: string): string[] {
  // Look for quoted content markers
  const urls: string[] = [];
  const urlRegex = /https?:\/\/[^\s<>"]+/g;

  // Check for blockquote HTML
  const blockquoteMatch = text.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i);
  if (blockquoteMatch) {
    const innerUrls = blockquoteMatch[1]?.match(urlRegex) ?? [];
    urls.push(...innerUrls);
  }

  // Check for markdown blockquotes (> url)
  const mdBlockquoteRe = /^>\s*(https?:\/\/\S+)/gm;
  let m;
  while ((m = mdBlockquoteRe.exec(text)) !== null) {
    if (m[1]) urls.push(m[1]);
  }

  return urls;
}

// ─── Main Dedup Engine ────────────────────────────────────────────────────

export class GlobalDedupRegistry {
  private env: Env;
  private requestCache: Map<string, DedupResult>;

  constructor(env: Env) {
    this.env = env;
    this.requestCache = new Map();
  }

  // ── 15-Layer Dedup Check ──────────────────────────────────────────────
  // Each layer returns a { isDuplicate, method, confidence, clusterId } or null.

  /**
   * Layer 1: SHA-256 content hash (exact match).
   */
  private async layerContentHash(text: string): Promise<DedupResult | null> {
    if (!text || text.trim().length < 20) return null;
    const normalized = normalizeText(text);
    if (normalized.length < 10) return null;
    const hash = await sha256Hex(normalized);
    return this.lookupByHash(hash, 'sha256-content');
  }

  /**
   * Layer 2: Normalized URL matching.
   */
  private async layerUrlMatch(urls: string[]): Promise<DedupResult | null> {
    for (const url of urls) {
      const normalized = normalizeUrl(url);
      if (normalized.length < 5) continue;
      const hash = await sha256Hex(`url:${normalized}`);
      const result = await this.lookupByHash(hash, 'normalized-url');
      if (result) return result;
    }
    return null;
  }

  /**
   * Layer 3: Title Levenshtein distance (<85% = dupe).
   */
  private async layerTitleSimilarity(title: string): Promise<DedupResult | null> {
    if (!title || title.trim().length < 5) return null;
    const normalized = normalizeTitle(title);
    // Check all known title fingerprints for similarity
    const knownTitles = await this.getAllRecentTitleFingerprints();
    for (const known of knownTitles) {
      const sim = normalizedLevenshteinSim(normalized, known.title);
      if (sim >= LEVENSHTEIN_SIMILARITY_THRESHOLD) {
        const hash = await sha256Hex(`title:${normalized}`);
        return this.lookupByHash(hash, 'title-levenshtein');
      }
    }
    return null;
  }

  /**
   * Layer 4: First 200 chars normalized similarity.
   */
  private async layerFirst200Similarity(text: string): Promise<DedupResult | null> {
    if (!text || text.trim().length < 20) return null;
    const prefix = normalizeText(text).slice(0, 200);
    if (prefix.length < 10) return null;
    const hash = await sha256Hex(`prefix:${prefix}`);
    return this.lookupByHash(hash, 'first-200');
  }

  /**
   * Layer 5: Image perceptual hash.
   */
  private async layerImagePerceptualHash(embedUrls: string[]): Promise<DedupResult | null> {
    const phash = imagePerceptualFingerprint(embedUrls);
    if (!phash) return null;
    const hash = await sha256Hex(`phash:${phash}`);
    return this.lookupByHash(hash, 'image-phash');
  }

  /**
   * Layer 6: Link canonical URL matching.
   */
  private async layerCanonicalUrl(urls: string[]): Promise<DedupResult | null> {
    // Skip social media URLs to find the actual shared article URL
    const socialDomains = ['twitter.com', 'x.com', 'bsky.app', 'warpcast.com', 'nostr.', 't.co'];
    for (const url of urls) {
      try {
        const u = new URL(url);
        if (socialDomains.some((d) => u.hostname.includes(d))) continue;
        const canonical = u.origin + u.pathname.replace(/\/$/, '');
        const hash = await sha256Hex(`canonical:${canonical}`);
        const result = await this.lookupByHash(hash, 'canonical-url');
        if (result) return result;
      } catch {
        // skip
      }
    }
    return null;
  }

  /**
   * Layer 7: Author + title combination.
   */
  private async layerAuthorTitle(
    authorId: string | undefined,
    title: string | undefined,
  ): Promise<DedupResult | null> {
    if (!authorId || !title || authorId.length < 3 || title.length < 5) return null;
    const normalizedTitle = normalizeTitle(title);
    const combo = `author:${authorId}:${normalizedTitle.slice(0, 50)}`;
    const hash = await sha256Hex(combo);
    return this.lookupByHash(hash, 'author-title');
  }

  /**
   * Layer 8: Domain + slug matching.
   */
  private async layerDomainSlug(urls: string[]): Promise<DedupResult | null> {
    for (const url of urls) {
      const domain = extractDomain(url);
      const slug = extractSlug(url);
      if (domain && slug && slug.length > 5) {
        const key = `domainslug:${domain}:${slug}`;
        const hash = await sha256Hex(key);
        const result = await this.lookupByHash(hash, 'domain-slug');
        if (result) return result;
      }
    }
    return null;
  }

  /**
   * Layer 9: OG metadata matching.
   */
  private async layerOgMetadata(
    ogTitle?: string,
    ogDescription?: string,
    _ogImage?: string,
  ): Promise<DedupResult | null> {
    const metaText = [ogTitle, ogDescription].filter(Boolean).join(' ').trim();
    if (metaText.length < 10) return null;

    const normalized = normalizeText(metaText);
    if (normalized.length < 10) return null;
    const hash = await sha256Hex(`og:${normalized}`);
    return this.lookupByHash(hash, 'og-metadata');
  }

  /**
   * Layer 10: Cross-protocol ID mapping.
   */
  private async layerCrossProtocolMapping(
    protocol: string,
    text: string,
  ): Promise<DedupResult | null> {
    const mappings = inferCrossProtocolId(protocol, text);
    for (const mapping of mappings) {
      const xKey = `${mapping.targetProtocol}:${mapping.targetId}`;
      const known = await this.lookupCrossProtocolMap(xKey);
      if (known) {
        return {
          isDuplicate: true,
          method: 'cross-protocol-mapping',
          clusterId: known.clusterId,
          confidence: mapping.confidence,
          copyCount: known.copyCount,
          protocols: known.protocols,
          canonicalReference: known.canonicalReference,
        };
      }
    }
    return null;
  }

  /**
   * Layer 11: Quote-posting detection.
   */
  private async layerQuotePost(text: string, urls: string[]): Promise<DedupResult | null> {
    if (!isQuotePost(text)) return null;

    // Check the URLs in the quote for duplicates
    const quotedUrls = extractQuotedUrls(text);
    const allUrls = [...new Set([...urls, ...quotedUrls])];
    for (const url of allUrls) {
      const normalized = normalizeUrl(url);
      const hash = await sha256Hex(`url:${normalized}`);
      const result = await this.lookupByHash(hash, 'quote-post');
      if (result) return result;
    }
    return null;
  }

  /**
   * Layer 12: Thread detection.
   */
  private async layerThreadDetection(
    rootId?: string,
    _parentId?: string,
  ): Promise<DedupResult | null> {
    // If this is part of a thread, flag as dupe of the thread root
    if (rootId) {
      const hash = await sha256Hex(`thread:${rootId}`);
      const result = await this.lookupByHash(hash, 'thread-detection');
      if (result) return result;
    }
    return null;
  }

  /**
   * Layer 13: Timestamp proximity ±5min from same author.
   */
  private async layerTimestampProximity(
    authorId: string | undefined,
    createdAt: number | undefined,
  ): Promise<DedupResult | null> {
    if (!authorId || !createdAt) return null;
    const windowStart = createdAt - TIMESTAMP_PROXIMITY_MS;
    const windowEnd = createdAt + TIMESTAMP_PROXIMITY_MS;
    // Check recent entries by this author within the time window
    const recentEntries = await this.getRecentByAuthor(authorId, windowStart, windowEnd);
    if (recentEntries.length > 0) {
      const entry = recentEntries[0]!;
      // Get cluster info for copyCount and protocols
      let copyCount = 1;
      let protocols: string[] = [entry.sourceProtocol];
      if (entry.clusterId) {
        const cluster = await this.getCluster(entry.clusterId);
        if (cluster) {
          copyCount = cluster.copyCount;
          protocols = cluster.protocols;
        }
      }
      return {
        isDuplicate: true,
        method: 'timestamp-proximity',
        clusterId: entry.clusterId ?? null,
        confidence: 0.7,
        copyCount,
        protocols,
        canonicalReference: { protocol: entry.sourceProtocol, id: entry.sourceId },
      };
    }
    return null;
  }

  /**
   * Layer 14: Embedded content detection.
   */
  private async layerEmbeddedContent(text: string, urls: string[]): Promise<DedupResult | null> {
    // Detect when a tweet/note is embedded in an article body → dupe of original
    const embeddedUrls = extractQuotedUrls(text);
    for (const url of [...urls, ...embeddedUrls]) {
      const normalized = normalizeUrl(url);
      const hash = await sha256Hex(`url:${normalized}`);
      const result = await this.lookupByHash(hash, 'embedded-content');
      if (result) return result;
    }
    return null;
  }

  /**
   * Layer 15: RSS GUID dedup.
   */
  private async layerRssGuid(rssGuid?: string): Promise<DedupResult | null> {
    if (!rssGuid || rssGuid.length < 3) return null;
    const hash = await sha256Hex(`rssguid:${rssGuid}`);
    return this.lookupByHash(hash, 'rss-guid');
  }

  // ── KV Lookup Helpers ──────────────────────────────────────────────────

  /**
   * Look up a fingerprint by its dedup hash.
   */
  private async lookupByHash(hash: string, method: string): Promise<DedupResult | null> {
    if (!this.env.DEDUP) return null;

    try {
      const raw = await this.env.DEDUP.get(`${FINGERPRINT_PREFIX}${hash}`);
      if (raw) {
        const fp = JSON.parse(raw) as DedupFingerprint;
        // Get cluster info
        const clusterRaw = await this.env.DEDUP.get(`${CLUSTER_PREFIX}${fp.clusterId}`);
        if (clusterRaw) {
          const cluster = JSON.parse(clusterRaw) as DedupCluster;
          return {
            isDuplicate: true,
            method,
            clusterId: fp.clusterId ?? null,
            confidence: 0.95,
            copyCount: cluster.copyCount,
            protocols: cluster.protocols,
            canonicalReference: {
              protocol: cluster.copies[0]?.sourceProtocol,
              id: cluster.copies[0]?.sourceId,
            },
          };
        }
        return {
          isDuplicate: true,
          method,
          clusterId: fp.clusterId ?? null,
          confidence: 0.95,
          copyCount: 1,
          protocols: [fp.sourceProtocol],
        };
      }
    } catch {
      // KV hiccup — treat as not duplicate
    }
    return null;
  }

  /**
   * Look up a cross-protocol mapping.
   */
  private async lookupCrossProtocolMap(key: string): Promise<{
    clusterId: string;
    copyCount: number;
    protocols: string[];
    canonicalReference: { protocol: string; id: string };
  } | null> {
    if (!this.env.DEDUP) return null;
    try {
      const raw = await this.env.DEDUP.get(`${CROSS_MAP_PREFIX}${key}`);
      if (raw) {
        const map = JSON.parse(raw) as CrossProtocolMap;
        const clusterRaw = await this.env.DEDUP.get(
          `${CLUSTER_PREFIX}${map.targetProtocol}:${map.targetId}`,
        );
        if (clusterRaw) {
          const cluster = JSON.parse(clusterRaw) as DedupCluster;
          return {
            clusterId: cluster.clusterId,
            copyCount: cluster.copyCount,
            protocols: cluster.protocols,
            canonicalReference: {
              protocol: cluster.copies[0]?.sourceProtocol,
              id: cluster.copies[0]?.sourceId,
            },
          };
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Get recent dedup entries by author within a time window.
   */
  private async getRecentByAuthor(
    authorId: string,
    windowStart: number,
    windowEnd: number,
  ): Promise<DedupFingerprint[]> {
    if (!this.env.DEDUP) return [];
    try {
      const raw = await this.env.DEDUP.get(`dedup:author:${authorId}`);
      if (raw) {
        const entries = JSON.parse(raw) as DedupFingerprint[];
        return entries.filter((e) => e.firstSeen >= windowStart && e.firstSeen <= windowEnd);
      }
    } catch {
      // ignore
    }
    return [];
  }

  /**
   * Get all recent title fingerprints for title-level comparison.
   */
  private async getAllRecentTitleFingerprints(): Promise<Array<{ title: string; hash: string }>> {
    if (!this.env.DEDUP) return [];
    try {
      const raw = await this.env.DEDUP.get('dedup:titles:recent');
      if (raw) {
        return JSON.parse(raw) as Array<{ title: string; hash: string }>;
      }
    } catch {
      // ignore
    }
    return [];
  }

  // ─── Public Check / Register Methods ──────────────────────────────────

  /**
   * Check if content is a duplicate across ALL 15 layers.
   * Returns the first matching result (highest confidence).
   */
  async checkDuplicate(req: DedupCheckRequest): Promise<DedupResult> {
    const cacheKey = `${req.protocol}:${req.sourceId}`;
    const cached = this.requestCache.get(cacheKey);
    if (cached) return cached;

    const urls = req.url
      ? [normalizeUrl(req.url)]
      : extractEmbedUrls(
          req.text ?? '',
          req.embedUrls?.map((u) => ({ url: u })),
        );

    // Run all layers in parallel, return first positive hit
    const layers: Array<Promise<DedupResult | null>> = [
      this.layerContentHash(req.text ?? ''),
      this.layerUrlMatch(urls),
      this.layerFirst200Similarity(req.text ?? ''),
      this.layerCanonicalUrl(urls),
      this.layerDomainSlug(urls),
      this.layerCrossProtocolMapping(req.protocol, req.text ?? ''),
      this.layerQuotePost(req.text ?? '', urls),
      this.layerEmbeddedContent(req.text ?? '', urls),
    ];

    // Add optional layers
    if (req.title) {
      layers.push(this.layerTitleSimilarity(req.title));
      layers.push(this.layerAuthorTitle(req.authorId, req.title));
    }
    if (req.embedUrls?.length) {
      layers.push(this.layerImagePerceptualHash(req.embedUrls));
    }
    if (req.ogTitle || req.ogDescription) {
      layers.push(this.layerOgMetadata(req.ogTitle, req.ogDescription, req.ogImage));
    }
    if (req.rootId) {
      layers.push(this.layerThreadDetection(req.rootId, req.parentId));
    }
    if (req.authorId && req.createdAt) {
      layers.push(this.layerTimestampProximity(req.authorId, req.createdAt));
    }
    if (req.rssGuid) {
      layers.push(this.layerRssGuid(req.rssGuid));
    }

    const results = await Promise.all(layers);
    for (const result of results) {
      if (result?.isDuplicate) {
        this.requestCache.set(cacheKey, result);
        return result;
      }
    }

    const notDup: DedupResult = {
      isDuplicate: false,
      method: null,
      clusterId: null,
      confidence: 1.0,
      copyCount: 0,
      protocols: [req.protocol],
    };
    this.requestCache.set(cacheKey, notDup);
    return notDup;
  }

  /**
   * Register content in the dedup registry.
   * Creates fingerprints and cluster. Returns the cluster ID.
   */
  async register(req: DedupCheckRequest): Promise<{ clusterId: string; isNew: boolean }> {
    const text = req.text ?? '';
    const normalized = normalizeText(text);
    const contentHash = normalized.length >= 10 ? await sha256Hex(normalized) : '';
    const titleHash = req.title ? await sha256Hex(`title:${normalizeTitle(req.title)}`) : '';
    const urls = req.url
      ? [normalizeUrl(req.url)]
      : extractEmbedUrls(
          text,
          req.embedUrls?.map((u) => ({ url: u })),
        );

    const urlHashes: string[] = [];
    for (const url of urls) {
      urlHashes.push(await sha256Hex(`url:${url}`));
    }

    // Build unique content hash (content + title + canonical url)
    const canonicalUrl = urls
      .map((u) => {
        try {
          const parsed = new URL(u);
          const socialDomains = [
            'twitter.com',
            'x.com',
            'bsky.app',
            'warpcast.com',
            'nostr.',
            't.co',
          ];
          if (socialDomains.some((d) => parsed.hostname.includes(d))) return null;
          return parsed.origin + parsed.pathname.replace(/\/$/, '');
        } catch {
          return null;
        }
      })
      .find(Boolean);
    const uniqueComponents = [contentHash, titleHash, canonicalUrl].filter(Boolean);
    const uniqueHash =
      uniqueComponents.length > 0
        ? await sha256Hex(uniqueComponents.join('|'))
        : await sha256Hex(`${req.protocol}:${req.sourceId}`);

    if (!this.env.DEDUP) {
      return { clusterId: uniqueHash, isNew: true };
    }

    try {
      // Check existing cluster
      const existingRaw = await this.env.DEDUP.get(`${FINGERPRINT_PREFIX}${uniqueHash}`);
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as DedupFingerprint;
        // Update cluster
        if (existing.clusterId) {
          const clusterRaw = await this.env.DEDUP.get(`${CLUSTER_PREFIX}${existing.clusterId}`);
          if (clusterRaw) {
            const cluster = JSON.parse(clusterRaw) as DedupCluster;
            // Check if this copy already exists
            const alreadyRegistered = cluster.copies.some(
              (c) => c.sourceProtocol === req.protocol && c.sourceId === req.sourceId,
            );
            if (!alreadyRegistered) {
              cluster.copies.push({
                contentHash,
                urlHashes,
                titleFingerprint: titleHash,
                sourceProtocol: req.protocol,
                sourceId: req.sourceId,
                firstSeen: Date.now(),
                clusterId: existing.clusterId,
              });
              cluster.copyCount = cluster.copies.length;
              cluster.protocols = [...new Set([...cluster.protocols, req.protocol])];
              cluster.updatedAt = Date.now();

              await this.env.DEDUP.put(
                `${CLUSTER_PREFIX}${existing.clusterId}`,
                JSON.stringify(cluster),
              );
            }
            return { clusterId: existing.clusterId, isNew: false };
          }
        }
      }

      // Create new cluster
      const clusterId = `${req.protocol}:${req.sourceId}`;
      const now = Date.now();
      const fingerprint: DedupFingerprint = {
        contentHash,
        urlHashes,
        titleFingerprint: titleHash,
        sourceProtocol: req.protocol,
        sourceId: req.sourceId,
        firstSeen: now,
        clusterId,
      };

      const cluster: DedupCluster = {
        clusterId,
        copies: [fingerprint],
        canonicalHash: uniqueHash,
        copyCount: 1,
        protocols: [req.protocol],
        createdAt: now,
        updatedAt: now,
      };

      // Store fingerprint (points to cluster)
      await this.env.DEDUP.put(
        `${FINGERPRINT_PREFIX}${uniqueHash}`,
        JSON.stringify(fingerprint),
        { expirationTtl: 60 * 60 * 24 * 90 }, // 90 day TTL
      );

      // Store cluster
      await this.env.DEDUP.put(`${CLUSTER_PREFIX}${clusterId}`, JSON.stringify(cluster), {
        expirationTtl: 60 * 60 * 24 * 90,
      });

      // Store cross-protocol mappings
      if (text) {
        const mappings = inferCrossProtocolId(req.protocol, text);
        for (const mapping of mappings) {
          const xKey = `${mapping.targetProtocol}:${mapping.targetId}`;
          await this.env.DEDUP.put(
            `${CROSS_MAP_PREFIX}${xKey}`,
            JSON.stringify({
              sourceProtocol: req.protocol,
              sourceId: req.sourceId,
              targetProtocol: mapping.targetProtocol,
              targetId: mapping.targetId,
              confidence: mapping.confidence,
              discoveredAt: now,
            } as CrossProtocolMap),
            { expirationTtl: 60 * 60 * 24 * 90 },
          );
          // Also store reverse
          const reverseKey = `${req.protocol}:${req.sourceId}`;
          await this.env.DEDUP.put(
            `${CROSS_MAP_PREFIX}${reverseKey}`,
            JSON.stringify({
              sourceProtocol: mapping.targetProtocol,
              sourceId: mapping.targetId,
              targetProtocol: req.protocol,
              targetId: req.sourceId,
              confidence: mapping.confidence,
              discoveredAt: now,
            } as CrossProtocolMap),
            { expirationTtl: 60 * 60 * 24 * 90 },
          );
        }
      }

      // Store recent title fingerprints (for Levenshtein matching)
      if (req.title) {
        const recentRaw = await this.env.DEDUP.get('dedup:titles:recent');
        const recentTitles: Array<{ title: string; hash: string }> = recentRaw
          ? JSON.parse(recentRaw)
          : [];
        recentTitles.push({
          title: normalizeTitle(req.title),
          hash: await sha256Hex(`title:${normalizeTitle(req.title)}`),
        });
        // Keep the last 1000 titles
        while (recentTitles.length > 1000) recentTitles.shift();
        await this.env.DEDUP.put('dedup:titles:recent', JSON.stringify(recentTitles), {
          expirationTtl: 60 * 60 * 24 * 7,
        });
      }

      // Update author's recent entries
      if (req.authorId) {
        const authorRaw = await this.env.DEDUP.get(`dedup:author:${req.authorId}`);
        const authorEntries: DedupFingerprint[] = authorRaw ? JSON.parse(authorRaw) : [];
        authorEntries.push(fingerprint);
        // Keep last 100
        while (authorEntries.length > 100) authorEntries.shift();
        await this.env.DEDUP.put(`dedup:author:${req.authorId}`, JSON.stringify(authorEntries), {
          expirationTtl: 60 * 60 * 24 * 7,
        });
      }

      // Update bloom filter
      if (this.env.CACHE) {
        try {
          const bloomRaw = await this.env.CACHE.get(BLOOM_FILTER_KEY);
          const bloom: string[] = bloomRaw ? JSON.parse(bloomRaw) : [];
          bloom.push(uniqueHash);
          // Keep last 100K entries in bloom
          while (bloom.length > 100000) bloom.shift();
          await this.env.CACHE.put(BLOOM_FILTER_KEY, JSON.stringify(bloom), {
            expirationTtl: 60 * 60 * 24,
          });
        } catch {
          // Non-critical
        }
      }

      return { clusterId, isNew: true };
    } catch (err) {
      console.error('Dedup registry register error:', err);
      return { clusterId: uniqueHash, isNew: true };
    }
  }

  /**
   * Get all copies (cluster) of the same content.
   */
  async getCluster(clusterId: string): Promise<DedupCluster | null> {
    if (!this.env.DEDUP) return null;
    try {
      const raw = await this.env.DEDUP.get(`${CLUSTER_PREFIX}${clusterId}`);
      if (raw) return JSON.parse(raw) as DedupCluster;
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Quick bloom-filter check: "probably seen before?"
   * May have false positives but no false negatives.
   */
  async probablySeen(req: DedupCheckRequest): Promise<boolean> {
    if (!this.env.CACHE) return false;
    try {
      const bloomRaw = await this.env.CACHE.get(BLOOM_FILTER_KEY);
      if (!bloomRaw) return false;
      const bloom: string[] = JSON.parse(bloomRaw);

      // Check content hash
      const text = req.text ?? '';
      if (text.trim().length >= 10) {
        const normalized = normalizeText(text);
        const hash = await sha256Hex(normalized);
        if (bloom.includes(hash)) return true;
      }

      // Check URL
      if (req.url) {
        const urlHash = await sha256Hex(`url:${normalizeUrl(req.url)}`);
        if (bloom.includes(urlHash)) return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Clear the request-level cache (useful between batches).
   */
  clearCache(): void {
    this.requestCache.clear();
  }
}
