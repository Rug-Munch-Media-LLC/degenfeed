/**
 * @degenfeed/cross-protocol-bridge — Mobilizon Adapter
 *
 * Mobilizon is a federated events management platform (ActivityPub).
 * Posts are event announcements with title, description, date, location.
 *
 * Limits:
 *   - Title: required, max 150 chars
 *   - Description: long-form, no hard limit
 *   - Images: 1 poster/cover image
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';

export const mobilizonAdapter: PlatformAdapter = {
  protocol: 'mobilizon',
  name: 'Mobilizon',
  charLimit: 10000,
  maxMedia: 1,
  supportedMediaTypes: ['image/jpeg', 'image/png', 'image/webp'],
  supportsRichText: true,
  supportsScheduling: true,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const title = master.title || master.text.split('\n')[0]?.slice(0, 150) || 'Event Announcement';
    const hashtags = (master.hashtags || []).map((h) => `#${h}`);

    let description = master.text;

    // Build event description with hashtags
    if (hashtags.length > 0) {
      description += `\n\n${hashtags.join(' ')}`;
    }

    // Extract physical or online event info from link card
    const extra: Record<string, unknown> = {
      eventTitle: title,
      description,
      visibility: 'public',
    };

    if (master.linkCard) {
      extra.onlineAddress = master.linkCard.url;
      extra.description = master.linkCard.description || description;
    }

    // Media
    let mediaUrls: string[] = [];
    if (master.media && master.media.length > 0) {
      mediaUrls = master.media[0]?.url ? [master.media[0].url] : [];
    }

    return {
      protocol: 'mobilizon',
      text: description,
      title,
      mediaUrls,
      formattedHashtags: hashtags,
      supportsRichText: true,
      richText: description.replace(/\n/g, '<br>'),
      extra,
    };
  },

  preview(master: MasterPost): string {
    const title = master.title || master.text.split('\n')[0]?.slice(0, 150) || 'Event';
    const excerpt = master.text.slice(0, 100);
    return `[Mobilizon] Event: "${title}"\n${excerpt}${master.text.length > 100 ? '...' : ''}`;
  },
};
