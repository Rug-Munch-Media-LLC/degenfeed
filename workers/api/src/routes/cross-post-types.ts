/**
 * @degenfeed/api-worker — Cross-Post Types & Platform Limits
 *
 * Shared types and content adaptation constants for centralized platform
 * cross-posting (Medium, Substack, YouTube, TikTok, Instagram, LinkedIn,
 * Reddit, Pinterest).
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface CrossPostInput {
  /** Main text content */
  text: string;
  /** Optional title (for long-form platforms) */
  title?: string;
  /** Optional image URLs */
  images?: string[];
  /** Optional video URL (for YouTube/TikTok) */
  videoUrl?: string;
  /** Optional video binary (base64-encoded, for YouTube/TikTok) */
  videoBase64?: string;
  /** Optional video file name */
  videoFileName?: string;
  /** Optional video MIME type */
  videoMimeType?: string;
  /** Optional tags/hashtags */
  tags?: string[];
  /** Optional visibility setting */
  visibility?: 'public' | 'unlisted' | 'private';
}

export interface CrossPostResult {
  ok: boolean;
  platform: string;
  nativeId?: string;
  nativeUrl?: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM-SPECIFIC CONTENT ADAPTATION CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const PLATFORM_LIMITS: Record<
  string,
  {
    maxChars: number;
    maxImages: number;
    supportsVideo: boolean;
    supportsMarkdown: boolean;
    isLongForm: boolean;
    isVideo: boolean;
    isShortVideo: boolean;
    isNewsletter: boolean;
  }
> = {
  medium: {
    maxChars: 999999,
    maxImages: 100,
    supportsVideo: false,
    supportsMarkdown: true,
    isLongForm: true,
    isVideo: false,
    isShortVideo: false,
    isNewsletter: false,
  },
  substack: {
    maxChars: 999999,
    maxImages: 100,
    supportsVideo: false,
    supportsMarkdown: false,
    isLongForm: false,
    isVideo: false,
    isShortVideo: false,
    isNewsletter: true,
  },
  youtube: {
    maxChars: 5000,
    maxImages: 0,
    supportsVideo: false,
    supportsMarkdown: false,
    isLongForm: false,
    isVideo: true,
    isShortVideo: false,
    isNewsletter: false,
  },
  tiktok: {
    maxChars: 2200,
    maxImages: 0,
    supportsVideo: false,
    supportsMarkdown: false,
    isLongForm: false,
    isVideo: false,
    isShortVideo: true,
    isNewsletter: false,
  },
  instagram: {
    maxChars: 2200,
    maxImages: 10,
    supportsVideo: true,
    supportsMarkdown: false,
    isLongForm: false,
    isVideo: false,
    isShortVideo: false,
    isNewsletter: false,
  },
  linkedin: {
    maxChars: 3000,
    maxImages: 9,
    supportsVideo: true,
    supportsMarkdown: true,
    isLongForm: false,
    isVideo: false,
    isShortVideo: false,
    isNewsletter: false,
  },
  reddit: {
    maxChars: 40000,
    maxImages: 20,
    supportsVideo: true,
    supportsMarkdown: true,
    isLongForm: false,
    isVideo: false,
    isShortVideo: false,
    isNewsletter: false,
  },
  pinterest: {
    maxChars: 500,
    maxImages: 1,
    supportsVideo: false,
    supportsMarkdown: false,
    isLongForm: false,
    isVideo: false,
    isShortVideo: false,
    isNewsletter: false,
  },
};

/**
 * Adapt content for a specific platform's limits.
 * Truncates text, limits images, and adjusts formatting.
 */
export function adaptContentForPlatform(
  text: string,
  platform: string,
  images?: string[],
): { text: string; images: string[] } {
  const limits = PLATFORM_LIMITS[platform];
  if (!limits) return { text, images: images || [] };

  let adapted = text;

  // Truncate to max chars
  if (adapted.length > limits.maxChars) {
    adapted = `${adapted.slice(0, limits.maxChars - 1)}…`;
  }

  // Limit images
  const adaptedImages = (images || []).slice(0, limits.maxImages);

  // For long-form platforms, ensure markdown compatibility
  if (limits.supportsMarkdown && !adapted.includes('\n\n')) {
    // Ensure paragraphs for markdown
    adapted = adapted.replace(/\n/g, '\n\n');
  }

  return { text: adapted, images: adaptedImages };
}
