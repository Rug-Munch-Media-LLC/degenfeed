/**
 * @degenfeed/cross-protocol-bridge — BookWyrm Adapter
 *
 * BookWyrm is a federated social reading platform (ActivityPub).
 * Posts are "status updates" about books, reviews, or general thoughts.
 * Uses Mastodon-compatible ActivityPub under the hood.
 *
 * Limits:
 *   - Text: ~500 chars (Mastodon-compatible)
 *   - Media: 4 images
 *   - Supports content warnings for spoilers
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';

export const bookwyrmAdapter: PlatformAdapter = {
  protocol: 'bookwyrm',
  name: 'BookWyrm',
  charLimit: 500,
  maxMedia: 4,
  supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    const contentWarning = master.contentWarning || undefined;

    // Truncate to character limit
    let text = master.text;
    if (text.length > 500) {
      text = `${text.slice(0, 497)}...`;
    }

    // Add hashtags
    const hashtags = (master.hashtags || []).map((h) => `#${h}`);
    if (hashtags.length > 0) {
      const tagStr = `\n\n${hashtags.join(' ')}`;
      if ((text + tagStr).length <= 500) {
        text += tagStr;
      }
    }

    // Media URLs
    const mediaUrls = master.media ? master.media.slice(0, 4).map((m) => m.url) : [];

    // BookWyrm supports "quote posts" with book references
    // If there's a link, it might be a book URL
    const extra: Record<string, unknown> = {};
    if (master.linkCard) {
      extra.bookUrl = master.linkCard.url;
      extra.bookTitle = master.linkCard.title;
    }

    return {
      protocol: 'bookwyrm',
      text,
      mediaUrls,
      formattedHashtags: hashtags,
      supportsRichText: false,
      extra: {
        ...extra,
        sensitive: master.isSensitive || !!contentWarning,
        spoilerText: contentWarning,
      },
    };
  },

  preview(master: MasterPost): string {
    const text = master.text.slice(0, 200);
    const cw = master.contentWarning ? `[CW: ${master.contentWarning}] ` : '';
    return `[BookWyrm] ${cw}${text}${master.text.length > 200 ? '...' : ''}`;
  },
};
