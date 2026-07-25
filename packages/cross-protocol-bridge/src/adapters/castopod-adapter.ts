/**
 * @degenfeed/cross-protocol-bridge — Castopod Adapter
 *
 * Castopod is a federated podcast hosting platform (ActivityPub + Podcasting 2.0).
 * Posts are podcast episodes with title, description, audio enclosure.
 *
 * Limits:
 *   - Title: required, max 255 chars
 *   - Description: long-form (shown in feed)
 *   - Audio: required (mp3), no size limit enforced here
 *   - Cover art: 1 image (recommended 3000x3000)
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';

export const castopodAdapter: PlatformAdapter = {
  protocol: 'castopod',
  name: 'Castopod',
  charLimit: 10000,
  maxMedia: 2,
  supportedMediaTypes: ['audio/mpeg', 'image/jpeg', 'image/png', 'image/webp'],
  supportsRichText: true,
  supportsScheduling: true,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const title = master.title || master.text.split('\n')[0]?.slice(0, 255) || 'Podcast Episode';
    const hashtags = (master.hashtags || []).map((h) => `#${h}`);

    let description = master.text;
    if (hashtags.length > 0) {
      description += `\n\n${hashtags.join(' ')}`;
    }

    // Separate audio from cover art
    let audioUrl: string | undefined;
    let coverUrl: string | undefined;
    const mediaUrls: string[] = [];

    if (master.media && master.media.length > 0) {
      for (const m of master.media) {
        const type = (m.mimeType || '').toLowerCase();
        if (type.startsWith('audio/')) {
          audioUrl = m.url;
        } else {
          if (!coverUrl) coverUrl = m.url;
          mediaUrls.push(m.url);
        }
      }
    }

    // Podcasting 2.0: value block for Bitcoin payments, transcripts, etc.
    const extra: Record<string, unknown> = {
      episodeTitle: title,
      description,
      audioUrl,
      coverUrl,
      language: master.lang || 'en',
      isSensitive: master.isSensitive || false,
    };

    if (master.linkCard) {
      extra.showNotes = master.linkCard.url;
    }

    return {
      protocol: 'castopod',
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
    const title = master.title || master.text.split('\n')[0]?.slice(0, 255) || 'Episode';
    const hasAudio = master.media?.some((m) => (m.mimeType || '').startsWith('audio/'));
    return `[Castopod] ${hasAudio ? '🎙' : '📝'} "${title}"`;
  },
};
