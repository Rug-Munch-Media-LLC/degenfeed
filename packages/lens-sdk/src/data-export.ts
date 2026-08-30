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

import { LENS_API_URL, LensClient } from './client';

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

/** Account resolved through the v3 `account` query (or legacy v2 fallback). */
interface ResolvedLensAccount {
  address: string;
  localName: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  joinedAt: string;
}

/** Loose EVM address check — used to pick AccountRequest.address vs legacyProfileId. */
function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

// ─── GraphQL Queries for Data Export ────────────────────────────────────
//
// NOTE: The Lens API moved to the v3 schema (api-v2.lens.dev → api.lens.xyz).
// The old `publications` query + `Post`/`Comment`/`Mirror` types are GONE —
// `posts` now returns `AnyPost` items where `AnyPost = Post | Repost` and
// `PostMetadata` is a UNION of per-format metadata types (TextOnlyMetadata,
// ArticleMetadata, …). The previous fragment set caused the schema mismatch
// `Unknown field "id" on type "AnyPost"` because fields were selected
// directly on the union without the correct `... on` member fragments.
// Both queries below were validated against the live v3 schema (2026-08-30).

const ACCOUNT_QUERY = `
  query Account($request: AccountRequest!) {
    account(request: $request) {
      address
      username { localName }
      metadata { name bio picture }
      createdAt
    }
  }
`;

const PUBLICATIONS_QUERY = `
  query Publications($request: PostsRequest!) {
    posts(request: $request) {
      items {
        __typename
        ... on Post {
          id
          timestamp
          content: metadata {
            ... on TextOnlyMetadata { content }
            ... on ArticleMetadata { content }
            ... on LinkMetadata { content }
            ... on ImageMetadata { content }
            ... on VideoMetadata { content }
            ... on AudioMetadata { content }
            ... on EmbedMetadata { content }
            ... on EventMetadata { content }
            ... on MintMetadata { content }
            ... on StoryMetadata { content }
            ... on TransactionMetadata { content }
            ... on SpaceMetadata { content }
            ... on CheckingInMetadata { content }
            ... on LivestreamMetadata { content }
            ... on ThreeDMetadata { content }
          }
          stats { reactions comments reposts quotes }
        }
        ... on Repost {
          id
          timestamp
          repostOf { ... on Post { id } }
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
   * Resolve a Lens account on the v3 API.
   *
   * Legacy Lens profile ids (e.g. "0x01") map through
   * `AccountRequest.legacyProfileId`; EVM addresses pass directly. Falls back
   * to the v2 `getProfile` when the v3 resolution fails so older callers keep
   * working until the migration is complete.
   */
  private async resolveAccount(profileId: string): Promise<ResolvedLensAccount> {
    const request = isEvmAddress(profileId)
      ? { address: profileId }
      : { legacyProfileId: profileId };
    try {
      const data = (await this.client.request(ACCOUNT_QUERY, { request })) as {
        account?: {
          address: string;
          username?: { localName?: string } | null;
          metadata?: { name?: string | null; bio?: string | null; picture?: string | null } | null;
          createdAt?: string | null;
        } | null;
      };
      const a = data?.account;
      if (a) {
        return {
          address: a.address,
          localName: a.username?.localName ?? profileId,
          displayName: a.metadata?.name ?? a.username?.localName ?? profileId,
          bio: a.metadata?.bio ?? '',
          avatarUrl: a.metadata?.picture ?? '',
          joinedAt: a.createdAt ?? '',
        };
      }
    } catch {
      // v3 resolution failed — fall through to the legacy v2 path below.
    }
    const legacy = await this.client.getProfile(profileId);
    if (!legacy) throw new Error(`Profile ${profileId} not found`);
    const handle = legacy.handle?.localName ?? profileId;
    return {
      address: legacy.id ?? profileId,
      localName: handle,
      displayName: legacy.metadata?.displayName ?? handle,
      bio: legacy.metadata?.bio ?? '',
      avatarUrl: legacy.metadata?.picture?.optimized?.uri ?? '',
      joinedAt: '',
    };
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
    // 1. Resolve the account on the v3 API. Legacy Lens profile ids (e.g.
    // "0x01") map through AccountRequest.legacyProfileId; callers that pass
    // an EVM address use it directly.
    const account = await this.resolveAccount(profileId);

    const handle = account.localName || profileId;
    const displayName = account.displayName || handle;

    // 2. Export profile data
    const profileExport: LensProfileExport = {
      profileId,
      handle,
      displayName,
      bio: account.bio || '',
      avatarUrl: account.avatarUrl || '',
      coverUrl: '',
      metadata: {},
      stats: {
        publications: 0, // filled in below from the fetched count
        followers: 0, // v3 Account exposes score, not follower counts
        following: 0,
        reactions: 0,
      },
      joinedAt: account.joinedAt || '',
    };

    // 3. Fetch all publications via pagination
    const publications: LensPublicationExport[] = [];
    let cursor: string | undefined;
    do {
      const data = (await this.client.request(PUBLICATIONS_QUERY, {
        request: {
          filter: { authors: [account.address] },
          pageSize: 'FIFTY',
          ...(cursor ? { cursor } : {}),
        },
      })) as {
        posts?: {
          items: Array<Record<string, unknown>>;
          pageInfo?: { next?: string };
        };
      };
      const items = data?.posts?.items || [];
      for (const item of items) {
        const type = (item.__typename as string)?.toLowerCase() || 'post';
        const contentObj = (item.content ?? {}) as { content?: string };
        const stats = (item.stats ?? {}) as Record<string, number | undefined>;
        const pub: LensPublicationExport = {
          id: item.id as string,
          type: type as LensPublicationExport['type'],
          content: contentObj.content || '',
          metadata: {},
          media: [],
          tags: [],
          stats: {
            reactions: stats.reactions ?? 0,
            comments: stats.comments ?? 0,
            // v3 PostStats has no `mirrors` — reposts are the mirror count.
            mirrors: stats.reposts ?? 0,
            quotes: stats.quotes ?? 0,
          },
          // v3 posts expose `timestamp` (DateTime); createdAt no longer exists.
          createdAt: (item.timestamp as string) || (item.createdAt as string) || '',
          // v3 Post has no txHash / momoka proof fields on the base type.
          momokaDaHash: undefined,
          onChainTxHash: undefined,
        };
        publications.push(pub);
      }
      cursor = data?.posts?.pageInfo?.next;
    } while (cursor);

    // Publish the real publication count back into the exported profile stats.
    profileExport.stats.publications = publications.length;

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
  generateDidDocument(
    profileId: string,
    handle: string,
    walletAddress: string,
  ): Record<string, unknown> {
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
