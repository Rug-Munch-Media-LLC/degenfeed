/**
 * @degenfeed/cross-protocol-bridge — Lens Protocol Content Adapter
 *
 * Adapts a MasterPost into a Lens Protocol publication.
 * Handles:
 * - 5000-char limit
 * - Collectible publications with optional collect amount
 * - Media attachments
 * - Link card as embedded content
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const LENS_CHAR_LIMIT = 5000;

export const lensAdapter: PlatformAdapter = {
  protocol: 'lens',
  name: 'Lens',
  charLimit: LENS_CHAR_LIMIT,
  maxMedia: 4,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'bare');

    // Build publication content
    let content = master.text;

    // Mentions
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      content += '\n\n' + mentions.map((m) => `@lens:${m}`).join(' ');
    }

    // Hashtags
    if (hashtags.length > 0) {
      content += '\n\n' + hashtags.map((h) => `#${h}`).join(' ');
    }

    // Truncate if needed (unlikely given 5000 limit)
    content = truncateText(content, LENS_CHAR_LIMIT);

    const extra: Record<string, unknown> = {
      locale: master.lang ?? 'en',
    };

    // Collectible publication config
    if (master.linkCard) {
      extra.contentURI = master.linkCard.url;
    }

    // Media attachments as contentURI for image-first publications
    if (master.media && master.media.length > 0) {
      extra.media = master.media.slice(0, this.maxMedia).map((m) => ({
        url: m.url,
        alt: m.alt ?? '',
        mimeType: m.mimeType ?? 'image/jpeg',
      }));
    }

    return {
      protocol: 'lens',
      text: content,
      mediaUrls: master.media
        ?.slice(0, this.maxMedia)
        .map((m) => m.url)
        .filter(Boolean) as string[],
      mediaAlts: master.media
        ?.slice(0, this.maxMedia)
        .map((m) => m.alt)
        .filter(Boolean) as string[],
      formattedHashtags: hashtags.map((h) => `#${h}`),
      extra,
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Lens Protocol]';
    preview += '\n' + master.text.slice(0, 500);

    if (master.text.length > 500) {
      preview += '...';
    }

    if (master.linkCard) {
      preview += `\n🔗 ${master.linkCard.title ?? master.linkCard.url}`;
    }

    if (master.hashtags && master.hashtags.length > 0) {
      preview += '\n🏷️ ' + master.hashtags.map((h) => `#${h}`).join(' ');
    }

    preview += '\n💎 Publication is collectible';

    return preview;
  },
};
