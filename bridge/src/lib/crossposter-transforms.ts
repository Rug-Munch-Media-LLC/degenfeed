/**
 * Cross-poster transform pipeline — converts UnifiedPost to target protocol formats
 */

import type { ProtocolName, TransformResult } from '../crossposter-types';
import type { UnifiedPost } from '../server/types';

type TransformFunction = (
  post: UnifiedPost,
  target: ProtocolName,
) => TransformResult | Promise<TransformResult>;

/**
 * Default transforms per target.
 * Each transform converts a UnifiedPost into the target protocol's format.
 */
export const TRANSFORMS: Record<string, TransformFunction> = {
  /**
   * Transform for Nostr: create NIP-01 event
   */
  nostr: (post: UnifiedPost): TransformResult => {
    const now = Math.floor(Date.now() / 1000);
    const content = post.text
      ? `${post.text}\n\n— originally from ${post.protocol}`
      : `Cross-posted from ${post.protocol}`;

    return {
      success: true,
      payload: {
        kind: 1,
        content,
        created_at: Math.floor(post.createdAt / 1000) || now,
        tags: [
          ['t', 'degenfeed'],
          ['t', 'crosspost'],
          ['r', post.protocol],
          ['proxy', post.id, post.protocol],
        ],
      },
    };
  },

  /**
   * Transform for Bluesky: create app.bsky.feed.post record
   */
  bluesky: (post: UnifiedPost): TransformResult => {
    const text = `${post.text}\n\n[Originally from ${post.protocol}]`;
    const facets: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; uri?: string; tag?: string }>;
    }> = [];

    // Add link facets if there are embeds
    for (const embed of post.embeds) {
      if (embed.kind === 'link') {
        facets.push({
          index: {
            byteStart: 0,
            byteEnd: new TextEncoder().encode(text).byteLength,
          },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: embed.url }],
        });
      }
    }

    return {
      success: true,
      payload: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date(post.createdAt).toISOString(),
        facets: facets.length > 0 ? facets : undefined,
      },
    };
  },

  /**
   * Transform for PeerTube: create video announcement
   */
  peertube: (post: UnifiedPost): TransformResult => {
    const videoEmbed = post.embeds.find((e) => e.kind === 'video');
    if (!videoEmbed) {
      return { success: false, error: 'No video embed to announce' };
    }

    const duration = videoEmbed.meta?.duration || 0;
    const durationStr = duration > 0 ? ` (${Math.floor(duration / 60)}m ${duration % 60}s)` : '';

    return {
      success: true,
      payload: {
        text: `📹 New video${durationStr}: ${post.text.slice(0, 200)}\n\nWatch: ${videoEmbed.url}`,
        tags: ['degenfeed', 'video', 'peertube', post.protocol],
      },
    };
  },

  /**
   * Transform for Farcaster: create cast (320 char limit)
   */
  farcaster: (post: UnifiedPost): TransformResult => {
    const text =
      post.text.length > 320
        ? `${post.text.slice(0, 300)}...\n\n[Cross-posted from ${post.protocol}]`
        : `${post.text}\n\n[Cross-posted from ${post.protocol}]`;

    return {
      success: true,
      payload: { text, embeds: post.embeds.map((e) => ({ url: e.url })) },
    };
  },

  /**
   * Transform for Lens: create Lens publication (5000 char limit)
   */
  lens: (post: UnifiedPost): TransformResult => {
    const text =
      post.text.length > 5000
        ? `${post.text.slice(0, 4980)}...\n\n[Cross-posted from ${post.protocol}]`
        : `${post.text}\n\n[Cross-posted from ${post.protocol}]`;

    return {
      success: true,
      payload: { text, embeds: post.embeds.map((e) => ({ url: e.url })) },
    };
  },

  /**
   * Transform for Mastodon: create status
   */
  mastodon: (post: UnifiedPost): TransformResult => {
    const text = `${post.text}\n\n(from ${post.protocol})`;

    return {
      success: true,
      payload: { status: text, visibility: 'public' },
    };
  },

  /**
   * Transform for Pixelfed: photo cross-post (requires image embeds)
   */
  pixelfed: (post: UnifiedPost): TransformResult => {
    const imageEmbeds = post.embeds.filter((e) => e.kind === 'image' && e.url);
    if (imageEmbeds.length === 0) {
      return { success: false, error: 'No images to cross-post to Pixelfed' };
    }

    const attribution = post.text
      ? `${post.text}\n\n— ${post.author.displayName} (${post.protocol})`
      : `Photo from ${post.author.displayName} (${post.protocol})`;

    const caption = attribution.length > 497 ? `${attribution.slice(0, 494)}...` : attribution;

    return {
      success: true,
      payload: {
        caption,
        images: imageEmbeds.slice(0, 4).map((e) => e.url),
        visibility: 'public',
        protocol: post.protocol,
        authorName: post.author.displayName,
      },
    };
  },

  /**
   * Transform for WriteFreely: long-form blog cross-post (requires >= 20 chars)
   */
  writefreely: (post: UnifiedPost): TransformResult => {
    const text = post.text || '';
    if (text.length < 20) {
      return { success: false, error: 'Content too short for blog post' };
    }

    const firstLine = text.split('\n')[0] || '';
    const title =
      firstLine.length > 0 ? firstLine.slice(0, 120) : `Post from ${post.author.displayName}`;

    const body = `${text}\n\n— *Originally posted on ${post.protocol} by ${post.author.displayName}*`;
    const truncatedBody = body.length > 500000 ? body.slice(0, 499990) + '\n\n[truncated]' : body;

    return {
      success: true,
      payload: {
        title,
        body: truncatedBody,
        tags: [...post.niches, post.protocol, 'degenfeed', 'crosspost'],
        protocol: post.protocol,
      },
    };
  },
};
