import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const LENS_API_URL = 'https://api-v2.lens.dev/graphql';
export const FALLBACK_LENS_URLS = ['https://api.lens.xyz/graphql', LENS_API_URL];

export const CURATED_LENS_PROFILE_IDS = [
  '0x01',
  '0x05',
  '0x0b',
  '0x14',
  '0x1e',
  '0x32',
  '0x64',
  '0xc8',
  '0x12c',
  '0x1f4',
];

export const CURATED_LENS_HANDLES = [
  'lensprotocol',
  'stani',
  'aaveaave',
  'pooltogether',
  'balancer',
  'uniswap',
  'lido',
  'makerdao',
  'bradorbradley',
  'wagmi',
  'chriscomrie',
  'jouni',
  'maguila',
  'yoginth',
  'james',
];

export interface LensProfile {
  id: string;
  handle?: { localName: string } | null;
  metadata?: {
    displayName?: string | null;
    picture?: { optimized?: { uri?: string } | null } | null;
    bio?: string | null;
  } | null;
  stats?: {
    followers?: number;
    following?: number;
  } | null;
}

export interface LensPublication {
  id: string;
  by: {
    id: string;
    handle?: { localName: string } | null;
    metadata?: {
      displayName?: string | null;
      picture?: { optimized?: { uri?: string } | null } | null;
    } | null;
  };
  metadata?: {
    content?: string | null;
    asset?: { image?: { optimized?: { uri?: string } | null } | null } | null;
  } | null;
  createdAt: string;
  stats?: {
    comments?: number;
    mirrors?: number;
    reactions?: number;
    quotes?: number;
  } | null;
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export class LensClient {
  private apiUrl: string;
  private accessToken: string | null = null;

  constructor(apiUrl: string = LENS_API_URL) {
    this.apiUrl = apiUrl;
  }

  setAuth(accessToken: string): void {
    this.accessToken = accessToken;
  }

  private async requestRaw(
    url: string,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
    };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Lens API error: ${res.status}`);
    const json = (await res.json()) as GraphqlResponse<unknown>;
    if (json.errors?.length)
      throw new Error(`Lens query error: ${json.errors[0]?.message ?? 'unknown'}`);
    return json.data;
  }

  async request(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const urls = [this.apiUrl, ...FALLBACK_LENS_URLS.filter((u) => u !== this.apiUrl)];
    let lastErr: Error | undefined;
    for (const url of urls) {
      try {
        return await this.requestRaw(url, query, variables);
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error('Lens request failed');
      }
    }
    throw lastErr ?? new Error('Lens request failed');
  }

  async query(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    return this.requestRaw(this.apiUrl, query, variables);
  }

  async getProfilesByHandles(handles: string[]): Promise<LensProfile[]> {
    try {
      const data = (await this.request(
        `query Profiles($request: ProfilesRequest!) {
          profiles(request: $request) {
            items { id handle { localName } metadata { displayName picture { optimized { uri } } bio } stats { followers following } }
          }
        }`,
        {
          request: {
            where: { handles: handles.map((h) => (h.endsWith('.lens') ? h : `${h}.lens`)) },
          },
        },
      )) as { profiles: { items: LensProfile[] } };
      return data.profiles?.items ?? [];
    } catch {
      return this.getProfilesByHandlesFallback(handles);
    }
  }

  private async getProfilesByHandlesFallback(handles: string[]): Promise<LensProfile[]> {
    const results = await Promise.allSettled(
      handles.map(async (handle) => {
        const data = (await this.request(
          `query Profile($request: ProfileRequest!) {
            profile(request: $request) {
              id handle { localName } metadata { displayName picture { optimized { uri } } bio } stats { followers following } }
            }
          }`,
          {
            request: {
              forHandle: handle.endsWith('.lens') ? handle : `${handle}.lens`,
            },
          },
        )) as { profile: LensProfile };
        return data.profile;
      }),
    );
    return results
      .filter(
        (r): r is PromiseFulfilledResult<LensProfile> =>
          r.status === 'fulfilled' && Boolean(r.value),
      )
      .map((r) => r.value);
  }

  async getPublicationsByProfileIds(profileIds: string[], limit = 50): Promise<LensPublication[]> {
    try {
      const data = (await this.request(
        `query Publications($request: PublicationsRequest!) {
          publications(request: $request) {
            items {
              ... on Post {
                id
                by { id handle { localName } metadata { displayName picture { optimized { uri } } } }
                metadata { content asset { ... on PublicationMetadataMediaImage { image { optimized { uri } } } } }
                createdAt
                stats { comments mirrors reactions quotes }
              }
            }
          }
        }`,
        { request: { where: { from: profileIds }, limit } },
      )) as { publications: { items: LensPublication[] } };
      return data.publications?.items ?? [];
    } catch {
      const all: LensPublication[] = [];
      for (const id of profileIds) {
        const posts = await this.getPublicationsByProfileId(
          id,
          Math.ceil(limit / profileIds.length),
        );
        all.push(...posts);
      }
      return all;
    }
  }

  private async getPublicationsByProfileId(
    profileId: string,
    limit = 25,
  ): Promise<LensPublication[]> {
    const data = (await this.request(
      `query Publications($request: PublicationsRequest!) {
        publications(request: $request) {
          items {
            ... on Post {
              id
              by { id handle { localName } metadata { displayName picture { optimized { uri } } } }
              metadata { content asset { ... on PublicationMetadataMediaImage { image { optimized { uri } } } } }
              createdAt
              stats { comments mirrors reactions quotes }
            }
          }
        }
      }`,
      { request: { where: { from: [profileId] }, limit } },
    )) as { publications: { items: LensPublication[] } };
    return data.publications?.items ?? [];
  }

  async getPublicationsByHandles(handles: string[], limit = 50): Promise<LensPublication[]> {
    const profiles = await this.getProfilesByHandles(handles);
    const ids = profiles.map((p) => p.id).filter(Boolean);
    if (ids.length === 0) return [];
    return this.getPublicationsByProfileIds(ids, limit);
  }

  async getPublications(profileId: string, limit = 50): Promise<LensPublication[]> {
    return this.getPublicationsByProfileIds([profileId], limit);
  }

  profileToIdentity(profile: LensProfile): UnifiedIdentity {
    const handle = profile.handle?.localName ?? profile.id;
    return {
      id: `lens:${profile.id}`,
      primary: { protocol: 'lens', id: profile.id },
      handles: {
        nostr: null,
        farcaster: null,
        lens: `${handle}.lens`,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: profile.metadata?.displayName ?? handle,
      bio: profile.metadata?.bio ?? '',
      avatarUrl: profile.metadata?.picture?.optimized?.uri ?? '',
      verified: [],
      followerCount: profile.stats?.followers ?? 0,
      followingCount: profile.stats?.following ?? 0,
      links: [],
      keys: { lensProfileId: profile.id },
    };
  }

  publicationToUnifiedPost(pub: LensPublication, author?: UnifiedIdentity): UnifiedPost {
    const identity =
      author ??
      this.profileToIdentity({
        id: pub.by.id,
        handle: pub.by.handle,
        metadata: pub.by.metadata,
      });
    const text = pub.metadata?.content ?? '';
    const embeds: { kind: 'image'; url: string }[] = [];
    const imageUrl = pub.metadata?.asset?.image?.optimized?.uri;
    if (imageUrl) embeds.push({ kind: 'image', url: imageUrl });
    const stats = pub.stats ?? {};
    return {
      id: `lens:${pub.id}`,
      protocol: 'lens',
      author: identity,
      text: text.slice(0, 1000),
      embeds,
      createdAt: new Date(pub.createdAt).getTime(),
      metrics: {
        likes: stats.reactions ?? 0,
        reposts: stats.mirrors ?? 0,
        replies: stats.comments ?? 0,
        quotes: stats.quotes ?? 0,
      },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: {
          likes: stats.reactions ?? 0,
          reposts: stats.mirrors ?? 0,
          replies: stats.comments ?? 0,
          quotes: stats.quotes ?? 0,
        },
      },
      raw: pub,
      niches: [],
    };
  }

  async like(publicationId: string): Promise<void> {
    await this.request(
      `mutation AddReaction($request: ReactionRequest!) {
        addReaction(request: $request)
      }`,
      { request: { publicationId, reaction: 'UPVOTE' } },
    );
  }

  async unlike(publicationId: string): Promise<void> {
    await this.request(
      `mutation RemoveReaction($request: ReactionRequest!) {
        removeReaction(request: $request)
      }`,
      { request: { publicationId, reaction: 'UPVOTE' } },
    );
  }

  async mirror(publicationId: string): Promise<void> {
    await this.request(
      `mutation Mirror($request: MirrorRequest!) {
        mirror(request: $request) { ... on RelayResult { txHash } ... on RelayError { reason } }
      }`,
      { request: { publicationId } },
    );
  }

  async unmirror(publicationId: string): Promise<void> {
    await this.request(
      `mutation HidePublication($request: HidePublicationRequest!) {
        hidePublication(request: $request)
      }`,
      { request: { publicationId } },
    );
  }

  async comment(publicationId: string, content: string): Promise<void> {
    await this.request(
      `mutation Comment($request: CommentRequest!) {
        comment(request: $request) { ... on RelayResult { txHash } ... on RelayError { reason } }
      }`,
      { request: { publicationId, content } },
    );
  }
}
