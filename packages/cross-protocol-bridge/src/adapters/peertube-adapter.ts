/**
 * @degenfeed/cross-protocol-bridge — PeerTube Content Adapter
 *
 * Adapts a MasterPost into a PeerTube video upload.
 * Handles:
 * - Title requirement
 * - 5000-char description limit
 * - Channel selection
 * - Tags from hashtags
 * - Privacy settings
 * - Video media detection
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { formatHashtags, truncateText } from './types';

const PEERTUBE_CHAR_LIMIT = 5000;

export const peertubeAdapter: PlatformAdapter = {
  protocol: 'peertube',
  name: 'PeerTube',
  charLimit: PEERTUBE_CHAR_LIMIT,
  maxMedia: 1, // 1 video per upload
  supportedMediaTypes: ['video/*'],
  supportsRichText: true,
  supportsScheduling: true,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    // Title is required for PeerTube
    const title = (master.title ?? master.text.slice(0, 120)).slice(0, 120);

    // Build description
    let description = master.text;

    const hashtags = formatHashtags(master.hashtags ?? [], 'bare');
    if (hashtags.length > 0) {
      description += `\n\nTags: ${hashtags.map((h) => `#${h}`).join(', ')}`;
    }

    if (master.linkCard) {
      description += `\n\n🔗 ${master.linkCard.url}`;
    }

    description = truncateText(description, PEERTUBE_CHAR_LIMIT);

    // Find video URL from media attachments
    const videoMedia = master.media?.find(
      (m) => m.mimeType?.startsWith('video/') || /\.(mp4|webm|mkv|mov)$/i.test(m.url),
    );

    // Extra metadata
    const extra: Record<string, unknown> = {
      title,
      privacy: master.isSensitive ? 2 : 1, // 1=Public, 2=Unlisted
      tags: hashtags,
      channelId: undefined, // To be filled by the caller with the user's channel
      support: null, // Support text
    };

    if (master.lang) {
      extra.language = master.lang;
    }

    if (master.isSensitive) {
      extra.nsfw = true;
    }

    return {
      protocol: 'peertube',
      text: description,
      title,
      mediaUrls: videoMedia ? [videoMedia.url] : [],
      mediaAlts: videoMedia ? [videoMedia.alt ?? ''] : [],
      formattedHashtags: hashtags.map((h) => `#${h}`),
      extra,
      supportsRichText: true,
      richText: description.replace(/\n/g, '<br/>'),
    };
  },

  preview(master: MasterPost): string {
    let preview = '[PeerTube — Video]';
    preview += `\n📹 ${master.title ?? master.text.slice(0, 120)}`;

    const hasVideo = master.media?.some(
      (m) => m.mimeType?.startsWith('video/') || /\.(mp4|webm)$/i.test(m.url),
    );

    if (!hasVideo) {
      preview += '\n⚠️ No video media found — will fail without a video file';
    }

    preview += `\n${master.text.slice(0, 300)}`;
    if (master.text.length > 300) preview += '...';

    if (master.hashtags && master.hashtags.length > 0) {
      preview += `\n🏷️ Tags: ${master.hashtags.join(', ')}`;
    }

    return preview;
  },
};
