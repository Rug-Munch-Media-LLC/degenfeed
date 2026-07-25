/**
 * @degenfeed/cross-protocol-bridge — Funkwhale Adapter
 *
 * Funkwhale is a federated music/audio sharing platform (ActivityPub).
 * Posts are track/album/playlist uploads with descriptions.
 *
 * Limits:
 *   - Title: required (track name)
 *   - Description: long-form
 *   - Media: audio files (mp3, flac, ogg)
 *   - Cover art: 1 image
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';

export const funkwhaleAdapter: PlatformAdapter = {
  protocol: 'funkwhale',
  name: 'Funkwhale',
  charLimit: 5000,
  maxMedia: 1,
  supportedMediaTypes: ['audio/mpeg', 'audio/flac', 'audio/ogg', 'image/jpeg', 'image/png'],
  supportsRichText: true,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const title = master.title || master.text.split('\n')[0]?.slice(0, 200) || 'Audio Post';
    const hashtags = (master.hashtags || []).map((h) => `#${h}`);

    let description = master.text;
    if (hashtags.length > 0) {
      description += `\n\n${hashtags.join(' ')}`;
    }

    // Check if there's an audio file URL in media
    const mediaUrls: string[] = [];
    let audioUrl: string | undefined;
    let coverUrl: string | undefined;

    if (master.media && master.media.length > 0) {
      // Separate audio from cover art
      for (const m of master.media) {
        const type = m.mimeType || '';
        if (type.startsWith('audio/')) {
          audioUrl = m.url;
        } else {
          if (!coverUrl) coverUrl = m.url;
          mediaUrls.push(m.url);
        }
      }
    }

    return {
      protocol: 'funkwhale',
      text: description,
      title,
      mediaUrls,
      formattedHashtags: hashtags,
      supportsRichText: true,
      richText: description.replace(/\n/g, '<br>'),
      extra: {
        trackTitle: title,
        audioUrl,
        coverUrl,
        description,
      },
    };
  },

  preview(master: MasterPost): string {
    const title = master.title || master.text.split('\n')[0]?.slice(0, 200) || 'Audio';
    const hasAudio = master.media?.some((m) => (m.mimeType || '').startsWith('audio/'));
    return `[Funkwhale] ${hasAudio ? '🎵' : '📝'} "${title}"`;
  },
};
