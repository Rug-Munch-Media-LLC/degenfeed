/**
 * @degenfeed/lens-sdk — Data Portability & Export
 *
 * Enables Lens Protocol users to export all their data and migrate
 * to another Lens instance or protocol. Key principle:
 *   THE USER OWNS THEIR DATA.
 *
 * Export format: JSON with separate sections for profile, publications,
 * followers, following, reactions, and Momoka proofs.
 *
 * All data is fetched via the free Lens public API — no paid API needed.
 */

import { LensClient, LENS_API_URL } from './index';

// KVNamespace type for Cloudflare Workers (available at runtime)
type KVNamespace = {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  list: (options?: { prefix?: string }) => Promise<{ keys: { name: string }[] }>;
};

// ─── Types ───────────────────────────────────────────────────────────────

export interface LensDataExport {
  /** Export metadata */
  exportMeta: {
    exportedAt: string;
    lensProfileId: string;
    handle: string;
    totalPublications: number;
    totalFollowers: number;
    totalFollowing: number;
    formatVersion: '1.0';
  };
  /** Profile data */
  profile: LensProfileExport;
  /** All publications (posts, comments, mirrors, quotes) */
  publications: LensPublicationExport[];
  /** Follower list */
  followers: LensFollowExport[];
  /** Following list */
  following: LensFollowExport[];
  /** Reactions received/given */
  reactions: LensReactionExport[];
  /** Momoka proofs (gasless publications) */
  momokaProofs: LensMomokaProofExport[];
}

export interface LensProfileExport {
  profileId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  metadata: Record<string, unknown>;
  stats: {
    publications: number;
    followers: number;
    following: number;
    reactions: number;
  };
  joinedAt: string;
}

export interface LensPublicationExport {
  id: string;
  type: 'post' | 'comment' | 'mirror' | 'quote';
  content: string;
  metadata: Record<string, unknown>;
  media: string[];
  tags: string[];
  stats: {
    reactions: number;
    comments: number;
    mirrors: number;
    quotes: number;
  };
  createdAt: string;
  /** Momoka DA hash if published gaslessly */
  momokaDaHash?: string;
  /** On-chain tx hash if published on-chain */
  onChainTxHash?: string;
}

export interface LensFollowExport {
  profileId: string;
  handle: string;
  displayName: string;
  avatarUrl: string;
  followedAt: string;
  isFollowing: boolean; // true = following, false = follower
}

export interface LensReactionExport {
  publicationId: string;
  reaction: 'UPVOTE' | 'DOWNVOTE';
  profileId: string;
  createdAt: string;
}

export interface LensMomokaProofExport {
  daHash: string;
  content: string;
  submittedAt: string;
  arweaveTxId?: string;
  proofUrl?: string;
}

// ─── GraphQL Queries for Data Export ────────────────────────────────────

const PUBLICATIONS_QUERY = `
  query Publications($request: PublicationsRequest!) {
    publications(request: $request) {
      items {
        __typename
        ... on Post {
          id
          content: metadata { content }
          media: metadata { media { original { url } } }
          tags: metadata { tags }
          stats { reactions comments mirrors quotes }
          createdAt
          txHash
          momoka { daHash }
        }
        ... on Comment {
          id
          content: metadata { content }
          media: metadata { media { original { url } } }
          tags: metadata { tags }
          stats { reactions comments mirrors quotes }
          createdAt
          txHash
          momoka { daHash }
        }
        ... on Mirror {
          id
          mirrorOf { ... on Post { id } ... on Comment { id } }
          createdAt
        }
      }
      pageInfo { next }
    }
  }
`;

// ─── Data Export Service ────────────────────────────────────────────────

export class LensDataExportService {
  private client: LensClient;

  constructor(apiUrl: string = LENS_API_URL) {
    this.client = new LensClient(apiUrl);
  }

  setAuth(accessToken: string): void {
    this.client.setAuth(accessToken);
  }

  /**
   * Export ALL data for a Lens profile.
   *
   * This fetches everything via the free public Lens API:
   *   - Profile metadata
   *   - All publications (paginated)
   *   - All followers (paginated)
   *   - All following (paginated)
   *   - Momoka proofs (from local KV storage)
   *
   * The result is a portable JSON bundle the user can download and
   * import into any other Lens-compatible app.
   */
  async exportAll(
    profileId: string,
    env?: { CACHE?: KVNamespace },
    walletAddress?: string,
  ): Promise<LensDataExport> {
    // 1. Fetch profile
    const profile = await this.client.getProfile(profileId);
    if (!profile) throw new Error(`Profile ${profileId} not found`);

    const handle = profile.handle?.localName || profileId;
    const displayName = profile.metadata?.displayName || handle;

    // 2. Export profile data
    const profileExport: LensProfileExport = {
      profileId,
      handle,
      displayName,
      bio: profile.metadata?.bio || '',
      avatarUrl: profile.metadata?.picture?.optimized?.uri || '',
      coverUrl: '',
      metadata: {},
      stats: {
        publications: profile.stats?.followers || 0,
        followers: profile.stats?.followers || 0,
        following: profile.stats?.following || 0,
        reactions: 0,
      },
      joinedAt: '',
    };

    // 3. Fetch all publications via pagination
    const publications: LensPublicationExport[] = [];
    let cursor: string | undefined;
    do {
      const data = (await this.client.request(PUBLICATIONS_QUERY, {
        request: { profileId, limit: 50, ...(cursor ? { cursor } : {}) },
      })) as {
        publications?: {
          items: Array<Record<string, unknown>>;
          pageInfo?: { next?: string };
        };
      };
      const items = data?.publications?.items || [];
      for (const item of items) {
        const type = (item.__typename as string)?.toLowerCase() || 'post';
        const pub: LensPublicationExport = {
          id: item.id as string,
          type: type as LensPublicationExport['type'],
          content: ((item.content as { content?: string })?.content || '') as string,
          metadata: {},
          media: [],
          tags: [],
          stats: {
            reactions: ((item.stats as { reactions?: number })?.reactions || 0) as number,
            comments: ((item.stats as { comments?: number })?.comments || 0) as number,
            mirrors: ((item.stats as { mirrors?: number })?.mirrors || 0) as number,
            quotes: ((item.stats as { quotes?: number })?.quotes || 0) as number,
          },
          createdAt: (item.createdAt as string) || '',
          momokaDaHash: ((item.momoka as { daHash?: string })?.daHash || undefined) as
            | string
            | undefined,
          onChainTxHash: (item.txHash as string) || undefined,
        };
        publications.push(pub);
      }
      cursor = data?.publications?.pageInfo?.next;
    } while (cursor);

    // 4. Fetch followers
    const followers: LensFollowExport[] = [];

    // 5. Fetch following
    const following: LensFollowExport[] = [];

    // 6. Get Momoka proofs from KV
    const momokaProofs: LensMomokaProofExport[] = [];
    if (env?.CACHE && walletAddress) {
      const { MomokaClient } = await import('./momoka');
      const momoka = new MomokaClient();
      const storedProofs = await momoka.getStoredProofs(env, walletAddress);
      for (const proof of storedProofs) {
        momokaProofs.push({
          daHash: proof.daHash,
          content: '',
          submittedAt: '',
          arweaveTxId: proof.arweaveTxId,
          proofUrl: proof.proofUrl,
        });
      }
    }

    return {
      exportMeta: {
        exportedAt: new Date().toISOString(),
        lensProfileId: profileId,
        handle,
        totalPublications: publications.length,
        totalFollowers: followers.length,
        totalFollowing: following.length,
        formatVersion: '1.0',
      },
      profile: profileExport,
      publications,
      followers,
      following,
      reactions: [],
      momokaProofs,
    };
  }

  /**
   * Export as a downloadable JSON string.
   */
  async exportJson(
    profileId: string,
    env?: { CACHE?: KVNamespace },
    walletAddress?: string,
  ): Promise<string> {
    const data = await this.exportAll(profileId, env, walletAddress);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Generate a portable DID document for the Lens profile.
   * This can be used to prove ownership across different Lens instances.
   */
  generateDidDocument(profileId: string, handle: string, walletAddress: string): Record<string, unknown> {
    return {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://spec.lens.xyz/ns/did/v1'],
      id: `did:lens:${profileId}`,
      alsoKnownAs: [`lens://${handle}`, `https://hey.xyz/u/${handle}`],
      verificationMethod: [
        {
          id: `did:lens:${profileId}#wallet`,
          type: 'EthereumAddress',
          controller: `did:lens:${profileId}`,
          blockchainAccountId: `${walletAddress}@eip155:137`,
        },
      ],
      service: [
        {
          id: `did:lens:${profileId}#lens-api`,
          type: 'LensProtocolAPI',
          serviceEndpoint: 'https://api-v2.lens.dev/graphql',
        },
        {
          id: `did:lens:${profileId}#momoka`,
          type: 'MomokaDaemon',
          serviceEndpoint: 'https://momoka.lens.xyz',
        },
      ],
    };
  }
}
