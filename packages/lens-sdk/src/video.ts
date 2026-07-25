/**
 * @degenfeed/lens-sdk — Video & Live Publication Support
 *
 * Lens Protocol supports video content through publications with media
 * attachments. Video posts on Lens can be either:
 *   1. Publications with video media attached (image/video MIME types)
 *   2. Mirrors of video NFTs from Zora or other platforms
 *   3. Publications linking to external video platforms
 *
 * This module provides:
 *   - Video publication detection from Lens publications
 *   - Short-form video detection
 *   - Live stream announcement detection
 *   - Creating video publications (with proper metadata)
 *   - Cross-posting video content to Lens
 */

// ─── Types ───────────────────────────────────────────────────────────────

export interface LensVideoPublication {
  /** Publication ID */
  id: string;
  /** Profile ID of creator */
  profileId: string;
  /** Creator handle */
  handle?: string;
  /** Publication title (from metadata) */
  title: string;
  /** Publication content / description */
  content: string;
  /** Video URL (from media attachments) */
  videoUrl?: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Duration in seconds (from metadata) */
  duration?: number;
  /** Whether it's a short-form video */
  isShort: boolean;
  /** Whether it's a live stream announcement */
  isLive: boolean;
  /** External platform URL (if linking to YouTube/PeerTube/etc) */
  platformUrl?: string;
  /** Platform name */
  platform?: string;
  /** Tags/hashtags */
  tags: string[];
  /** Engagement metrics */
  likes: number;
  comments: number;
  mirrors: number;
  quotes: number;
  /** When published */
  publishedAt: number;
  /** Publication type: 'post' | 'mirror' | 'comment' | 'quote' */
  pubType: 'post' | 'mirror' | 'comment' | 'quote';
}

export interface LensVideoFilter {
  /** Creator profile IDs */
  profileIds?: string[];
  /** Search query */
  search?: string;
  /** Only short videos */
  shortsOnly?: boolean;
  /** Only live streams */
  liveOnly?: boolean;
  /** Max results */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────

/** Video platforms that Lens publications may link to */
const VIDEO_PLATFORMS = [
  { pattern: /youtube\.com|youtu\.be/, name: 'YouTube' },
  { pattern: /tiktok\.com/, name: 'TikTok' },
  { pattern: /twitch\.tv/, name: 'Twitch' },
  { pattern: /kick\.com/, name: 'Kick' },
  { pattern: /peertube/i, name: 'PeerTube' },
  { pattern: /vimeo\.com/, name: 'Vimeo' },
  { pattern: /livepeerr\.io/, name: 'Livepeer' },
  { pattern: /odysee\.com/, name: 'Odysee' },
  { pattern: /rumble\.com/, name: 'Rumble' },
  { pattern: /dailymotion\.com/, name: 'Dailymotion' },
];

/** Video MIME types for publication media detection */
const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
];

/** Keywords indicating live content in publication text */
const LIVE_KEYWORDS = ['🔴', 'live', 'streaming', 'stream', 'going live', 'live now'];

// ─── Video Detection ───────────────────────────────────────────────────

/** Detect if a Lens publication contains video content */
export function detectVideoPublication(publication: {
  id: string;
  profileId: string;
  metadata?: {
    content?: string;
    title?: string;
    media?: Array<{
      original?: { url?: string; mimeType?: string };
      optimized?: { url?: string };
    }>;
    tags?: string[];
    attributes?: Array<{ key: string; value: string }>;
    coverPicture?: string;
  };
  stats?: { reactions?: number; comments?: number; mirrors?: number; quotes?: number };
  createdAt?: string;
  __typename?: string;
  profile?: { handle?: { localName?: string } };
  mirrorOf?: unknown;
}): LensVideoPublication | null {
  const metadata = publication.metadata;
  if (!metadata) return null;

  const content = metadata.content ?? '';
  const title = metadata.title ?? content.split('\n')[0] ?? 'Untitled';
  const mediaItems = metadata.media ?? [];
  const tags = metadata.tags ?? [];
  const attributes = metadata.attributes ?? [];
  const attributeMap = new Map(attributes.map((a) => [a.key, a.value]));
  const lowerContent = content.toLowerCase();

  // Check for video media attachments
  let videoUrl: string | undefined;
  let thumbnailUrl: string | undefined;
  let _mimeType: string | undefined;

  for (const media of mediaItems) {
    const mt = media.original?.mimeType ?? '';
    if (VIDEO_MIME_TYPES.some((vmt) => mt.startsWith(vmt))) {
      videoUrl = media.original?.url;
      _mimeType = mt;
      thumbnailUrl = media.optimized?.url ?? metadata.coverPicture;
      break;
    }
  }

  // Check for animatedContent duration attribute
  const durationStr = attributeMap.get('duration') ?? attributeMap.get('animationDuration');
  const duration = durationStr ? parseInt(durationStr, 10) : undefined;

  // Check for links to video platforms in content
  let platformUrl: string | undefined;
  let platform: string | undefined;
  if (!videoUrl) {
    for (const vp of VIDEO_PLATFORMS) {
      const match = lowerContent.match(vp.pattern);
      if (match) {
        // Extract the actual URL
        const urlMatch = content.match(
          new RegExp(`https?://[^\\s]*${vp.pattern.source.replace(/\\/g, '\\\\')}[^\\s]*`, 'i'),
        );
        if (urlMatch) {
          platformUrl = urlMatch[0];
          platform = vp.name;
          break;
        }
      }
    }
  }

  if (!videoUrl && !platformUrl) return null;

  const isShort =
    (duration !== undefined && duration > 0 && duration <= 120) ||
    attributeMap.get('type') === 'short' ||
    lowerContent.includes('#shorts');

  const isLive =
    LIVE_KEYWORDS.some((kw) => lowerContent.includes(kw)) &&
    (videoUrl?.includes('m3u8') || platformUrl !== undefined || lowerContent.includes('live now'));

  const publishedAt = publication.createdAt
    ? new Date(publication.createdAt).getTime()
    : Date.now();

  const stats = publication.stats;
  const pubType = (publication.__typename?.toLowerCase() ??
    'post') as LensVideoPublication['pubType'];

  return {
    id: publication.id,
    profileId: publication.profileId,
    handle: publication.profile?.handle?.localName,
    title,
    content: content.slice(0, 500),
    videoUrl,
    thumbnailUrl,
    duration,
    isShort,
    isLive,
    platformUrl,
    platform,
    tags: tags.filter(Boolean),
    likes: stats?.reactions ?? 0,
    comments: stats?.comments ?? 0,
    mirrors: stats?.mirrors ?? 0,
    quotes: stats?.quotes ?? 0,
    publishedAt,
    pubType,
  };
}

// ─── Normalization ─────────────────────────────────────────────────────

/** Normalize a Lens video publication for unified feed display */
export function normalizeLensVideo(video: LensVideoPublication): {
  id: string;
  type: 'short' | 'video' | 'live';
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
  metrics: { likes: number; comments: number; mirrors: number };
} {
  let type: 'short' | 'video' | 'live' = 'video';
  if (video.isLive) type = 'live';
  else if (video.isShort) type = 'short';

  return {
    id: `lens:${video.id}`,
    type,
    title: video.title,
    description: video.content,
    videoUrl: video.videoUrl ?? video.platformUrl,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration ?? 0,
    source: video.platform?.toLowerCase().replace(/\s+/g, '_') ?? 'lens',
    creatorId: `lens:${video.profileId}`,
    creatorName: video.handle ?? `profile:${video.profileId.slice(0, 8)}`,
    platform: video.platform ?? 'Lens',
    publishedAt: video.publishedAt,
    tags: video.tags,
    metrics: {
      likes: video.likes,
      comments: video.comments,
      mirrors: video.mirrors,
    },
  };
}

// ─── Video Post Creation ───────────────────────────────────────────────

/** Build a Lens publication GraphQL mutation for a video post */
export function buildVideoPublicationRequest(opts: {
  title: string;
  content: string;
  videoUrl: string;
  mimeType?: string;
  thumbnailUrl?: string;
  duration?: number;
  isShort?: boolean;
  tags?: string[];
  profileId: string;
}): { query: string; variables: Record<string, unknown> } {
  const media = [
    {
      original: {
        url: opts.videoUrl,
        mimeType: opts.mimeType ?? 'video/mp4',
      },
      ...(opts.thumbnailUrl ? { optimized: { url: opts.thumbnailUrl } } : {}),
    },
  ];

  const attributes: Array<{ key: string; value: string }> = [];
  if (opts.duration) attributes.push({ key: 'duration', value: String(opts.duration) });
  if (opts.isShort) attributes.push({ key: 'type', value: 'short' });

  const tags = [...(opts.tags ?? [])];
  if (opts.isShort && !tags.includes('shorts')) tags.push('shorts');

  return {
    query: `
      mutation CreatePost($request: CreatePostRequest!) {
        createPost(request: $request) { ... on CreatePostResponse { hash } }
      }
    `,
    variables: {
      request: {
        profileId: opts.profileId,
        content: opts.content.slice(0, 5000),
        media,
        tags,
        attributes,
        ...(opts.thumbnailUrl ? { coverPicture: opts.thumbnailUrl } : {}),
      },
    },
  };
}

/** Build a Lens publication for announcing a live stream */
export function buildLiveAnnouncementPublication(opts: {
  title: string;
  streamUrl: string;
  platform: string;
  description?: string;
  tags?: string[];
  profileId: string;
}): { query: string; variables: Record<string, unknown> } {
  const content = [
    `🔴 LIVE: ${opts.title}`,
    opts.description ?? '',
    '',
    `📺 Streaming on ${opts.platform}`,
    opts.streamUrl,
    ...(opts.tags ?? []).map((t) => `#${t}`),
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 5000);

  return {
    query: `
      mutation CreatePost($request: CreatePostRequest!) {
        createPost(request: $request) { ... on CreatePostResponse { hash } }
      }
    `,
    variables: {
      request: {
        profileId: opts.profileId,
        content,
        tags: opts.tags ?? [],
        attributes: [
          { key: 'type', value: 'live' },
          { key: 'streamUrl', value: opts.streamUrl },
          { key: 'platform', value: opts.platform },
        ],
      },
    },
  };
}
