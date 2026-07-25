/**
 * @degenfeed/cross-protocol-bridge — Cross-Posting Adapter Types
 *
 * MasterPost and per-platform publish param types for the
 * one-click multi-protocol publishing engine.
 */

// ─── Media ────────────────────────────────────────────────────────────────

export interface MediaAttachment {
  /** URL or data URI of the media */
  url: string;
  /** MIME type hint (e.g. image/jpeg, video/mp4) */
  mimeType?: string;
  /** Alt text for accessibility */
  alt?: string;
  /** Preferred width in px (for resize hints) */
  width?: number;
  /** Preferred height in px (for resize hints) */
  height?: number;
}

export interface LinkCard {
  /** URL the card points to */
  url: string;
  /** Title extracted from OG metadata */
  title?: string;
  /** Description from OG metadata */
  description?: string;
  /** Thumbnail image URL */
  imageUrl?: string;
}

// ─── Master Post ──────────────────────────────────────────────────────────

/**
 * A single "master post" that gets adapted to each protocol's format.
 * All adapters consume this interface.
 */
export interface MasterPost {
  /** Primary text content */
  text: string;
  /** Optional title (used by Reddit, PeerTube, long-form protocols) */
  title?: string;
  /** Media attachments (images, videos) */
  media?: MediaAttachment[];
  /** Hashtags/topics (without the # prefix) */
  hashtags?: string[];
  /** @mentions (plain handles, protocol-specific resolution happens in adapter) */
  mentions?: string[];
  /** Link card / embed preview */
  linkCard?: LinkCard;
  /** Content warning / NSFW label */
  contentWarning?: string;
  /** Whether this is sensitive/NSFW content */
  isSensitive?: boolean;
  /** ISO language code */
  lang?: string;
}

// ─── Publish Params (output of each adapter) ──────────────────────────────

/**
 * Generic publish params that each protocol adapter returns.
 * The orchestrator uses this to actually send the post.
 */
export interface ProtocolPublishParams {
  /** Protocol identifier */
  protocol: string;
  /** Formatted text content (truncated if needed, adapted for platform) */
  text: string;
  /** Optional title (for long-form protocols) */
  title?: string;
  /** Media URLs to attach (uploaded/downloaded by the caller) */
  mediaUrls?: string[];
  /** Media alt texts, parallel to mediaUrls */
  mediaAlts?: string[];
  /** Hashtags formatted per-protocol (e.g. ["#nostr", "#bitcoin"]) */
  formattedHashtags?: string[];
  /** @mentions formatted per-protocol */
  formattedMentions?: string[];
  /** Protocol-specific extra parameters */
  extra?: Record<string, unknown>;
  /** Whether this platform supports HTML/Markdown formatting */
  supportsRichText?: boolean;
  /** Formatted rich text (HTML or Markdown) if supported */
  richText?: string;
}

// ─── Adapter Definition ───────────────────────────────────────────────────

export interface PlatformAdapter {
  /** Protocol identifier (e.g. 'nostr', 'farcaster') */
  protocol: string;
  /** Human-readable name */
  name: string;
  /** Character limit (0 = unlimited) */
  charLimit: number;
  /** Max media attachments (0 = unsupported) */
  maxMedia: number;
  /** Supported media MIME types (empty = any) */
  supportedMediaTypes: string[];
  /** Whether this platform supports rich text / HTML */
  supportsRichText: boolean;
  /** Whether this platform supports scheduling */
  supportsScheduling: boolean;
  /** Whether this platform supports content warnings */
  supportsCW: boolean;

  /**
   * Convert a MasterPost into protocol-specific publish params.
   * Handles truncation, media formatting, hashtag adaptation.
   */
  adapt(master: MasterPost): ProtocolPublishParams;

  /**
   * Optional: return a preview string showing how the post would look.
   */
  preview(master: MasterPost): string;
}

// ─── Platform Definition Registry ─────────────────────────────────────────

export interface PlatformDefinition {
  id: string;
  label: string;
  icon: string;
  color: string;
  charLimit: number;
  maxMedia: number;
  supportsVideo: boolean;
  supportsRichText: boolean;
  supportsScheduling: boolean;
  supportsCW: boolean;
  description: string;
}

export const ALL_PLATFORMS: PlatformDefinition[] = [
  {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    charLimit: 50000,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: false,
    supportsScheduling: false,
    supportsCW: false,
    description: 'Kind 1 notes, NIP-23 long-form',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    charLimit: 320,
    maxMedia: 4,
    supportsVideo: false,
    supportsRichText: false,
    supportsScheduling: false,
    supportsCW: false,
    description: '320-char casts with embeds',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '🦋',
    color: '#1185fe',
    charLimit: 300,
    maxMedia: 4,
    supportsVideo: false,
    supportsRichText: false,
    supportsScheduling: false,
    supportsCW: true,
    description: '300-char skeets with alt text',
  },
  {
    id: 'mastodon',
    label: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    charLimit: 500,
    maxMedia: 4,
    supportsVideo: true,
    supportsRichText: false,
    supportsScheduling: true,
    supportsCW: true,
    description: '500-char toots, CW support',
  },
  {
    id: 'lens',
    label: 'Lens',
    icon: '🌿',
    color: '#abfe2c',
    charLimit: 5000,
    maxMedia: 4,
    supportsVideo: true,
    supportsRichText: false,
    supportsScheduling: false,
    supportsCW: false,
    description: 'Collectible publications',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    icon: '🤖',
    color: '#ff4500',
    charLimit: 40000,
    maxMedia: 20,
    supportsVideo: true,
    supportsRichText: true,
    supportsScheduling: false,
    supportsCW: true,
    description: 'Subreddit submissions',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈️',
    color: '#0088cc',
    charLimit: 4096,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: true,
    supportsScheduling: true,
    supportsCW: false,
    description: 'Channel posts with HTML',
  },
  {
    id: 'discord',
    label: 'Discord',
    icon: '💬',
    color: '#5865f2',
    charLimit: 2000,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: true,
    supportsScheduling: false,
    supportsCW: false,
    description: 'Webhook embeds',
  },
  {
    id: 'threads',
    label: 'Threads',
    icon: '⊞',
    color: '#101010',
    charLimit: 500,
    maxMedia: 10,
    supportsVideo: true,
    supportsRichText: false,
    supportsScheduling: false,
    supportsCW: false,
    description: 'Via Bridgy Fed / Meta API',
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    icon: '🔮',
    color: '#4a8c6f',
    charLimit: 50000,
    maxMedia: 1,
    supportsVideo: false,
    supportsRichText: true,
    supportsScheduling: false,
    supportsCW: true,
    description: 'Link/text posts to communities',
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    icon: '▶️',
    color: '#f2691d',
    charLimit: 5000,
    maxMedia: 1,
    supportsVideo: true,
    supportsRichText: true,
    supportsScheduling: true,
    supportsCW: true,
    description: 'Video upload with description',
  },
  {
    id: 'pixelfed',
    label: 'Pixelfed',
    icon: '📷',
    color: '#f2691d',
    charLimit: 5000,
    maxMedia: 20,
    supportsVideo: true,
    supportsRichText: false,
    supportsScheduling: false,
    supportsCW: true,
    description: 'Image gallery posts',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Truncate text to fit within a character limit, appending a "read more" link.
 */
export function truncateText(text: string, limit: number, readMoreUrl?: string): string {
  if (limit <= 0 || text.length <= limit) return text;

  const suffix = readMoreUrl ? `... ${readMoreUrl}` : '...';
  const available = limit - suffix.length;
  if (available <= 0) return text.slice(0, Math.max(limit, 10));

  return text.slice(0, available).trimEnd() + suffix;
}

/**
 * Format hashtags for a given protocol (e.g. with or without # prefix).
 */
export function formatHashtags(
  hashtags: string[],
  style: 'hash' | 'bare' | 'camel' = 'hash',
): string[] {
  if (!hashtags || hashtags.length === 0) return [];

  switch (style) {
    case 'bare':
      return hashtags.map((h) => h.replace(/^#/, ''));
    case 'camel':
      return hashtags.map((h) => {
        const clean = h.replace(/^#/, '');
        return clean.charAt(0).toUpperCase() + clean.slice(1);
      });
    case 'hash':
    default:
      return hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`));
  }
}

/**
 * Build a "read more" link suffix for truncated content.
 */
export function buildReadMoreSuffix(url: string): string {
  return `\n\n🔗 Read more: ${url}`;
}
