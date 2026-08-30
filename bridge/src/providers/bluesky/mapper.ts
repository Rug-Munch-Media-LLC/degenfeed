import type { UnifiedPost } from '../../server';
import {
  buildRichTextHtml,
  extractMediaFromPost,
  extractQuoteFromPost,
  guessNiches,
} from './helpers';
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
  // Native Bluesky video → kind 'video' with HLS playlist URL
  const videoView = post.embed?.video;
  if (videoView?.playlist) {
    embeds.push({
      kind: 'video',
      url: videoView.playlist,
      meta: {
        thumbnail: videoView.thumbnail,
        duration: videoView.duration,
        aspectRatio: videoView.aspectRatio,
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
  if (!embeds.some((e) => e.kind === 'link') && post.record.embed?.external) {
    embeds.push({
      kind: 'link',
      url: post.record.embed.external.uri,
      meta: {
        title: post.record.embed.external.title,
        description: post.record.embed.external.description,
      },
    });
  }
  // Quote post (app.bsky.embed.record#view) → kind 'quote'
  const quote = extractQuoteFromPost(post);
  if (quote) {
    embeds.push({
      kind: 'quote',
      url: `https://bsky.app/profile/${encodeURIComponent(quote.author)}/post/${quote.uri.split('/').pop() || ''}`,
      meta: {
        uri: quote.uri,
        author: quote.author,
        displayName: quote.displayName,
        text: quote.text,
      },
    });
  }

  const richHtml = buildRichTextHtml(post.record.text, post.record.facets);
  const nativeId = post.uri.split('/').pop() || post.cid;

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
      url: `https://bsky.app/profile/${encodeURIComponent(post.author.handle || post.author.did)}`,
      links: [
        {
          label: 'profile',
          url: `https://bsky.app/profile/${encodeURIComponent(post.author.handle || post.author.did)}`,
        },
      ],
      keys: { did: post.author.did },
    },
    text: post.record.text,
    html: post.record.facets?.length ? richHtml : undefined,
    embeds,
    parentId: post.record.reply?.parent.uri ? `bluesky:${post.record.reply.parent.uri}` : undefined,
    rootId: post.record.reply?.root.uri ? `bluesky:${post.record.reply.root.uri}` : undefined,
    createdAt: new Date(post.record.createdAt).getTime(),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: post.quoteCount ?? 0,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: post.quoteCount ?? 0,
      },
    },
    raw: post,
    niches: guessNiches(post.record.text),
    dfUri: `df://bluesky:${nativeId}`,
    canonicalUrl: `https://bsky.app/profile/${encodeURIComponent(post.author.handle || post.author.did)}/post/${nativeId}`,
  };
}
