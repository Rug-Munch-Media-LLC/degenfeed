/**
 * @degenfeed/cross-protocol-bridge — Bluesky (AT Protocol) Content Adapter
 *
 * Adapts a MasterPost into an AT Protocol post (300-char limit).
 * Handles:
 * - 300-char truncation with "read more" link
 * - Image embeds with alt text (up to 4 images)
 * - Link card as external embed
 * - Language tagging
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const BSKY_CHAR_LIMIT = 300;

export const blueskyAdapter: PlatformAdapter = {
  protocol: 'bluesky',
  name: 'Bluesky',
  charLimit: BSKY_CHAR_LIMIT,
  maxMedia: 4,
  supportedMediaTypes: ['image/*'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'bare');

    // Build skeet text
    let skeetText = master.text;

    // Mentions on Bluesky need at:// DIDs; we keep handles for client-side resolution
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      skeetText += '\n\n' + mentions.map((m) => `@${m}`).join(' ');
    }

    // Add hashtags
    if (hashtags.length > 0) {
      skeetText += '\n\n' + hashtags.map((h) => `#${h}`).join(' ');
    }

    // Truncate with read more link
    const readMoreUrl = master.linkCard?.url;
    skeetText = truncateText(skeetText, BSKY_CHAR_LIMIT, readMoreUrl);

    // Build facets for rich text (client-side or SDK handles this)
    const extra: Record<string, unknown> = {
      langs: [master.lang ?? 'en'],
    };

    // Embed: link card or images
    if (master.linkCard) {
      extra.externalEmbed = {
        uri: master.linkCard.url,
        title: master.linkCard.title ?? '',
        description: master.linkCard.description ?? '',
        thumb: master.linkCard.imageUrl,
      };
    }

    // Images with alt text
    const mediaItems = (master.media ?? []).slice(0, this.maxMedia);
    const mediaUrls = mediaItems.map((m) => m.url);
    const mediaAlts = mediaItems.map((m) => m.alt ?? '');

    // Content warning / label
    if (master.contentWarning || master.isSensitive) {
      extra.labels = ['nsfw'];
    }

    return {
      protocol: 'bluesky',
      text: skeetText,
      mediaUrls,
      mediaAlts,
      formattedHashtags: hashtags.map((h) => `#${h}`),
      extra,
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Bluesky — 300 char limit]';
    preview += '\n' + master.text.slice(0, 280);

    const remaining = BSKY_CHAR_LIMIT - master.text.length;
    if (remaining < 0) {
      preview += `\n⚠️ ${Math.abs(remaining)} characters over limit — will truncate`;
    } else {
      preview += `\n✅ ${remaining} characters remaining`;
    }

    if (master.linkCard) {
      preview += `\n🔗 Card: ${master.linkCard.title ?? master.linkCard.url}`;
    }

    if (master.media && master.media.length > 0) {
      preview += `\n🖼️ ${master.media.length} image(s) with alt text`;
    }

    if (master.contentWarning) {
      preview += `\n⚠️ CW: ${master.contentWarning}`;
    }

    return preview;
  },
};
