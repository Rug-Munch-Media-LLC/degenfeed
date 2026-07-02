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
import { buildUnifiedPost, emptyIdentity, emptyMetrics } from '@degenfeed/feed-core';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const LENS_API_URL = 'https://api.lens.xyz/graphql';

export interface LensPublication {
  id: string;
  profileId: string;
  metadata: {
    content: string;
    media: { original: { url: string } }[];
  };
  createdAt: string;
  stats: { totalAmountOfComments: number; totalAmountOfMirrors: number; totalAmountOfReactions: number };
  by: { id: string; handle: string; metadata: { displayName: string | null; picture: string | null } };
}

export class LensClient {
  private apiUrl: string;

  constructor(apiUrl: string = LENS_API_URL) {
    this.apiUrl = apiUrl;
  }

  async query(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
    const res = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Lens API error: ${res.status}`);
    const json = (await res.json()) as { data?: unknown; errors?: unknown };
    if (json.errors) throw new Error(`Lens query error: ${JSON.stringify(json.errors)}`);
    return json.data;
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
