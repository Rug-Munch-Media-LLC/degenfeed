import type { UnifiedPost } from '../../server';
import { detectContentType, extractMediaFromPost, guessNiches } from './helpers';
import type { BskyPostView } from './types';

export function postToUnified(post: BskyPostView): UnifiedPost {
  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];
  const mediaItems = extractMediaFromPost(post);
  for (const media of mediaItems) {
    embeds.push({
      kind: 'image',
      url: media.url,
      meta: {
        thumb: media.thumb,
        alt: media.alt,
        width: media.width,
        height: media.height,
        aspectRatio: media.aspectRatio,
      },
    });
  }
  if (post.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.embed.external.uri,
      meta: {
        title: post.embed.external.title,
        description: post.embed.external.description,
        thumb: post.embed.external.thumb,
      },
    });
  }
  if (!embeds.length && post.record.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.record.embed.external.uri,
      meta: {
        title: post.record.embed.external.title,
        description: post.record.embed.external.description,
      },
    });
  }
  const contentType = detectContentType(post);
  return {
    id: `bluesky:${post.uri}`,
    protocol: 'bluesky',
    author: {
      id: `bluesky:${post.author.did}`,
      primary: { protocol: 'bluesky', id: post.author.did },
      handles: { bluesky: post.author.handle },
      displayName: post.author.displayName || post.author.handle,
      bio: '',
      avatarUrl: post.author.avatar || '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { did: post.author.did },
    },
    text: post.record.text,
    contentType,
    embeds,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: 0,
      },
    },
    raw: post,
    niches: guessNiches(post.record.text),
  };
}
