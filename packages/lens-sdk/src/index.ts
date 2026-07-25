import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

// Re-export DataExport types
export type {
  LensDataExport,
  LensFollowExport,
  LensMomokaProofExport,
  LensProfileExport,
  LensPublicationExport,
  LensReactionExport,
} from './data-export';

// Re-export Momoka types
export type {
  MomokaHealth,
  MomokaProof,
  MomokaSubmitRequest,
  MomokaSubmitResult,
} from './momoka';
export type { Protocol, UnifiedIdentity };

export const LENS_API_URL = 'https://api-v2.lens.dev/graphql';
export const FALLBACK_LENS_URLS = ['https://api.lens.xyz/graphql', LENS_API_URL];

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
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new Error(`Lens API error: ${res.status}`);
    }
    const json = (await res.json()) as { data?: unknown; errors?: { message: string }[] };
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

  async getProfile(profileId: string): Promise<LensProfile | null> {
    try {
      const data = (await this.request(
        `query Profile($request: ProfileRequest!) {
          profile(request: $request) {
            id handle { localName } metadata { displayName picture { optimized { uri } } bio } stats { followers following } }
          }
        }`,
        { request: { forProfileId: profileId } },
      )) as { profile: LensProfile };
      return data.profile ?? null;
    } catch {
      return null;
    }
  }

  async getProfileByHandle(handle: string): Promise<LensProfile | null> {
    try {
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
      return data.profile ?? null;
    } catch {
      return null;
    }
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
