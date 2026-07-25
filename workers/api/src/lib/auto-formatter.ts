/**
 * @degenfeed/api-worker — Auto-Formatting Engine
 *
 * Premium auto-formatting for cross-posts:
 *   - Auto-threading: split long content into threads per-platform
 *   - Hashtag optimization: AI-powered hashtag suggestions + platform adaptation
 *   - Image optimization: auto-resize, format conversion per platform
 *   - Link optimization: UTM params, link shortening
 *   - Language adaptation: tone adjustment per platform
 *
 * Each formatter takes a MasterPost and returns per-protocol formatted output.
 * Used by the premium publish queue before dispatch.
 */

import type { MasterPost, ProtocolPublishParams } from '@degenfeed/cross-protocol-bridge';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ThreadSegment {
  index: number;
  text: string;
  charCount: number;
}

export interface FormattedPost extends ProtocolPublishParams {
  /** Thread segments if auto-threaded */
  thread?: ThreadSegment[];
  /** Optimized image URLs */
  optimizedImages?: Array<{ url: string; alt: string }>;
  /** Optimized link URLs */
  optimizedLinks?: Array<{ original: string; optimized: string }>;
  /** Platform-specific hashtags */
  hashtagSuggestions?: string[];
}

export interface AutoFormatOptions {
  /** Enable auto-threading for long posts */
  autoThread?: boolean;
  /** Max characters per thread segment */
  threadCharLimit?: number;
  /** Enable hashtag optimization */
  optimizeHashtags?: boolean;
  /** Enable image optimization */
  optimizeImages?: boolean;
  /** Enable link optimization (UTM params) */
  optimizeLinks?: boolean;
  /** Enable language adaptation */
  adaptLanguage?: boolean;
  /** UTM source campaign name */
  utmCampaign?: string;
  /** Custom hashtags to add */
  extraHashtags?: string[];
}

// ─── Platform Char Limits ─────────────────────────────────────────────────

const PLATFORM_LIMITS: Record<string, number> = {
  mastodon: 500,
  bluesky: 300,
  nostalgia: 50000,
  nostr: 50000,
  farcaster: 320,
  lens: 5000,
  threads: 500,
  reddit: 40000,
  telegram: 4096,
  discord: 2000,
  lemmy: 50000,
  peertube: 5000,
  pixelfed: 5000,
};

const PLATFORM_THREAD_SUPPORT: Record<string, boolean> = {
  mastodon: true,
  bluesky: false, // No native threads
  nostr: true,
  farcaster: false,
  lens: false,
  threads: true,
  reddit: false,
  telegram: false,
  discord: false,
  lemmy: false,
  peertube: false,
  pixelfed: false,
};

const PLATFORM_HASHTAG_STYLE: Record<string, 'hash' | 'bare' | 'camel'> = {
  mastodon: 'hash',
  bluesky: 'hash',
  nostr: 'bare', // Nostr uses # in content but also supports bare tags
  farcaster: 'hash',
  lens: 'hash',
  threads: 'hash',
  reddit: 'bare', // Reddit doesn't use hashtags traditionally
  telegram: 'hash',
  discord: 'hash',
  lemmy: 'bare', // Lemmy doesn't use hashtags
  peertube: 'hash',
  pixelfed: 'hash',
};

// ─── 1. Auto-Threading Engine ─────────────────────────────────────────────

/**
 * Split long text into thread segments suitable for a specific platform.
 * Respects sentence boundaries, char limits, and platform thread support.
 */
export function autoThread(
  text: string,
  protocol: string,
  maxChars: number = PLATFORM_LIMITS[protocol] ?? 500,
): ThreadSegment[] {
  // If text fits in a single post, return as-is
  if (text.length <= maxChars) {
    return [{ index: 0, text, charCount: text.length }];
  }

  // If platform doesn't support threads, truncate
  if (!PLATFORM_THREAD_SUPPORT[protocol]) {
    return [
      {
        index: 0,
        text: `${text.slice(0, maxChars - 3)}...`,
        charCount: Math.min(text.length, maxChars),
      },
    ];
  }

  const segments: ThreadSegment[] = [];
  const sentences = splitIntoSentences(text);
  let currentSegment = '';
  let segmentIndex = 0;

  for (const sentence of sentences) {
    const suffix = segments.length > 0 ? ` (${segmentIndex + 1}/?)` : '';
    const maxWithSuffix = maxChars - suffix.length - 3; // 3 for "..." if needed

    // If a single sentence is too long, hard-split it
    if (sentence.length > maxWithSuffix) {
      // Flush current segment first
      if (currentSegment) {
        segments.push({
          index: segmentIndex++,
          text: currentSegment.trim(),
          charCount: currentSegment.trim().length,
        });
        currentSegment = '';
      }

      // Hard-split long sentence across multiple segments
      let remaining = sentence;
      while (remaining.length > 0) {
        const totalSegments = Math.ceil(sentence.length / maxChars);
        const counter = ` (${segmentIndex + 1}/${totalSegments})`;
        const chunkLen = maxChars - counter.length;
        const chunk = remaining.slice(0, chunkLen);
        segments.push({
          index: segmentIndex++,
          text: chunk.trim() + counter,
          charCount: chunk.length + counter.length,
        });
        remaining = remaining.slice(chunkLen);
      }
      continue;
    }

    // Check if adding this sentence would exceed the limit
    const testSegment = currentSegment ? `${currentSegment} ${sentence}` : sentence;
    const totalLen = testSegment.length + suffix.length;

    if (totalLen > maxChars) {
      // Emit current segment and start new
      const total = Math.ceil(text.length / maxChars);
      const segSuffix = segmentIndex > 0 ? ` (${segmentIndex + 1}/${total})` : '';
      segments.push({
        index: segmentIndex++,
        text: currentSegment.trim() + segSuffix,
        charCount: currentSegment.trim().length + segSuffix.length,
      });
      currentSegment = sentence;
    } else {
      currentSegment = testSegment;
    }
  }

  // Flush last segment
  if (currentSegment) {
    const total = Math.max(segments.length + 1, 1);
    const segSuffix = segmentIndex > 0 ? ` (${segmentIndex + 1}/${total})` : '';
    segments.push({
      index: segmentIndex++,
      text: currentSegment.trim() + segSuffix,
      charCount: currentSegment.trim().length + segSuffix.length,
    });
  }

  // Update counters in all segments to reflect final count
  const finalCount = segments.length;
  return segments.map((seg, i) => ({
    ...seg,
    text: i > 0 ? seg.text.replace(/\(\d+\/\?\)$/, `(${i + 1}/${finalCount})`) : seg.text,
    index: i,
  }));
}

/**
 * Split text into sentences, preserving punctuation.
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries: . ! ? followed by space or end
  const raw = text.match(/[^.!?\n]+[.!?\n]*\s*/g) ?? [text];
  return raw.map((s) => s.trim()).filter(Boolean);
}

// ─── 2. Hashtag Optimization ──────────────────────────────────────────────

export interface HashtagSuggestion {
  tag: string;
  relevance: number;
  platformPopularity?: Record<string, number>;
}

/**
 * Optimize hashtags for a specific platform.
 * Includes basic de-duplication, styling, and length limits.
 */
export function optimizeHashtags(
  hashtags: string[],
  protocol: string,
  maxHashtags: number = 8,
): string[] {
  if (!hashtags || hashtags.length === 0) return [];

  // Clean and deduplicate
  const cleaned = [
    ...new Set(
      hashtags
        .map((h) => h.replace(/^#/, '').trim().toLowerCase())
        .filter((h) => h.length > 0 && h.length <= 30),
    ),
  ];

  // Limit count
  const limited = cleaned.slice(0, maxHashtags);

  // Format per platform style
  const style = PLATFORM_HASHTAG_STYLE[protocol] ?? 'hash';
  switch (style) {
    case 'bare':
      return limited; // No # prefix
    case 'camel':
      return limited.map((h) => h.charAt(0).toUpperCase() + h.slice(1));
    default:
      return limited.map((h) => `#${h}`);
  }
}

/**
 * AI-powered hashtag suggestions based on post content.
 * Extracts keywords, finds relevant tags, ranks by relevance.
 */
export function suggestHashtags(
  text: string,
  existingHashtags: string[],
  _protocol: string,
  maxSuggestions: number = 5,
): HashtagSuggestion[] {
  const combined = `${text} ${existingHashtags.join(' ')}`.toLowerCase();

  // Extract meaningful keywords (words 3+ chars, no stop words)
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'are',
    'but',
    'not',
    'you',
    'all',
    'can',
    'had',
    'her',
    'was',
    'one',
    'our',
    'out',
    'has',
    'have',
    'been',
    'its',
    'just',
    'like',
    'more',
    'some',
    'than',
    'that',
    'them',
    'then',
    'they',
    'this',
    'very',
    'were',
    'what',
    'when',
    'where',
    'which',
    'who',
    'will',
    'with',
    'would',
    'about',
    'from',
    'your',
  ]);

  const words = combined
    .replace(/[^\w\s#]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w) && !w.startsWith('#'));

  // Count frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Score by frequency, penalize already-added tags
  const existingSet = new Set(existingHashtags.map((h) => h.toLowerCase().replace(/^#/, '')));
  const scored: HashtagSuggestion[] = [...freq.entries()]
    .filter(([word]) => !existingSet.has(word))
    .map(([word, count]) => ({
      tag: word,
      relevance: Math.min(1, count / Math.max(...freq.values())),
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, maxSuggestions);

  return scored;
}

// ─── 3. Image Optimization ────────────────────────────────────────────────

export interface ImageOptimizationResult {
  url: string;
  alt: string;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

/**
 * Platform-specific image constraints.
 */
const IMAGE_CONSTRAINTS: Record<
  string,
  {
    maxCount: number;
    maxWidth: number;
    maxHeight: number;
    aspectRatio?: number;
    formats: string[];
    maxSizeMB: number;
  }
> = {
  mastodon: {
    maxCount: 4,
    maxWidth: 1280,
    maxHeight: 1280,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    maxSizeMB: 8,
  },
  bluesky: {
    maxCount: 4,
    maxWidth: 2000,
    maxHeight: 2000,
    formats: ['jpeg', 'png'],
    maxSizeMB: 10,
  },
  nostr: {
    maxCount: 10,
    maxWidth: 4096,
    maxHeight: 4096,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    maxSizeMB: 10,
  },
  farcaster: {
    maxCount: 4,
    maxWidth: 1200,
    maxHeight: 1200,
    formats: ['jpeg', 'png', 'gif'],
    maxSizeMB: 5,
  },
  lens: {
    maxCount: 4,
    maxWidth: 2000,
    maxHeight: 2000,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    maxSizeMB: 10,
  },
  threads: {
    maxCount: 10,
    maxWidth: 2048,
    maxHeight: 2048,
    formats: ['jpeg', 'png'],
    maxSizeMB: 8,
  },
  reddit: {
    maxCount: 20,
    maxWidth: 4096,
    maxHeight: 4096,
    formats: ['jpeg', 'png', 'gif'],
    maxSizeMB: 20,
  },
  telegram: {
    maxCount: 10,
    maxWidth: 1280,
    maxHeight: 1280,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    maxSizeMB: 10,
  },
  discord: {
    maxCount: 10,
    maxWidth: 2048,
    maxHeight: 2048,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    maxSizeMB: 8,
  },
  lemmy: {
    maxCount: 1,
    maxWidth: 4096,
    maxHeight: 4096,
    formats: ['jpeg', 'png', 'gif'],
    maxSizeMB: 10,
  },
  peertube: {
    maxCount: 1,
    maxWidth: 4096,
    maxHeight: 4096,
    formats: ['jpeg', 'png'],
    maxSizeMB: 10,
  },
  pixelfed: {
    maxCount: 20,
    maxWidth: 4096,
    maxHeight: 4096,
    formats: ['jpeg', 'png', 'gif', 'webp'],
    maxSizeMB: 20,
  },
};

/**
 * Optimize images for a specific platform.
 * Returns image URLs with optimization params appended.
 * The actual resizing is done by the CDN/imagemagick pipeline.
 */
export function optimizeImages(
  images: Array<{ url: string; alt: string }>,
  protocol: string,
): Array<{ url: string; alt: string }> {
  if (!images || images.length === 0) return [];

  const constraints = IMAGE_CONSTRAINTS[protocol];
  if (!constraints) return images.slice(0, 4); // Default: up to 4

  const count = Math.min(images.length, constraints.maxCount);
  const result: Array<{ url: string; alt: string }> = [];

  for (let i = 0; i < count; i++) {
    const img = images[i];
    // Append CDN resize params if the image is hosted on our CDN
    const optimizedUrl = appendImageTransformParams(
      img.url,
      constraints.maxWidth,
      constraints.maxHeight,
      constraints.formats[0],
      constraints.maxSizeMB,
    );
    result.push({ url: optimizedUrl, alt: img.alt || `${i + 1}` });
  }

  return result;
}

/**
 * Append image transformation query params for CDN processing.
 * Supports imgix, Cloudflare Images, or custom CDN.
 */
function appendImageTransformParams(
  url: string,
  maxWidth: number,
  maxHeight: number,
  format: string,
  _maxSizeMB: number,
): string {
  // If already has params, skip (user-provided optimized URL)
  if (url.includes('?') && (url.includes('w=') || url.includes('width='))) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}w=${maxWidth}&h=${maxHeight}&fit=clip&format=${format}`;
}

// ─── 4. Link Optimization ─────────────────────────────────────────────────

export interface LinkOptimizationResult {
  original: string;
  optimized: string;
  type: 'utm' | 'shortened' | 'unchanged';
}

/**
 * Platform-specific link behavior.
 */
const LINK_BEHAVIOR: Record<
  string,
  {
    autoEmbed: boolean;
    maxLinks: number;
    shortenUrls: boolean;
  }
> = {
  mastodon: { autoEmbed: true, maxLinks: 10, shortenUrls: false },
  bluesky: { autoEmbed: true, maxLinks: 4, shortenUrls: false },
  nostr: { autoEmbed: true, maxLinks: 20, shortenUrls: false },
  farcaster: { autoEmbed: true, maxLinks: 4, shortenUrls: false },
  lens: { autoEmbed: true, maxLinks: 10, shortenUrls: false },
  threads: { autoEmbed: true, maxLinks: 1, shortenUrls: false },
  reddit: { autoEmbed: true, maxLinks: 1, shortenUrls: false },
  telegram: { autoEmbed: true, maxLinks: 10, shortenUrls: false },
  discord: { autoEmbed: true, maxLinks: 10, shortenUrls: false },
  lemmy: { autoEmbed: true, maxLinks: 1, shortenUrls: false },
  peertube: { autoEmbed: true, maxLinks: 5, shortenUrls: false },
  pixelfed: { autoEmbed: true, maxLinks: 5, shortenUrls: false },
};

/**
 * Optimize URLs with UTM tracking parameters.
 */
export function optimizeLinks(
  links: string[],
  protocol: string,
  campaign?: string,
): LinkOptimizationResult[] {
  if (!links || links.length === 0) return [];

  const behavior = LINK_BEHAVIOR[protocol] ?? { autoEmbed: true, maxLinks: 10, shortenUrls: false };
  const maxLinks = Math.min(links.length, behavior.maxLinks);
  const results: LinkOptimizationResult[] = [];

  for (let i = 0; i < maxLinks; i++) {
    const url = links[i];
    if (!isHttpUrl(url)) continue;

    const withUtm = campaign
      ? appendUtmParams(url, {
          utm_source: `degenfeed-${protocol}`,
          utm_medium: 'social',
          utm_campaign: campaign,
        })
      : url;

    results.push({
      original: url,
      optimized: withUtm,
      type: campaign ? 'utm' : 'unchanged',
    });
  }

  return results;
}

/**
 * Append UTM parameters to a URL.
 */
function appendUtmParams(
  url: string,
  params: {
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
  },
): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('utm_source', params.utm_source);
    parsed.searchParams.set('utm_medium', params.utm_medium);
    parsed.searchParams.set('utm_campaign', params.utm_campaign);
    return parsed.toString();
  } catch {
    return url; // Invalid URL, return as-is
  }
}

function isHttpUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

// ─── 5. Language Adaptation ────────────────────────────────────────────────

export interface LanguageAdaptationResult {
  text: string;
  tone: string;
  changes: string[];
}

/**
 * Platform-specific tone profiles.
 */
const TONE_PROFILES: Record<
  string,
  {
    tone: string;
    maxExclamation: number;
    useEmoji: boolean;
    formality: 'casual' | 'neutral' | 'professional';
    sentenceLengthPreference: 'short' | 'medium' | 'long';
  }
> = {
  mastodon: {
    tone: 'conversational',
    maxExclamation: 2,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'medium',
  },
  bluesky: {
    tone: 'snappy',
    maxExclamation: 2,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'short',
  },
  nostr: {
    tone: 'direct',
    maxExclamation: 1,
    useEmoji: true,
    formality: 'neutral',
    sentenceLengthPreference: 'long',
  },
  farcaster: {
    tone: 'concise',
    maxExclamation: 1,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'short',
  },
  lens: {
    tone: 'thoughtful',
    maxExclamation: 1,
    useEmoji: true,
    formality: 'neutral',
    sentenceLengthPreference: 'long',
  },
  threads: {
    tone: 'engaging',
    maxExclamation: 3,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'short',
  },
  reddit: {
    tone: 'informative',
    maxExclamation: 1,
    useEmoji: false,
    formality: 'neutral',
    sentenceLengthPreference: 'long',
  },
  telegram: {
    tone: 'direct',
    maxExclamation: 2,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'medium',
  },
  discord: {
    tone: 'casual',
    maxExclamation: 3,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'short',
  },
  lemmy: {
    tone: 'informative',
    maxExclamation: 1,
    useEmoji: false,
    formality: 'neutral',
    sentenceLengthPreference: 'long',
  },
  peertube: {
    tone: 'descriptive',
    maxExclamation: 1,
    useEmoji: true,
    formality: 'neutral',
    sentenceLengthPreference: 'medium',
  },
  pixelfed: {
    tone: 'visual',
    maxExclamation: 2,
    useEmoji: true,
    formality: 'casual',
    sentenceLengthPreference: 'short',
  },
};

/**
 * Adapt post content tone for a specific platform.
 * Adjusts exclamation count, emoji usage, and formality.
 */
export function adaptLanguage(text: string, protocol: string): LanguageAdaptationResult {
  const profile = TONE_PROFILES[protocol] ?? TONE_PROFILES.mastodon;
  const changes: string[] = [];
  let adapted = text;

  // 1. Limit exclamation marks
  const exclamationCount = (adapted.match(/!/g) ?? []).length;
  if (exclamationCount > profile.maxExclamation) {
    // Replace excess ! with .
    let count = 0;
    adapted = adapted.replace(/!/g, () => {
      count++;
      return count <= profile.maxExclamation ? '!' : '.';
    });
    changes.push(`Reduced exclamation marks from ${exclamationCount} to ${profile.maxExclamation}`);
  }

  // 2. Adjust emoji usage
  if (!profile.useEmoji) {
    const emojiCount = (adapted.match(/[\u{1F300}-\u{1F9FF}]/gu) ?? []).length;
    if (emojiCount > 0) {
      adapted = adapted.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      changes.push(`Removed ${emojiCount} emoji for ${protocol}`);
    }
  }

  // 3. Sentence length adjustment (basic heuristic)
  if (profile.sentenceLengthPreference === 'short') {
    const sentences = splitIntoSentences(adapted);
    const longSentences = sentences.filter((s) => s.length > 120);
    if (longSentences.length > 0) {
      changes.push(`Found ${longSentences.length} long sentences for ${protocol} (prefers short)`);
    }
  }

  return {
    text: adapted,
    tone: profile.tone,
    changes,
  };
}

// ─── 6. Master Format Pipeline ────────────────────────────────────────────

/**
 * Run the full auto-formatting pipeline for a post on a specific protocol.
 */
export function autoFormatPost(
  post: MasterPost,
  protocol: string,
  options: AutoFormatOptions = {},
): FormattedPost {
  const {
    autoThread: doAutoThread = true,
    optimizeHashtags: doOptimizeHashtags = true,
    optimizeImages: doOptimizeImages = true,
    optimizeLinks: doOptimizeLinks = true,
    adaptLanguage: doAdaptLanguage = true,
    utmCampaign,
    extraHashtags = [],
  } = options;

  let text = post.text;
  let hashtags = [...(post.hashtags ?? []), ...extraHashtags];
  const images = post.media?.map((m) => ({ url: m.url, alt: m.alt ?? '' })) ?? [];
  const links = post.linkCard ? [post.linkCard.url] : [];

  // 1. Language adaptation
  if (doAdaptLanguage) {
    const langResult = adaptLanguage(text, protocol);
    text = langResult.text;
  }

  // 2. Hashtag optimization
  if (doOptimizeHashtags && hashtags.length > 0) {
    hashtags = optimizeHashtags(hashtags, protocol);
  }

  // 3. Link optimization
  let optimizedLinks: Array<{ original: string; optimized: string }> | undefined;
  if (doOptimizeLinks && links.length > 0) {
    const linkResults = optimizeLinks(links, protocol, utmCampaign);
    optimizedLinks = linkResults.map((r) => ({
      original: r.original,
      optimized: r.optimized,
    }));
  }

  // 4. Image optimization
  let optimizedImages: Array<{ url: string; alt: string }> | undefined;
  if (doOptimizeImages && images.length > 0) {
    optimizedImages = optimizeImages(images, protocol);
  }

  // 5. Auto-threading
  let thread: ThreadSegment[] | undefined;
  if (doAutoThread) {
    thread = autoThread(text, protocol);
  }

  // Build final formatted post
  const charLimit = PLATFORM_LIMITS[protocol] ?? 500;
  const isThread = thread && thread.length > 1;

  return {
    protocol,
    text: isThread && thread ? thread[0].text : text,
    title: post.title,
    mediaUrls: optimizedImages?.map((i) => i.url),
    mediaAlts: optimizedImages?.map((i) => i.alt),
    formattedHashtags: hashtags,
    formattedMentions: post.mentions,
    extra: {
      thread: isThread ? thread : undefined,
      optimizedLinks,
      tone: TONE_PROFILES[protocol]?.tone ?? 'neutral',
      charLimit,
    },
    supportsRichText:
      protocol === 'telegram' ||
      protocol === 'discord' ||
      protocol === 'reddit' ||
      protocol === 'lemmy' ||
      protocol === 'peertube',
    thread: isThread ? thread : undefined,
    optimizedImages,
    optimizedLinks,
    hashtagSuggestions: doOptimizeHashtags
      ? suggestHashtags(text, post.hashtags ?? [], protocol).map((s) => s.tag)
      : undefined,
  };
}

/**
 * Format a post for ALL selected protocols in parallel.
 */
export function autoFormatForProtocols(
  post: MasterPost,
  protocols: string[],
  options: AutoFormatOptions = {},
): Record<string, FormattedPost> {
  const result: Record<string, FormattedPost> = {};
  for (const protocol of protocols) {
    result[protocol] = autoFormatPost(post, protocol, options);
  }
  return result;
}

// ─── 7. AI Time Optimization ──────────────────────────────────────────────

export interface BestTimeSlot {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  hourUTC: number;
  score: number;
  label: string;
}

/**
 * Best posting times per platform based on general engagement data.
 * Times are in UTC.
 */
const PLATFORM_BEST_TIMES: Record<string, BestTimeSlot[]> = {
  mastodon: [
    { dayOfWeek: 2, hourUTC: 14, score: 0.92, label: 'Tue 14:00 UTC' },
    { dayOfWeek: 3, hourUTC: 10, score: 0.88, label: 'Wed 10:00 UTC' },
    { dayOfWeek: 4, hourUTC: 15, score: 0.85, label: 'Thu 15:00 UTC' },
    { dayOfWeek: 1, hourUTC: 16, score: 0.82, label: 'Mon 16:00 UTC' },
    { dayOfWeek: 5, hourUTC: 11, score: 0.8, label: 'Fri 11:00 UTC' },
  ],
  bluesky: [
    { dayOfWeek: 2, hourUTC: 15, score: 0.9, label: 'Tue 15:00 UTC' },
    { dayOfWeek: 3, hourUTC: 12, score: 0.87, label: 'Wed 12:00 UTC' },
    { dayOfWeek: 1, hourUTC: 17, score: 0.84, label: 'Mon 17:00 UTC' },
    { dayOfWeek: 4, hourUTC: 14, score: 0.82, label: 'Thu 14:00 UTC' },
    { dayOfWeek: 5, hourUTC: 13, score: 0.79, label: 'Fri 13:00 UTC' },
  ],
  nostr: [
    { dayOfWeek: 2, hourUTC: 16, score: 0.88, label: 'Tue 16:00 UTC' },
    { dayOfWeek: 3, hourUTC: 14, score: 0.86, label: 'Wed 14:00 UTC' },
    { dayOfWeek: 4, hourUTC: 17, score: 0.83, label: 'Thu 17:00 UTC' },
    { dayOfWeek: 1, hourUTC: 18, score: 0.81, label: 'Mon 18:00 UTC' },
    { dayOfWeek: 5, hourUTC: 15, score: 0.78, label: 'Fri 15:00 UTC' },
  ],
  farcaster: [
    { dayOfWeek: 2, hourUTC: 17, score: 0.91, label: 'Tue 17:00 UTC' },
    { dayOfWeek: 3, hourUTC: 16, score: 0.89, label: 'Wed 16:00 UTC' },
    { dayOfWeek: 4, hourUTC: 18, score: 0.86, label: 'Thu 18:00 UTC' },
    { dayOfWeek: 5, hourUTC: 14, score: 0.84, label: 'Fri 14:00 UTC' },
    { dayOfWeek: 1, hourUTC: 19, score: 0.8, label: 'Mon 19:00 UTC' },
  ],
  threads: [
    { dayOfWeek: 2, hourUTC: 12, score: 0.85, label: 'Tue 12:00 UTC' },
    { dayOfWeek: 3, hourUTC: 14, score: 0.83, label: 'Wed 14:00 UTC' },
    { dayOfWeek: 4, hourUTC: 11, score: 0.81, label: 'Thu 11:00 UTC' },
    { dayOfWeek: 5, hourUTC: 15, score: 0.79, label: 'Fri 15:00 UTC' },
    { dayOfWeek: 1, hourUTC: 13, score: 0.77, label: 'Mon 13:00 UTC' },
  ],
};

/**
 * Get the best posting time for a set of protocols.
 * Returns the time slot that maximizes cross-platform engagement.
 */
export function getBestPostingTime(protocols: string[]): BestTimeSlot[] {
  if (!protocols || protocols.length === 0) {
    return [{ dayOfWeek: 2, hourUTC: 14, score: 1, label: 'Tue 14:00 UTC (default)' }];
  }

  // Collect all slots across selected protocols
  const allSlots: Map<string, BestTimeSlot & { count: number }> = new Map();

  for (const protocol of protocols) {
    const slots = PLATFORM_BEST_TIMES[protocol];
    if (!slots) continue;

    for (const slot of slots) {
      const key = `${slot.dayOfWeek}:${slot.hourUTC}`;
      const existing = allSlots.get(key);
      if (existing) {
        existing.score = Math.max(existing.score, slot.score);
        existing.count++;
      } else {
        allSlots.set(key, { ...slot, count: 1 });
      }
    }
  }

  // Sort by aggregate score (count * score = cross-platform fit)
  return [...allSlots.values()].sort((a, b) => b.count * b.score - a.count * a.score).slice(0, 5);
}

/**
 * Format a best time slot for display.
 */
export function formatBestTimeSlot(slot: BestTimeSlot): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourStr = `${slot.hourUTC.toString().padStart(2, '0')}:00`;
  return `${days[slot.dayOfWeek]} ${hourStr} UTC`;
}
