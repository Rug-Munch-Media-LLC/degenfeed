/**
 * @degenfeed/nostr-sdk — NIP-71: Video Events
 *
 * NIP-71 defines video content via kind:34235 (Video Event).
 * These events represent video posts similar to how kind:1 represents text.
 *
 * Video events have:
 *   - d tag: unique identifier
 *   - title: video title
 *   - published_at: publishing timestamp
 *   - url: directly to the video file (mp4, webm, m3u8)
 *   - m: MIME type of the video
 *   - image: thumbnail / cover image
 *   - duration: video duration in seconds
 *   - t: content tags (hashtags)
 *   - p: participant pubkeys
 *   - i: identifier for external content IDs
 *
 * Reference: https://github.com/nostr-protocol/nips/blob/master/71.md
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface NostrVideoEvent {
  /** Unique event ID */
  id: string;
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
  if (event.kind !== VIDEO_EVENT_KIND) return null;

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

  // Determine if short-form
  const isShort =
    isShortDuration(duration) ||
    (mimeType &&
      SHORT_MIME_TYPES.includes(mimeType) &&
      (!duration || duration <= SHORT_DURATION_MAX));

  // Extract tags (t tags + hashtags from content)
  const hashtagTags = tagMap.get('t') ?? [];
  const contentTags = (summary ?? title).match(/#\w+/g) ?? [];
  const allTags = [...new Set([...hashtagTags, ...contentTags.map((t) => t.slice(1))])];

  return {
    id,
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
  tags?: string[];
  contentWarning?: string;
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
  if (opts.contentWarning) tags.push(['content-warning', opts.contentWarning]);

  if (opts.tags) {
    for (const t of opts.tags) tags.push(['t', t]);
  }

  // Mark as short-form in tags for discoverability
  if (opts.isShort) {
    tags.push(['t', 'shorts']);
    tags.push(['t', 'short']);
  }

  return {
    kind: VIDEO_EVENT_KIND,
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
      kinds: [VIDEO_EVENT_KIND],
      limit: filter.limit ?? 50,
    };
    if (filter.authors?.length) subFilter.authors = filter.authors;
    if (filter.since) subFilter.since = Math.floor(filter.since / 1000);

    return new Promise<NostrVideoEvent[]>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(filterVideoEvents(events, filter));
      }, timeoutMs);

      pool.subscribe([{ ...subFilter }], (relayEvent) => {
        if (relayEvent.kind === 'event' && relayEvent.event) {
          const parsed = parseVideoEvent(relayEvent.event);
          if (parsed) events.push(parsed);
        }
        if (relayEvent.kind === 'eose') {
          clearTimeout(timeout);
          resolve(filterVideoEvents(events, filter));
        }
      });
    });
  } catch {
    return [];
  }
}
