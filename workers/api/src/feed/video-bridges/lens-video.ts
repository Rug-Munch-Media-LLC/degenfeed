/**
 * @degenfeed/api-worker — Lens Video Bridge
 *
 * Fetches video publications from Lens Protocol.
 * Handles error recovery — individual fetch failures never break the feed.
 */

import type { UnifiedVideo } from '../video-aggregator';

const LENS_API = 'https://api-v2.lens.dev';

export async function fetchLensChannelVideos(
  profileId: string,
  _limit = 10,
): Promise<UnifiedVideo[]> {
  try {
    const query = `query {
      publications(request: {profileId: "${profileId}", publicationTypes: [POST], limit: 20}) {
        items { __typename ... on Post {
          id
          metadata { name description content image { original { url } } media { original { url mimeType } } }
          stats { totalAmountOfViews totalAmountOfMirrors }
          createdAt
        }}
      }
    }`;

    const res = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { publications?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.publications?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => {
        const media = (item.metadata as Record<string, unknown> | undefined)?.media as
          | Array<Record<string, unknown>>
          | undefined;
        return media?.some((m) => (m.mimeType as string)?.startsWith('video/'));
      })
      .map((item: Record<string, unknown>) => {
        const meta = item.metadata as Record<string, unknown> | undefined;
        const media = meta?.media as Array<Record<string, unknown>> | undefined;
        const video = media?.find((m) => (m.mimeType as string)?.startsWith('video/'));
        const image = meta?.image as Record<string, unknown> | undefined;
        const stats = item.stats as Record<string, unknown> | undefined;
        const pubId = item.id as string;

        return {
          id: `lens:${pubId}`,
          title: (meta?.name as string) ?? 'Lens Video',
          description: (meta?.content as string) ?? (meta?.description as string) ?? '',
          thumbnail:
            ((image?.original as Record<string, unknown> | undefined)?.url as string) ?? '',
          url: ((video?.original as Record<string, unknown> | undefined)?.url as string) ?? '',
          duration: 0,
          platform: 'lens' as const,
          platformLabel: 'Lens',
          platformColor: '#00501e',
          creatorName: 'Lens Creator',
          creatorId: profileId,
          creatorAvatar: '',
          creatorUrl: `https://lenster.xyz/u/${profileId}`,
          viewCount: Number((stats?.totalAmountOfViews as number) ?? 0),
          likeCount: 0,
          publishedAt: item.createdAt as string,
          publishedMs: new Date(item.createdAt as string).getTime(),
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
      explorePublications(request: {sortCriteria: TOP_COMMENTED, limit: 20}) {
        items { __typename ... on Post {
          id
          metadata { name description content image { original { url } } media { original { url mimeType } } }
          stats { totalAmountOfViews totalAmountOfMirrors }
          createdAt
        }}
      }
    }`;

    const res = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { explorePublications?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.explorePublications?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => {
        const media = (item.metadata as Record<string, unknown> | undefined)?.media as
          | Array<Record<string, unknown>>
          | undefined;
        return media?.some((m) => (m.mimeType as string)?.startsWith('video/'));
      })
      .map((item: Record<string, unknown>) => {
        const meta = item.metadata as Record<string, unknown> | undefined;
        const media = meta?.media as Array<Record<string, unknown>> | undefined;
        const video = media?.find((m) => (m.mimeType as string)?.startsWith('video/'));
        const image = meta?.image as Record<string, unknown> | undefined;
        const stats = item.stats as Record<string, unknown> | undefined;

        return {
          id: `lens:${item.id as string}`,
          title: (meta?.name as string) ?? 'Lens Video',
          description: (meta?.content as string) ?? '',
          thumbnail:
            ((image?.original as Record<string, unknown> | undefined)?.url as string) ?? '',
          url: ((video?.original as Record<string, unknown> | undefined)?.url as string) ?? '',
          duration: 0,
          platform: 'lens' as const,
          platformLabel: 'Lens',
          platformColor: '#00501e',
          creatorName: 'Lens Creator',
          creatorId: 'lens:unknown',
          creatorAvatar: '',
          creatorUrl: '',
          viewCount: Number((stats?.totalAmountOfViews as number) ?? 0),
          likeCount: 0,
          publishedAt: item.createdAt as string,
          publishedMs: new Date(item.createdAt as string).getTime(),
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
    const gqlQuery = `query {
      search(request: {query: "${query.replace(/"/g, '\\"')}", type: PUBLICATION, limit: 10}) {
        items { __typename ... on Post {
          id
          metadata { name description media { original { url mimeType } } }
          createdAt
        }}
      }
    }`;

    const res = await fetch(LENS_API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: gqlQuery }),
    });
    if (!res.ok) return [];

    const json = (await res.json()) as {
      data?: { search?: { items: Array<Record<string, unknown>> } };
    };

    const items = json?.data?.search?.items ?? [];
    return items
      .filter((item: Record<string, unknown>) => {
        const media = (item.metadata as Record<string, unknown> | undefined)?.media as
          | Array<Record<string, unknown>>
          | undefined;
        return media?.some((m) => (m.mimeType as string)?.startsWith('video/'));
      })
      .map((item: Record<string, unknown>) => {
        const meta = item.metadata as Record<string, unknown> | undefined;
        const media = meta?.media as Array<Record<string, unknown>> | undefined;
        const video = media?.find((m) => (m.mimeType as string)?.startsWith('video/'));

        return {
          id: `lens:${item.id as string}`,
          title: (meta?.name as string) ?? 'Lens Video',
          description: '',
          thumbnail: '',
          url: ((video?.original as Record<string, unknown> | undefined)?.url as string) ?? '',
          duration: 0,
          platform: 'lens' as const,
          platformLabel: 'Lens',
          platformColor: '#00501e',
          creatorName: 'Lens Creator',
          creatorId: 'lens:search',
          creatorAvatar: '',
          creatorUrl: '',
          viewCount: 0,
          likeCount: 0,
          publishedAt: item.createdAt as string,
          publishedMs: new Date(item.createdAt as string).getTime(),
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
