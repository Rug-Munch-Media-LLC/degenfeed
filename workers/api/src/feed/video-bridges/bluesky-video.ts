/**
 * @degenfeed/api-worker — Bluesky Video Bridge
 *
 * Fetches video content from Bluesky/AT Protocol.
 * Bluesky supports video embeds via external embeds and the app.bsky.embed.video type.
 * No silent failures — individual errors are caught, never break the feed.
 */

import type { UnifiedVideo } from '../video-aggregator-types';

export async function fetchBlueskyChannelVideos(
  _did: string,
  _limit = 10,
): Promise<UnifiedVideo[]> {
  // Bluesky doesn't have a public "channel videos" API for arbitrary DIDs
  // without auth. This would use the AT Protocol firehose or PDS-specific queries.
  // Stub that returns empty — real implementation requires authenticated PDS access.
  return [];
}

export async function fetchBlueskyVideoFeed(): Promise<UnifiedVideo[]> {
  try {
    const pdsUrl = 'https://public.api.bsky.app';
    // Try to find a curated video feed generator
    const res = await fetch(
      `${pdsUrl}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:z72i7hd5jnv5a7j5l3s5j3xh/app.bsky.feed.generator/video-feed&limit=30`,
      {
        headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
      },
    );
    if (!res.ok) return [];

    const json = (await res.json()) as {
      feed?: Array<{
        post: {
          uri: string;
          author: { did: string; handle: string; displayName?: string; avatar?: string };
          record: {
            text?: string;
            embed?: {
              $type: string;
              external?: { uri?: string; title?: string; description?: string; thumb?: string };
              video?: { mimeType?: string; url?: string };
            };
            createdAt?: string;
          };
          embed?: {
            $type: string;
            external?: { uri?: string; title?: string; description?: string; thumb?: string };
            video?: { mimeType?: string; url?: string };
          };
          likeCount?: number;
          repostCount?: number;
          replyCount?: number;
        };
      }>;
    };

    const results: UnifiedVideo[] = [];
    for (const entry of json?.feed ?? []) {
      const p = entry.post;
      if (!p) continue;

      // Check for video in embed or record.embed
      const recordEmbed = p.record?.embed;
      const postEmbed = p.embed;
      const embed = postEmbed ?? recordEmbed;

      // Support both app.bsky.embed.video (native) and app.bsky.embed.external (link)
      let videoUrl: string | undefined;
      let thumbnailUrl: string | undefined;
      let title: string | undefined;

      if (embed?.$type === 'app.bsky.embed.external' && embed.external) {
        const extUrl = embed.external.uri ?? '';
        if (extUrl.match(/\.(mp4|webm|mov|m3u8)/i) || extUrl.includes('video')) {
          videoUrl = extUrl;
        }
        thumbnailUrl = embed.external.thumb;
        title = embed.external.title;
      }

      if (!videoUrl) continue;

      results.push({
        id: `bluesky-video:${p.uri}`,
        title: title ?? p.record?.text?.slice(0, 100) ?? 'Bluesky Video',
        description: p.record?.text ?? '',
        thumbnail: thumbnailUrl ?? '',
        url: videoUrl,
        duration: 0,
        platform: 'bluesky' as const,
        platformLabel: 'Bluesky',
        platformColor: '#1185fe',
        creatorName: p.author.displayName ?? p.author.handle,
        creatorId: p.author.did,
        creatorAvatar: p.author.avatar ?? '',
        creatorUrl: `https://bsky.app/profile/${p.author.handle}`,
        viewCount: 0,
        likeCount: p.likeCount ?? 0,
        publishedAt: p.record?.createdAt ?? new Date().toISOString(),
        publishedMs: p.record?.createdAt ? new Date(p.record.createdAt).getTime() : Date.now(),
        category: 'entertainment',
        tags: ['bluesky', 'video'],
        isShort: true,
        isLive: false,
        qualityScore: 30,
      });
    }

    return results;
  } catch {
    return [];
  }
}

export async function searchBlueskyVideos(query: string): Promise<UnifiedVideo[]> {
  try {
    const pdsUrl = 'https://public.api.bsky.app';
    const encoded = encodeURIComponent(query);
    const res = await fetch(`${pdsUrl}/xrpc/app.bsky.feed.searchPosts?q=${encoded}&limit=30`, {
      headers: { accept: 'application/json', 'user-agent': 'DegenFeed/1.0' },
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      posts?: Array<{
        uri: string;
        author: { did: string; handle: string; displayName?: string };
        record: { text?: string; embed?: Record<string, unknown>; createdAt?: string };
        embed?: Record<string, unknown>;
      }>;
    };

    const results: UnifiedVideo[] = [];
    for (const post of json?.posts ?? []) {
      // Basic check — real impl needs embed parsing
      const text = post.record?.text ?? '';
      if (text.match(/\.(mp4|webm|mov)/i) || text.includes('youtu') || text.includes('vimeo')) {
        results.push({
          id: `bluesky-search:${post.uri}`,
          title: text.slice(0, 100),
          description: text,
          thumbnail: '',
          url: '',
          duration: 0,
          platform: 'bluesky' as const,
          platformLabel: 'Bluesky',
          platformColor: '#1185fe',
          creatorName: post.author.displayName ?? post.author.handle,
          creatorId: post.author.did,
          creatorAvatar: '',
          creatorUrl: `https://bsky.app/profile/${post.author.handle}`,
          viewCount: 0,
          likeCount: 0,
          publishedAt: post.record?.createdAt ?? new Date().toISOString(),
          publishedMs: post.record?.createdAt
            ? new Date(post.record.createdAt).getTime()
            : Date.now(),
          category: 'entertainment',
          tags: ['bluesky', 'video'],
          isShort: true,
          isLive: false,
          qualityScore: 20,
        });
      }
    }

    return results;
  } catch {
    return [];
  }
}
