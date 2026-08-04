/**
 * @degenfeed/nostr-sdk — NIP-71: Video Events
 *
 * NIP-71 defines video content via two event kinds:
 *   - kind:34235 (Video Event)      — full-length video posts
 *   - kind:34236 (Short-form Video) — TikTok-style short video posts
 *
 * Video events have:
 *   - d tag: unique identifier
 *   - title: video title
 *   - published_at: publishing timestamp
 *   - url: directly to the video file (mp4, webm, m3u8)
 *   - m: MIME type of the video
 *   - image: thumbnail / cover image
 *   - duration: video duration in seconds
 *   - size: file size in bytes
 *   - dim: video dimensions as WxH (e.g. "1080x1920")
 *   - t: content tags (hashtags)
 *   - p: participant pubkeys
 *   - i: identifier for external content IDs
 *   - imeta: media metadata (url, m, x, dim, alt)
 *
 * Reference: https://github.com/nostr-protocol/nips/blob/master/71.md
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface NostrVideoEvent {
  /** Unique event ID */
  id: string;
  /** Event kind (34235 = video, 34236 = short video) */
  kind: number;
  /** Event pubkey (creator) */
  pubkey: string;
  /** Title of the video */
  title: string;
  /** URL to the video content */
  url?: string;
  /** Direct video URL (mp4/webm) */
  videoUrl?: string;
  /** HLS stream URL (m3u8) */
  hlsUrl?: string;
  /** Streaming platform URL */
  platformUrl?: string;
  /** MIME type */
  mimeType?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Duration in seconds */
  duration?: number;
  /** Video size in bytes */
  size?: number;
  /** Content warning / NSFW label */
  contentWarning?: string;
  /** Published at timestamp (ms) */
  publishedAt: number;
  /** Summary / description */
  summary?: string;
  /** Whether this is a short-form video */
  isShort: boolean;
  /** Tags / hashtags */
  tags: string[];
  /** Participant pubkeys */
  participants: string[];
  /** External content IDs (i tags) */
  externalIds: string[];
  /** Raw event */
  rawEvent?: Record<string, unknown>;
}

export interface NostrVideoFilter {
  /** Filter by pubkey */
  authors?: string[];
  /** Filter by search term */
  search?: string;
  /** Only short videos (< 120s) */
  shortsOnly?: boolean;
  /** Max results */
  limit?: number;
  /** Only events since this timestamp */
  since?: number;
}

// ─── Constants ──────────────────────────────────────────────────────────

export const VIDEO_EVENT_KIND = 34235;
/** NIP-71 short-form video event (TikTok-style, kind 34236) */
export const SHORT_VIDEO_EVENT_KIND = 34236;
/** All NIP-71 video event kinds (34235 = video, 34236 = short video) */
export const VIDEO_EVENT_KINDS = [VIDEO_EVENT_KIND, SHORT_VIDEO_EVENT_KIND] as const;

/** MIME types considered as "short-form vertical video" */
const SHORT_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const SHORT_DURATION_MAX = 120; // seconds

// ─── Helpers ───────────────────────────────────────────────────────────

/** Check if a duration string is valid and under the shorts threshold */
function isShortDuration(duration?: number): boolean {
  if (!duration) return false;
  return duration > 0 && duration <= SHORT_DURATION_MAX;
}

// ─── Event Parsing ─────────────────────────────────────────────────────

/** Parse a kind:34235 event into a NostrVideoEvent */
export function parseVideoEvent(event: {
  id?: string;
  pubkey: string;
  kind: number;
  tags: string[][];
  content: string;
  created_at: number;
  sig?: string;
}): NostrVideoEvent | null {
  if (!VIDEO_EVENT_KINDS.includes(event.kind as (typeof VIDEO_EVENT_KINDS)[number])) return null;

  const tags = event.tags ?? [];
  const tagMap = new Map<string, string[]>();

  for (const tag of tags) {
    const key = tag[0];
    if (!key) continue;
    if (!tagMap.has(key)) tagMap.set(key, []);
    tagMap.get(key)?.push(tag[1] ?? '');
  }

  const id = event.id ?? `nostr-video-${event.created_at}`;
  const title = tagMap.get('title')?.[0] ?? 'Untitled Video';
  const publishedAtStr = tagMap.get('published_at')?.[0];
  const publishedAt = publishedAtStr
    ? parseInt(publishedAtStr, 10) * 1000
    : event.created_at * 1000;

  // Find video URLs from different tag types
  let url: string | undefined;
  let videoUrl: string | undefined;
  let hlsUrl: string | undefined;
  let platformUrl: string | undefined;
  let mimeType: string | undefined;
  let thumbnailUrl: string | undefined;
  let duration: number | undefined;
  let size: number | undefined;
  let contentWarning: string | undefined;

  for (const tag of tags) {
    const [key, val, ..._rest] = tag;
    if (!key || !val) continue;

    switch (key) {
      case 'url':
        url = val;
        break;
      case 'm':
        mimeType = val;
        break;
      case 'image':
        thumbnailUrl = val;
        break;
      case 'duration':
        duration = parseInt(val, 10);
        break;
      case 'size':
        size = parseInt(val, 10);
        break;
      case 'content-warning':
      case 'cw':
        contentWarning = val;
        break;
    }
  }

  // Categorize URLs
  if (url) {
    if (url.endsWith('.m3u8')) {
      hlsUrl = url;
    } else if (/\.(mp4|webm|mov|mkv|avi)$/i.test(url)) {
      videoUrl = url;
    } else if (/^(https?:\/\/)/.test(url)) {
      platformUrl = url;
    }
  }

  const summary = event.content && event.content !== title ? event.content : undefined;

  // Determine if short-form: kind 34236 is short-form by definition; kind
  // 34235 is short when the duration is under the threshold or MIME matches.
  const isShort = !!(
    event.kind === SHORT_VIDEO_EVENT_KIND ||
    isShortDuration(duration) ||
    (mimeType &&
      SHORT_MIME_TYPES.includes(mimeType) &&
      (!duration || duration <= SHORT_DURATION_MAX))
  );

  // Extract tags (t tags + hashtags from content)
  const hashtagTags = tagMap.get('t') ?? [];
  const contentTags = (summary ?? title).match(/#\w+/g) ?? [];
  const allTags = [...new Set([...hashtagTags, ...contentTags.map((t) => t.slice(1))])];

  return {
    id,
    kind: event.kind,
    pubkey: event.pubkey,
    title,
    url,
    videoUrl,
    hlsUrl,
    platformUrl,
    mimeType,
    thumbnailUrl,
    duration,
    size,
    contentWarning,
    publishedAt,
    summary,
    isShort,
    tags: allTags,
    participants: tagMap.get('p') ?? [],
    externalIds: tagMap.get('i') ?? [],
    rawEvent: event as unknown as Record<string, unknown>,
  };
}

/** Serialize a video event to Nostr-compatible tags */
export function serializeVideoEvent(opts: {
  id: string;
  title: string;
  url: string;
  mimeType?: string;
  thumbnailUrl?: string;
  duration?: number;
  size?: number;
  summary?: string;
  publishedAt?: number;
  isShort?: boolean;
  kind?: number;
  tags?: string[];
  contentWarning?: string;
  /** Video dimensions as `WxH` (e.g. "1080x1920") */
  dimensions?: string;
  /** SHA-256 content hash of the video file (x tag / imeta x) */
  contentHash?: string;
  /** Alt text for the media (imeta alt) */
  alt?: string;
}): { kind: number; tags: string[][]; content: string } {
  const tags: string[][] = [
    ['d', opts.id],
    ['title', opts.title.slice(0, 256)],
    ['url', opts.url],
    ['published_at', String(Math.floor((opts.publishedAt ?? Date.now()) / 1000))],
  ];

  if (opts.mimeType) tags.push(['m', opts.mimeType]);
  if (opts.thumbnailUrl) tags.push(['image', opts.thumbnailUrl]);
  if (opts.duration) tags.push(['duration', String(opts.duration)]);
  if (opts.size) tags.push(['size', String(opts.size)]);
  if (opts.dimensions) tags.push(['dim', opts.dimensions]);
  if (opts.contentWarning) tags.push(['content-warning', opts.contentWarning]);

  // Media metadata (NIP-92 imeta) for clients that render inline
  const imetaParts: string[] = [`url ${opts.url}`];
  if (opts.mimeType) imetaParts.push(`m ${opts.mimeType}`);
  if (opts.contentHash) imetaParts.push(`x ${opts.contentHash}`);
  if (opts.dimensions) imetaParts.push(`dim ${opts.dimensions}`);
  if (opts.alt) imetaParts.push(`alt ${opts.alt.slice(0, 200)}`);
  tags.push(['imeta', ...imetaParts]);

  if (opts.tags) {
    for (const t of opts.tags) tags.push(['t', t]);
  }

  // Mark as short-form in tags for discoverability
  if (opts.isShort) {
    tags.push(['t', 'shorts']);
    tags.push(['t', 'short']);
  }

  return {
    kind: opts.kind ?? (opts.isShort ? SHORT_VIDEO_EVENT_KIND : VIDEO_EVENT_KIND),
    tags,
    content: opts.summary ?? '',
  };
}

// ─── Filtering ─────────────────────────────────────────────────────────

/** Filter video events by criteria */
export function filterVideoEvents(
  events: NostrVideoEvent[],
  filter: NostrVideoFilter = {},
): NostrVideoEvent[] {
  let result = [...events];

  if (filter.authors?.length) {
    result = result.filter((e) => filter.authors?.includes(e.pubkey));
  }
  if (filter.search) {
    const lower = filter.search.toLowerCase();
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        e.summary?.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }
  if (filter.shortsOnly) {
    result = result.filter((e) => e.isShort);
  }
  if (filter.since) {
    result = result.filter((e) => e.publishedAt >= filter.since!);
  }

  // Sort by publishedAt descending
  result.sort((a, b) => b.publishedAt - a.publishedAt);

  if (filter.limit && result.length > filter.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}

// ─── Normalization ─────────────────────────────────────────────────────

/** Normalize a video event for unified feed display */
export function normalizeVideoEvent(event: NostrVideoEvent): {
  id: string;
  type: 'short' | 'video' | 'clip';
  title: string;
  description: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration: number;
  source: string;
  creatorId: string;
  creatorName: string;
  platform: string;
  publishedAt: number;
  tags: string[];
  isShort: boolean;
} {
  return {
    id: `nostr:${event.id}`,
    type: event.isShort ? 'short' : 'video',
    title: event.title,
    description: event.summary ?? '',
    videoUrl: event.videoUrl ?? event.hlsUrl ?? event.platformUrl,
    thumbnailUrl: event.thumbnailUrl,
    duration: event.duration ?? 0,
    source: 'nostr',
    creatorId: `nostr:${event.pubkey}`,
    creatorName: event.pubkey.slice(0, 12),
    platform: 'Nostr',
    publishedAt: event.publishedAt,
    tags: event.tags,
    isShort: event.isShort,
  };
}

/** Fetch video events from Nostr relays */
export async function fetchNostrVideoEvents(
  relays: string[],
  filter: NostrVideoFilter = {},
  timeoutMs = 8000,
): Promise<NostrVideoEvent[]> {
  try {
    const { RelayPool } = await import('./relay');
    const pool = new RelayPool(relays, {
      connectTimeout: timeoutMs / 2,
      eoseTimeout: timeoutMs / 2,
    });

    const events: NostrVideoEvent[] = [];
    const subFilter: Record<string, unknown> = {
      kinds: filter.shortsOnly ? [SHORT_VIDEO_EVENT_KIND] : [...VIDEO_EVENT_KINDS],
      limit: filter.limit ?? 50,
    };
    if (filter.authors?.length) subFilter.authors = filter.authors;
    if (filter.since) subFilter.since = Math.floor(filter.since / 1000);

    return new Promise<NostrVideoEvent[]>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(filterVideoEvents(events, filter));
      }, timeoutMs);

      pool.subscribe([{ ...subFilter }], {
        onEvent: (event) => {
          const parsed = parseVideoEvent(event);
          if (parsed) events.push(parsed);
        },
        onEose: () => {
          clearTimeout(timeout);
          resolve(filterVideoEvents(events, filter));
        },
      });
    });
  } catch {
    return [];
  }
}

// ─── Publishing ─────────────────────────────────────────────────────────

import type { NostrEvent } from './event';
import { getPublicKey, signEvent } from './event';

/**
 * Create a signed NIP-71 video event (kind 34235 video / 34236 short).
 *
 * Combines `serializeVideoEvent` with `signEvent` so publishers can push
 * a ready-to-publish event straight to relays. The event includes title,
 * description (content), thumbnail, video URL, duration, dimensions and
 * content hash.
 */
export function createVideoEvent(
  opts: {
    id: string;
    title: string;
    url: string;
    mimeType?: string;
    thumbnailUrl?: string;
    duration?: number;
    size?: number;
    summary?: string;
    publishedAt?: number;
    isShort?: boolean;
    kind?: number;
    tags?: string[];
    contentWarning?: string;
    /** Video dimensions as `WxH` (e.g. "1080x1920") */
    dimensions?: string;
    /** SHA-256 content hash of the video file */
    contentHash?: string;
    alt?: string;
  },
  secretKey: string,
): NostrEvent {
  const { kind, tags, content } = serializeVideoEvent(opts);
  return createSignedEvent({ kind, tags, content }, secretKey);
}

/**
 * Sign an already-serialized event shape (kind/tags/content) with a secret key.
 */
function createSignedEvent(
  serialized: { kind: number; tags: string[][]; content: string },
  secretKey: string,
): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  return signEvent(
    {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: serialized.kind,
      tags: serialized.tags,
      content: serialized.content,
    },
    secretKey,
  );
}

/**
 * Publish a NIP-71 video event to the given relays.
 *
 * Returns per-relay publish results. A relay is considered successful when
 * it sends an OK frame for the event id; relays that time out or reject are
 * reported individually (fail-open — one good relay is enough).
 */
export async function publishVideoEvent(
  event: NostrEvent,
  relays: string[],
  timeoutMs = 10_000,
): Promise<{
  eventId: string;
  successful: string[];
  failed: string[];
  results: Array<{ relay: string; ok: boolean; message?: string }>;
}> {
  const { RelayPool } = await import('./relay');
  const pool = new RelayPool(relays, {
    connectTimeout: timeoutMs / 2,
    eoseTimeout: timeoutMs / 2,
    maxReconnects: 0,
  });

  return new Promise((resolve) => {
    const results: Array<{ relay: string; ok: boolean; message?: string }> = [];
    const successful: string[] = [];
    const failed: string[] = [];

    const timer = setTimeout(() => {
      pool.disconnectAll();
      resolve({ eventId: event.id, successful, failed, results });
    }, timeoutMs);

    // Wait a beat for connections to establish, then publish.
    setTimeout(() => {
      pool.publish(event, {
        onOk: (relayUrl, eventId, success, message) => {
          if (eventId !== event.id) return;
          results.push({ relay: relayUrl, ok: success, message });
          if (success && !successful.includes(relayUrl)) successful.push(relayUrl);
          else if (!success && !failed.includes(relayUrl)) failed.push(relayUrl);
        },
        onError: (relayUrl, message) => {
          results.push({ relay: relayUrl, ok: false, message });
          if (!failed.includes(relayUrl)) failed.push(relayUrl);
        },
      });

      // Allow OK frames to arrive; fail-open on timeout.
      setTimeout(() => {
        clearTimeout(timer);
        pool.disconnectAll();
        resolve({ eventId: event.id, successful, failed, results });
      }, timeoutMs - 200);
    }, 500);
  });
}
