import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const LENS_API_URL = 'https://api-v2.lens.dev/graphql';
export const FALLBACK_LENS_URLS = [LENS_API_URL, 'https://api.lens.xyz/graphql'];

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
  'aaveaave',
  'stani',
  'bradorbradley',
  'wagmi',
  'chriscomrie',
  'jouni',
  'maguila',
  'yoginth',
  'james',
];

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

export class LensClient {
  private apiUrl: string;
  private accessToken: string | null = null;

  constructor(apiUrl: string = LENS_API_URL) {
    this.apiUrl = apiUrl;
  }

  setAuth(accessToken: string): void {
    this.accessToken = accessToken;
  }

  private async request(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
    };
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Lens API error: ${res.status}`);
    const json = (await res.json()) as { data?: unknown; errors?: unknown };
    if (json.errors) throw new Error(`Lens query error: ${JSON.stringify(json.errors)}`);
    return json.data;
  }

  async query(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    return this.request(query, variables);
  }

  async getProfilesByHandles(handles: string[]): Promise<LensProfile[]> {
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
  }

  async getPublicationsByProfileIds(profileIds: string[], limit = 50): Promise<LensPublication[]> {
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
