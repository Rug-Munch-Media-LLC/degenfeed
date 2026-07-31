/**
 * @degenfeed/api-worker — Lens Video Bridge
 *
 * Fetches video publications from Lens Protocol.
 * Handles error recovery — individual fetch failures never break the feed.
 */

import type { UnifiedVideo } from '../video-aggregator';

const LENS_API = 'https://api.lens.xyz/graphql';

const LENS_POST_VIDEO_FIELDS = `
  id timestamp
  metadata {
    ... on VideoMetadata { content title video { item } }
    ... on ImageMetadata { content image { item } }
    ... on TextOnlyMetadata { content }
  }
  author { address username { localName } metadata { name bio picture } }
  stats { reactions comments reposts quotes }
`;

export async function fetchLensChannelVideos(
  profileId: string,
  _limit = 10,
): Promise<UnifiedVideo[]> {
  try {
    const query = `query {
      posts(request: {filter: {authors: ["${profileId}"], postTypes: [ROOT]}, pageSize: FIFTY}) {
        items { __typename ... on Post ${LENS_POST_VIDEO_FIELDS} }
      }
    }`;

    const res = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { posts?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.posts?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => {
        const video = (item.metadata as Record<string, unknown> | undefined)?.video as
          | Record<string, unknown>
          | undefined;
        return Boolean(video?.item);
      })
      .map((item: Record<string, unknown>) => {
        const meta = item.metadata as Record<string, unknown> | undefined;
        const video = meta?.video as Record<string, unknown> | undefined;
        const image = meta?.image as Record<string, unknown> | undefined;
        const stats = item.stats as Record<string, unknown> | undefined;
        const author = item.author as Record<string, unknown> | undefined;
        const authorMeta = author?.metadata as Record<string, unknown> | undefined;
        const username = author?.username as Record<string, unknown> | undefined;
        const pubId = item.id as string;
        const publishedAt = (item.timestamp as string) ?? new Date().toISOString();

        return {
          id: `lens:${pubId}`,
          title: (meta?.title as string) ?? 'Lens Video',
          description: (meta?.content as string) ?? '',
          thumbnail: (image?.item as string) ?? '',
          url: (video?.item as string) ?? '',
          duration: 0,
          platform: 'lens' as const,
          platformLabel: 'Lens',
          platformColor: '#00501e',
          creatorName: (authorMeta?.name as string) ?? 'Lens Creator',
          creatorId: (author?.address as string) ?? profileId,
          creatorAvatar: (authorMeta?.picture as string) ?? '',
          creatorUrl: `https://hey.xyz/u/${(username?.localName as string) ?? profileId}`,
          viewCount: Number((stats?.reactions as number) ?? 0),
          likeCount: 0,
          publishedAt,
          publishedMs: new Date(publishedAt).getTime(),
          category: 'entertainment',
          tags: ['lens', 'video'],
          isShort: true,
          isLive: false,
          qualityScore: 30,
        };
      });
  } catch {
    return [];
  }
}

export async function fetchLensTrendingVideos(_category: string): Promise<UnifiedVideo[]> {
  try {
    const query = `query {
      posts(request: {filter: {postTypes: [ROOT]}, pageSize: FIFTY}) {
        items { __typename ... on Post ${LENS_POST_VIDEO_FIELDS} }
      }
    }`;

    const res = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { posts?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.posts?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => {
        const video = (item.metadata as Record<string, unknown> | undefined)?.video as
          | Record<string, unknown>
          | undefined;
        return Boolean(video?.item);
      })
      .map((item: Record<string, unknown>) => {
        const meta = item.metadata as Record<string, unknown> | undefined;
        const video = meta?.video as Record<string, unknown> | undefined;
        const image = meta?.image as Record<string, unknown> | undefined;
        const stats = item.stats as Record<string, unknown> | undefined;
        const author = item.author as Record<string, unknown> | undefined;
        const authorMeta = author?.metadata as Record<string, unknown> | undefined;
        const username = author?.username as Record<string, unknown> | undefined;
        const publishedAt = (item.timestamp as string) ?? new Date().toISOString();

        return {
          id: `lens:${item.id as string}`,
          title: (meta?.title as string) ?? 'Lens Video',
          description: (meta?.content as string) ?? '',
          thumbnail: (image?.item as string) ?? '',
          url: (video?.item as string) ?? '',
          duration: 0,
          platform: 'lens' as const,
          platformLabel: 'Lens',
          platformColor: '#00501e',
          creatorName: (authorMeta?.name as string) ?? 'Lens Creator',
          creatorId: (author?.address as string) ?? 'lens:unknown',
          creatorAvatar: (authorMeta?.picture as string) ?? '',
          creatorUrl: `https://hey.xyz/u/${(username?.localName as string) ?? 'unknown'}`,
          viewCount: Number((stats?.reactions as number) ?? 0),
          likeCount: 0,
          publishedAt,
          publishedMs: new Date(publishedAt).getTime(),
          category: 'entertainment',
          tags: ['lens', 'video'],
          isShort: true,
          isLive: false,
          qualityScore: 30,
        };
      });
  } catch {
    return [];
  }
}

export async function searchLensVideos(query: string): Promise<UnifiedVideo[]> {
  try {
    const gqlQuery = `query($q:String!) {
      posts(request: {filter: {searchQuery: $q, postTypes: [ROOT]}, pageSize: FIFTY}) {
        items { __typename ... on Post ${LENS_POST_VIDEO_FIELDS} }
      }
    }`;

    const res = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery, variables: { q: query } }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { posts?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.posts?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => {
        const video = (item.metadata as Record<string, unknown> | undefined)?.video as
          | Record<string, unknown>
          | undefined;
        return Boolean(video?.item);
      })
      .map((item: Record<string, unknown>) => {
        const meta = item.metadata as Record<string, unknown> | undefined;
        const video = meta?.video as Record<string, unknown> | undefined;
        const image = meta?.image as Record<string, unknown> | undefined;
        const author = item.author as Record<string, unknown> | undefined;
        const authorMeta = author?.metadata as Record<string, unknown> | undefined;
        const username = author?.username as Record<string, unknown> | undefined;
        const publishedAt = (item.timestamp as string) ?? new Date().toISOString();

        return {
          id: `lens:${item.id as string}`,
          title: (meta?.title as string) ?? 'Lens Video',
          description: (meta?.content as string) ?? '',
          thumbnail: (image?.item as string) ?? '',
          url: (video?.item as string) ?? '',
          duration: 0,
          platform: 'lens' as const,
          platformLabel: 'Lens',
          platformColor: '#00501e',
          creatorName: (authorMeta?.name as string) ?? 'Lens Creator',
          creatorId: (author?.address as string) ?? 'lens:search',
          creatorAvatar: (authorMeta?.picture as string) ?? '',
          creatorUrl: `https://hey.xyz/u/${(username?.localName as string) ?? 'unknown'}`,
          viewCount: 0,
          likeCount: 0,
          publishedAt,
          publishedMs: new Date(publishedAt).getTime(),
          category: 'entertainment',
          tags: ['lens', 'video'],
          isShort: true,
          isLive: false,
          qualityScore: 20,
        };
      });
  } catch {
    return [];
  }
}
