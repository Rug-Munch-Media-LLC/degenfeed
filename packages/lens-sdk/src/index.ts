/**
 * @degenfeed/lens-sdk
 *
 * Lens Protocol client. Communicates with the Lens API (GraphQL) for
 * reading/writing publications, profiles, follows, and reactions.
 *
 * All posts normalize to @degenfeed/types `UnifiedPost`.
 *
 * ## Architecture
 *
 *   LensClient.connect() → LensClient
 *     .getPublications(profileId) → UnifiedPost[]
 *     .getFeed(profileId)         → UnifiedPost[]
 *     .publish(text, opts)        → UnifiedPost
 *     .getProfile(profileId)      → UnifiedIdentity
 *
 * API endpoint: https://api.lens.xyz/graphql (auth'd for writes)
 * Free read endpoint: https://api-v2.lens.dev (rate-limited)
 *
 * TODO(v1):
 *   - Implement full GraphQL queries for all operations
 *   - Add authentication via SIWL (Sign-In With Lens)
 *   - Add reaction and follow helpers
 *   - Add Momoka support
 *   - Add module/interaction support
 */

import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const LENS_API_URL = 'https://api.lens.xyz/graphql';
export const FALLBACK_LENS_URLS = [LENS_API_URL, 'https://api-v2.lens.dev/graphql'];

export interface LensPublication {
  id: string;
  profileId: string;
  metadata: {
    content: string;
    media: { original: { url: string } }[];
  };
  createdAt: string;
  stats: {
    totalAmountOfComments: number;
    totalAmountOfMirrors: number;
    totalAmountOfReactions: number;
  };
  by: {
    id: string;
    handle: string;
    metadata: { displayName: string | null; picture: string | null };
  };
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

  private async authQuery(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
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
    return this.authQuery(query, variables);
  }

  async like(publicationId: string): Promise<void> {
    await this.authQuery(
      `mutation AddReaction($request: ReactionRequest!) {
        addReaction(request: $request)
      }`,
      { request: { publicationId, reaction: 'UPVOTE' } },
    );
  }

  async unlike(publicationId: string): Promise<void> {
    await this.authQuery(
      `mutation RemoveReaction($request: ReactionRequest!) {
        removeReaction(request: $request)
      }`,
      { request: { publicationId, reaction: 'UPVOTE' } },
    );
  }

  async mirror(publicationId: string): Promise<void> {
    await this.authQuery(
      `mutation Mirror($request: MirrorRequest!) {
        mirror(request: $request) { ... on RelayResult { txHash } ... on RelayError { reason } }
      }`,
      { request: { publicationId } },
    );
  }

  async unmirror(publicationId: string): Promise<void> {
    await this.authQuery(
      `mutation HidePublication($request: HidePublicationRequest!) {
        hidePublication(request: $request)
      }`,
      { request: { publicationId } },
    );
  }

  async comment(publicationId: string, content: string): Promise<void> {
    await this.authQuery(
      `mutation Comment($request: CommentRequest!) {
        comment(request: $request) { ... on RelayResult { txHash } ... on RelayError { reason } }
      }`,
      { request: { publicationId, content } },
    );
  }

  async getPublications(profileId: string, limit = 50): Promise<LensPublication[]> {
    const data = (await this.query(
      `query Publications($profileId: ProfileId!, $limit: LimitScalar!) {
        publications(request: { profileId: $profileId, limit: $limit, publicationTypes: [POST] }) {
          items { id profileId metadata { content media { original { url } } } createdAt stats { totalAmountOfComments totalAmountOfMirrors totalAmountOfReactions } by { id handle metadata { displayName picture } } }
        }
      }`,
      { profileId, limit },
    )) as {
      publications: { items: LensPublication[] };
    };
    return (data as Record<string, { items: LensPublication[] }>).publications?.items ?? [];
  }
}
