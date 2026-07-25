/**
 * @degenfeed/cross-protocol-bridge — Telegram Content Adapter
 *
 * Adapts a MasterPost into a Telegram channel message.
 * Handles:
 * - 4096 char limit (Telegram message cap)
 * - HTML formatting for links, bold, italic
 * - Media group support (up to 10)
 * - Link card as inline link
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const TELEGRAM_CHAR_LIMIT = 4096;

export const telegramAdapter: PlatformAdapter = {
  protocol: 'telegram',
  name: 'Telegram',
  charLimit: TELEGRAM_CHAR_LIMIT,
  maxMedia: 10,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: true,
  supportsScheduling: true,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'hash');

    // Build HTML-formatted message
    const htmlParts: string[] = [];

    // Main text with link card embedded
    const mainText = master.text;

    // Escape HTML in text, then convert line breaks
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const textHtml = escapeHtml(mainText).replace(/\n/g, '<br/>');
    htmlParts.push(textHtml);

    // Link card becomes an inline link
    if (master.linkCard) {
      const linkTitle = escapeHtml(master.linkCard.title ?? master.linkCard.url);
      htmlParts.push(`\n\n<b>🔗 <a href="${master.linkCard.url}">${linkTitle}</a></b>`);
      if (master.linkCard.description) {
        htmlParts.push(`\n<i>${escapeHtml(master.linkCard.description)}</i>`);
      }
    }

    // Mentions as inline links (client resolves username)
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      htmlParts.push(
        '\n\n' + mentions.map((m) => `<a href="tg://resolve?domain=${m}">@${m}</a>`).join(' '),
      );
    }

    // Hashtags
    if (hashtags.length > 0) {
      htmlParts.push('\n\n' + hashtags.join(' '));
    }

    let htmlContent = htmlParts.join('');
    htmlContent = truncateText(htmlContent, TELEGRAM_CHAR_LIMIT);

    return {
      protocol: 'telegram',
      text: htmlContent,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      formattedHashtags: hashtags,
      supportsRichText: true,
      richText: htmlContent,
      extra: {
        parseMode: 'HTML',
        disableWebPagePreview: false,
        disableNotification: false,
      },
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Telegram — HTML formatted]';
    preview += '\n' + master.text.slice(0, 300);

    if (master.text.length > 300) {
      preview += '...';
    }

    if (master.linkCard) {
      preview += `\n🔗 ${master.linkCard.title ?? master.linkCard.url}`;
    }

    if (master.hashtags && master.hashtags.length > 0) {
      preview += '\n🏷️ ' + master.hashtags.join(' ');
    }

    preview += '\n📐 HTML formatting applied';

    return preview;
  },
};
