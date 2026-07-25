/**
 * @degenfeed/cross-protocol-bridge — Threads Content Adapter
 *
 * Adapts a MasterPost into a Threads post (via Bridgy Fed or Meta Graph API).
 * Handles:
 * - 500-char limit (via Meta API; Bridgy Fed uses ActivityPub limit)
 * - Media attachments
 * - Alt text
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const THREADS_CHAR_LIMIT = 500;

export const threadsAdapter: PlatformAdapter = {
  protocol: 'threads',
  name: 'Threads',
  charLimit: THREADS_CHAR_LIMIT,
  maxMedia: 10,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: false,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'hash');

    let text = master.text;

    // Mentions use @handle format on Threads
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      text += '\n\n' + mentions.map((m) => `@${m}`).join(' ');
    }

    // Hashtags
    if (hashtags.length > 0) {
      text += '\n\n' + hashtags.join(' ');
    }

    text = truncateText(text, THREADS_CHAR_LIMIT);

    const extra: Record<string, unknown> = {
      mediaType: master.media && master.media.length > 0 ? 'MIXED' : 'TEXT',
    };

    // Link card
    if (master.linkCard) {
      extra.linkUrl = master.linkCard.url;
      extra.linkTitle = master.linkCard.title;
    }

    return {
      protocol: 'threads',
      text,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      formattedHashtags: hashtags,
      extra,
      supportsRichText: false,
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Threads — 500 char limit]';
    preview += '\n' + master.text.slice(0, 480);

    const remaining = THREADS_CHAR_LIMIT - master.text.length;
    if (master.text.length > THREADS_CHAR_LIMIT) {
      preview += `\n⚠️ ${Math.abs(remaining)} chars over limit`;
    } else {
      preview += `\n✅ ${remaining} chars remaining`;
    }

    if (master.linkCard) {
      preview += `\n🔗 ${master.linkCard.url}`;
    }

    return preview;
  },
};
