/**
 * @degenfeed/cross-protocol-bridge — Lemmy Content Adapter
 *
 * Adapts a MasterPost into a Lemmy community post.
 * Handles:
 * - Title requirement (auto-generated from text)
 * - 50,000 char body limit
 * - Link or text post types
 * - NSFW tagging
 * - Community selection hint
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { truncateText } from './types';

const LEMMY_CHAR_LIMIT = 50_000;

/** Suggest a community from content */
function suggestCommunity(text: string, hashtags: string[]): string {
  const allText = [...text.toLowerCase().split(/\s+/), ...hashtags.map((h) => h.toLowerCase())];

  const communities: Record<string, string[]> = {
    crypto: ['crypto', 'bitcoin', 'ethereum', 'defi', 'web3', 'blockchain', 'nft', 'solana'],
    technology: ['tech', 'software', 'programming', 'coding', 'ai', 'linux', 'foss'],
    gaming: ['gaming', 'game', 'esports', 'play'],
    movies: ['movie', 'film', 'cinema', 'tv', 'show'],
    music: ['music', 'song', 'band', 'album'],
  };

  for (const [community, keywords] of Object.entries(communities)) {
    if (allText.some((word) => keywords.some((kw) => word.includes(kw)))) {
      return community;
    }
  }

  return 'main';
}

export const lemmyAdapter: PlatformAdapter = {
  protocol: 'lemmy',
  name: 'Lemmy',
  charLimit: LEMMY_CHAR_LIMIT,
  maxMedia: 1,
  supportedMediaTypes: ['image/*'],
  supportsRichText: true,
  supportsScheduling: false,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    // Lemmy requires a title
    let title = master.title ?? '';
    if (!title) {
      title = master.text.split(/[.!?\n]/)[0]?.trim() ?? master.text.slice(0, 200);
    }
    title = title.slice(0, 200);

    // Build body
    let body = master.text;

    const hashtags = (master.hashtags ?? []).map((h) => `#${h}`);
    if (hashtags.length > 0) {
      body += `\n\n${hashtags.join(' ')}`;
    }

    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      body += `\n\n${mentions.map((m) => `!${m}`).join(' ')}`;
    }

    body = truncateText(body, LEMMY_CHAR_LIMIT);

    const suggestedCommunity = suggestCommunity(master.text, master.hashtags ?? []);

    const extra: Record<string, unknown> = {
      communityName: suggestedCommunity,
      title,
    };

    // Link post vs text post
    if (master.linkCard) {
      extra.url = master.linkCard.url;
      extra.postType = 'link';
    } else {
      extra.postType = 'text';
    }

    if (master.isSensitive) {
      extra.nsfw = true;
    }

    return {
      protocol: 'lemmy',
      text: body,
      title,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      formattedHashtags: hashtags,
      extra,
      supportsRichText: true,
      richText: body,
    };
  },

  preview(master: MasterPost): string {
    const community = suggestCommunity(master.text, master.hashtags ?? []);
    let preview = `[Lemmy — !${community}]`;
    preview += `\n📌 ${master.title ?? '(auto-generated)'}`;
    preview += `\n${master.text.slice(0, 300)}`;

    if (master.text.length > 300) {
      preview += '...';
    }

    if (master.linkCard) {
      preview += `\n🔗 ${master.linkCard.url} (link post)`;
    }

    return preview;
  },
};
