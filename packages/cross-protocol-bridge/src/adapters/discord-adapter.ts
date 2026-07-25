/**
 * @degenfeed/cross-protocol-bridge — Discord Content Adapter
 *
 * Adapts a MasterPost into a Discord webhook message.
 * Handles:
 * - 2000 char limit per message
 * - Embeds for link cards
 * - Media attachments
 * - Rich embed formatting
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const DISCORD_CHAR_LIMIT = 2000;

export const discordAdapter: PlatformAdapter = {
  protocol: 'discord',
  name: 'Discord',
  charLimit: DISCORD_CHAR_LIMIT,
  maxMedia: 10,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: true,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const hashtags = formatHashtags(master.hashtags ?? [], 'hash');

    let content = master.text;

    // Append hashtags
    if (hashtags.length > 0) {
      content += '\n' + hashtags.join(' ');
    }

    // Append mentions
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      content += '\n' + mentions.map((m) => `@${m}`).join(' ');
    }

    content = truncateText(content, DISCORD_CHAR_LIMIT);

    // Build embed for link card
    const embeds: Record<string, unknown>[] = [];
    if (master.linkCard) {
      const embed: Record<string, unknown> = {
        type: 'rich',
        description: master.text.slice(0, 2048),
        color: 0x00ff41, // DegenFeed green
      };

      if (master.linkCard.title) {
        embed.title = master.linkCard.title;
      }

      if (master.linkCard.url) {
        embed.url = master.linkCard.url;
      }

      if (master.linkCard.imageUrl) {
        embed.image = { url: master.linkCard.imageUrl };
      }

      embeds.push(embed);
    }

    // If no link card but we have a title, embed it
    if (embeds.length === 0 && master.title) {
      embeds.push({
        type: 'rich',
        title: master.title,
        description: master.text.slice(0, 2048),
        color: 0x00ff41,
      });
    }

    const extra: Record<string, unknown> = {
      embeds,
      username: 'DegenFeed Cross-Post',
      avatar_url: 'https://degenfeed.xyz/favicon.svg',
    };

    return {
      protocol: 'discord',
      text: content,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      formattedHashtags: hashtags,
      extra,
      supportsRichText: true,
      richText: content,
    };
  },

  preview(master: MasterPost): string {
    let preview = '[Discord — Webhook]';

    if (master.linkCard) {
      preview += `\n📦 Embed: ${master.linkCard.title ?? master.linkCard.url}`;
    }

    preview += '\n' + master.text.slice(0, 300);

    if (master.text.length > 300) {
      preview += '...';
    }

    if (master.media && master.media.length > 0) {
      preview += `\n🖼️ ${master.media.length} attachment(s)`;
    }

    return preview;
  },
};
