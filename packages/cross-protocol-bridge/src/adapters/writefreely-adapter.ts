/**
 * @degenfeed/cross-protocol-bridge — WriteFreely Adapter
 *
 * WriteFreely is a federated long-form publishing platform (ActivityPub).
 * Posts appear as blog articles. Markdown is supported.
 *
 * Limits:
 *   - Title: required (first line or auto-generated)
 *   - Body: no hard limit, but keep under 50KB
 *   - Images: embedded as Markdown, no native media attachment API
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';

export const writefreelyAdapter: PlatformAdapter = {
  protocol: 'writefreely',
  name: 'WriteFreely',
  charLimit: 50000,
  maxMedia: 5,
  supportedMediaTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  supportsRichText: true,
  supportsScheduling: false,
  supportsCW: false,

  adapt(master: MasterPost): ProtocolPublishParams {
    const title = master.title || master.text.split('\n')[0]?.slice(0, 200) || 'Untitled';
    const body = master.text;
    const hashtags = (master.hashtags || []).map((h) => `#${h}`);

    // Build post body with optional hashtag footer
    let fullBody = body;
    if (hashtags.length > 0) {
      fullBody += `\n\n${hashtags.join(' ')}`;
    }

    // Media as Markdown image embeds
    let mediaUrls: string[] = [];
    if (master.media && master.media.length > 0) {
      mediaUrls = master.media.slice(0, 5).map((m) => m.url);
      const mediaMd = mediaUrls.map((url) => `![Image](${url})`).join('\n\n');
      fullBody += `\n\n${mediaMd}`;
    }

    return {
      protocol: 'writefreely',
      text: fullBody,
      title,
      mediaUrls,
      formattedHashtags: hashtags,
      supportsRichText: true,
      richText: fullBody.replace(/\n/g, '\n\n'),
      extra: {
        contentType: 'markdown',
        collectionAlias: undefined, // Set by caller
      },
    };
  },

  preview(master: MasterPost): string {
    const excerpt = master.text.slice(0, 200);
    const title = master.title || excerpt.split('\n')[0] || 'Untitled';
    return `[WriteFreely] "${title}"\n${excerpt}${master.text.length > 200 ? '...' : ''}`;
  },
};
