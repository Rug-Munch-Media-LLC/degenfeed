/**
 * @degenfeed/cross-protocol-bridge — Pixelfed Content Adapter
 *
 * Adapts a MasterPost into a Pixelfed image gallery post.
 * Handles:
 * - 5000-char description limit
 * - Up to 20 image attachments (gallery)
 * - Alt text per image (Pixelfed supports it natively)
 * - CW/NSFW tagging
 * - Hashtag formatting
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const PIXELFED_CHAR_LIMIT = 5000;

export const pixelfedAdapter: PlatformAdapter = {
  protocol: 'pixelfed',
  name: 'Pixelfed',
  charLimit: PIXELFED_CHAR_LIMIT,
  maxMedia: 20,
  supportedMediaTypes: ['image/*'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'hash');

    // Build caption
    let caption = master.text;

    // Mentions
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      caption += `\n\n${mentions.map((m) => `@${m}`).join(' ')}`;
    }

    // Hashtags at the end (Pixelfed standard)
    if (hashtags.length > 0) {
      caption += `\n\n${hashtags.join(' ')}`;
    }

    caption = truncateText(caption, PIXELFED_CHAR_LIMIT);

    // Gallery: multiple images
    const galleryImages = (master.media ?? [])
      .filter((m) => !m.mimeType || m.mimeType.startsWith('image/'))
      .slice(0, this.maxMedia);

    const extra: Record<string, unknown> = {};

    if (master.isSensitive) {
      extra.sensitive = true;
    }

    if (master.contentWarning) {
      extra.spoilerText = master.contentWarning;
    }

    // Pixelfed uses an ActivityPub-compatible API, so we pass media info
    extra.mediaType = galleryImages.length > 1 ? 'gallery' : 'image';

    return {
      protocol: 'pixelfed',
      text: caption,
      mediaUrls: galleryImages.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: galleryImages.map((m) => m.alt ?? '').filter(Boolean) as string[],
      formattedHashtags: hashtags,
      extra,
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    const imageCount = (master.media ?? []).filter(
      (m) => !m.mimeType || m.mimeType.startsWith('image/'),
    ).length;

    let preview = '[Pixelfed — Image Gallery]';
    preview += `\n📷 ${imageCount} image(s)`;

    if (imageCount > 20) {
      preview += '\n⚠️ Over 20 images — will be truncated';
    }

    preview += `\n${master.text.slice(0, 300)}`;
    if (master.text.length > 300) preview += '...';

    if (master.hashtags && master.hashtags.length > 0) {
      preview += `\n🏷️ ${master.hashtags.map((h) => `#${h}`).join(' ')}`;
    }

    if (master.contentWarning) {
      preview += `\n⚠️ CW: ${master.contentWarning}`;
    }

    return preview;
  },
};
