/**
 * @degenfeed/cross-protocol-bridge — Reddit Content Adapter
 *
 * Adapts a MasterPost into a Reddit submission.
 * Handles:
 * - Title extraction (required for Reddit)
 * - 40,000 character limit for self posts
 * - NSFW tagging
 * - Subreddit selection hint from content/niche
 * - Flair suggestions
 */

import type { MasterPost, PlatformAdapter, ProtocolPublishParams } from './types';
import { truncateText } from './types';

const REDDIT_CHAR_LIMIT = 40_000;

/** Very basic subreddit suggestion from keywords in the text */
function suggestSubreddit(text: string, hashtags: string[]): string {
  const allWords = [...text.toLowerCase().split(/\s+/), ...hashtags.map((h) => h.toLowerCase())];

  const subredditKeywords: Record<string, string[]> = {
    crypto: ['crypto', 'bitcoin', 'ethereum', 'solana', 'defi', 'nft', 'web3', 'blockchain'],
    technology: ['tech', 'software', 'coding', 'programming', 'startup', 'ai', 'ml'],
    gaming: ['game', 'gaming', 'play', 'esports', 'rpg', 'fps'],
    music: ['music', 'song', 'album', 'artist', 'band', 'concert'],
    art: ['art', 'artist', 'gallery', 'digital art', 'drawing'],
    news: ['news', 'breaking', 'update', 'report', 'headline'],
  };

  for (const [niche, keywords] of Object.entries(subredditKeywords)) {
    for (const word of allWords) {
      if (keywords.some((kw) => word.includes(kw))) {
        switch (niche) {
          case 'crypto':
            return 'CryptoCurrency';
          case 'technology':
            return 'technology';
          case 'gaming':
            return 'gaming';
          case 'music':
            return 'Music';
          case 'art':
            return 'Art';
          case 'news':
            return 'news';
          default:
            return 'all';
        }
      }
    }
  }

  return 'all';
}

export const redditAdapter: PlatformAdapter = {
  protocol: 'reddit',
  name: 'Reddit',
  charLimit: REDDIT_CHAR_LIMIT,
  maxMedia: 20,
  supportedMediaTypes: ['image/*', 'video/*'],
  supportsRichText: true,
  supportsScheduling: false,
  supportsCW: true,

  adapt(master: MasterPost): ProtocolPublishParams {
    // Reddit requires a title — use the provided one or generate from text
    let title = master.title ?? '';
    if (!title) {
      // Use first sentence or first 100 chars as title
      const firstSentence = master.text.split(/[.!?\n]/)[0] ?? master.text.slice(0, 100);
      title = firstSentence.trim();
    }
    // Reddit title max is 300 chars
    title = title.slice(0, 300);

    // Build body text
    let body = master.text;

    // Mentions on Reddit use /u/ prefix
    const mentions = master.mentions ?? [];
    if (mentions.length > 0) {
      body += `\n\n${mentions.map((m) => `/u/${m}`).join(' ')}`;
    }

    // Hashtags don't really work on Reddit but include them as links
    const hashtags = master.hashtags ?? [];
    if (hashtags.length > 0) {
      body += `\n\n${hashtags.map((h) => `r/${h}`).join(' ')}`;
    }

    body = truncateText(body, REDDIT_CHAR_LIMIT);

    // Suggest a subreddit
    const suggestedSubreddit = suggestSubreddit(master.text, master.hashtags ?? []);

    const extra: Record<string, unknown> = {
      title,
      subreddit: suggestedSubreddit,
    };

    if (master.isSensitive) {
      extra.nsfw = true;
    }

    if (master.linkCard) {
      extra.url = master.linkCard.url;
      extra.kind = 'link'; // Reddit link post
    } else {
      extra.kind = 'self'; // Reddit self post
    }

    return {
      protocol: 'reddit',
      text: body,
      title,
      mediaUrls: master.media?.map((m) => m.url).filter(Boolean) as string[],
      mediaAlts: master.media?.map((m) => m.alt).filter(Boolean) as string[],
      extra,
      supportsRichText: true,
      richText: body.replace(/\n/g, '\n\n'),
    };
  },

  preview(master: MasterPost): string {
    const subreddit = suggestSubreddit(master.text, master.hashtags ?? []);

    let preview = `[Reddit — r/${subreddit}]`;
    preview += `\n📌 Title: ${master.title ?? '(auto-generated from first sentence)'}`;
    preview += `\n${master.text.slice(0, 400)}`;

    if (master.text.length > 400) {
      preview += '...';
    }

    if (master.linkCard) {
      preview += `\n🔗 ${master.linkCard.url} (link post)`;
    }

    if (master.isSensitive) {
      preview += '\n⚠️ NSFW';
    }

    return preview;
  },
};
