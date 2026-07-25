/**
 * @degenfeed/cross-protocol-bridge — Mastodon/GoToSocial Content Adapter
 *
 * Adapts a MasterPost into an ActivityPub toot.
 * Handles:
 * - 500-char limit (Mastodon default; GoToSocial may differ)
 * - Content warnings (CW)
 * - Hashtag extraction and placement at end
 * - Media attachment with alt text
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const MASTODON_CHAR_LIMIT = 500;

export const mastodonAdapter: PlatformAdapter = {
  protocol: 'mastodon',
  name: 'Mastodon',
  charLimit: MASTODON_CHAR_LIMIT,
  maxMedia: 4,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: false,
  supportsScheduling: true,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'hash');

    // On Mastodon, hashtags at the end work best
    let tootText = master.text;

    // Mentions
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      tootText += `\n\n${mentions.map((m) => `@${m}`).join(' ')}`;
    }

    // Hashtags at the end
    if (hashtags.length > 0) {
      tootText += `\n\n${hashtags.join(' ')}`;
    }

    // Truncate if needed
    tootText = truncateText(tootText, MASTODON_CHAR_LIMIT);

    // CW prefix
    const spoilerText = master.contentWarning;

    const extra: Record<string, unknown> = {
      visibility: 'public',
    };

    if (spoilerText) {
      extra.spoilerText = spoilerText;
    }

    if (master.isSensitive) {
      extra.sensitive = true;
    }

    return {
      protocol: 'mastodon',
      text: tootText,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      formattedHashtags: hashtags,
      extra,
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Mastodon — 500 char limit]';

    if (master.contentWarning) {
      preview += `\n⚠️ CW: ${master.contentWarning}`;
    }

    preview += `\n${master.text.slice(0, 480)}`;

    const remaining = MASTODON_CHAR_LIMIT - master.text.length;

    if (master.mentions && master.mentions.length > 0) {
      preview += `\n👤 Mentions: ${master.mentions.join(', ')}`;
    }

    if (master.hashtags && master.hashtags.length > 0) {
      preview += `\n🏷️ ${master.hashtags.map((h) => `#${h}`).join(' ')}`;
    }

    if (master.text.length > MASTODON_CHAR_LIMIT) {
      preview += `\n⚠️ ${master.text.length - MASTODON_CHAR_LIMIT} chars over limit`;
    } else {
      preview += `\n✅ ${remaining} chars remaining`;
    }

    return preview;
  },
};
