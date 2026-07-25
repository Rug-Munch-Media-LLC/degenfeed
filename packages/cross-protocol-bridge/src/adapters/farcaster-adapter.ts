/**
 * @degenfeed/cross-protocol-bridge — Farcaster Content Adapter
 *
 * Adapts a MasterPost into a Farcaster cast (320-char limit).
 * Handles:
 * - 320-char truncation with "read more" link
 * - Frame embeds from link cards
 * - Media attachments as embeds
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const FARCASTER_CHAR_LIMIT = 320;

export const farcasterAdapter: PlatformAdapter = {
  protocol: 'farcaster',
  name: 'Farcaster',
  charLimit: FARCASTER_CHAR_LIMIT,
  maxMedia: 4,
  supportedMediaTypes: ['image/*'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'hash');

    // Build the cast text — Farcaster uses short form
    let castText = master.text;

    // Append hashtags inline (Farcaster renders them)
    if (hashtags.length > 0) {
      castText += `\n\n${hashtags.join(' ')}`;
    }

    // Truncate with read more link if over limit
    const readMoreUrl = master.linkCard?.url || master.media?.[0]?.url;
    castText = truncateText(castText, FARCASTER_CHAR_LIMIT, readMoreUrl);

    // Build embed URLs
    const embeds: string[] = [];

    // Add link card as embed
    if (master.linkCard && !castText.includes(master.linkCard.url)) {
      embeds.push(master.linkCard.url);
    }

    // Add media as embeds (Farcaster supports up to 4 image embeds)
    const mediaUrls = master.media?.slice(0, this.maxMedia).map((m) => m.url) ?? [];
    embeds.push(...mediaUrls);

    return {
      protocol: 'farcaster',
      text: castText,
      mediaUrls: mediaUrls,
      mediaAlts: master.media
        ?.slice(0, this.maxMedia)
        .map((m) => m.alt)
        .filter(Boolean) as string[],
      formattedHashtags: hashtags,
      extra: {
        embeds,
        parentFid: undefined,
        parentHash: undefined,
      },
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Farcaster — 320 char limit]';
    preview += `\n${master.text.slice(0, 300)}`;

    const remaining = FARCASTER_CHAR_LIMIT - master.text.length;
    if (remaining < 0) {
      preview += `\n⚠️ ${Math.abs(remaining)} characters over limit — will truncate`;
    } else {
      preview += `\n✅ ${remaining} characters remaining`;
    }

    if (master.linkCard) {
      preview += `\n🔗 Embed: ${master.linkCard.title ?? master.linkCard.url}`;
    }

    if (master.media && master.media.length > 0) {
      preview += `\n🖼️ ${master.media.length} image(s) to embed`;
    }

    return preview;
  },
};
