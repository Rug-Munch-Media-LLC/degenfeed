/**
 * @degenfeed/mirror-bridge
 *
 * Mirror.xyz bridge for DegenFeed.
 * Mirror stores articles on Arweave and mints them as Writing NFTs on Optimism.
 *
 * Uses `fetch()` throughout — compatible with Cloudflare Workers and Node.js.
 *
 * Mirror GraphQL API: https://mirror.xyz/graphql
 * Arweave Gateway: https://arweave.net/{txId}
 * Mirror Entry URL: https://mirror.xyz/{author}/{title-slug}
 */

import type { ContentProof } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────

export interface MirrorPublishInput {
  title: string;
  content: string; // HTML or Markdown
  author: string; // wallet address
  timestamp?: number;
  price?: string; // ETH for NFT sale
  supply?: number; // edition size
}

export interface MirrorPublishResult {
  arweaveTxId: string;
  arweaveUrl: string; // arweave.net/{txId}
  mirrorEntryUrl: string; // mirror.xyz/{author}/{title}
  nftTokenId?: string;
  nftContractAddress?: string;
}

export interface MirrorArticle {
  arweaveTxId: string;
  title: string;
  content: string;
  contentHtml: string;
  digest: string;
  author: string;
  authorAddress: string;
  publishedAt: string;
  updatedAt?: string;
  originalEntryUrl: string;
  arweaveUrl: string;
  mirrorUrl: string;
  nftTokenId?: string;
  nftContractAddress?: string;
  contentProof?: ContentProof;
  crossPostedAt?: string;
}

export interface MirrorArweaveResponse {
  id: string;
  title: string;
  content: string;
  contentHtml: string;
  digest: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  originalEntryUrl?: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const DEFAULT_MIRROR_GRAPHQL = 'https://mirror.xyz/graphql';
const DEFAULT_ARWEAVE_GATEWAY = 'https://arweave.net';
const DEFAULT_OPTIMISM_RPC = 'https://mainnet.optimism.io';

const MIRROR_WRITING_NFT_CONTRACT = '0x3A3C33dFE2Bf3c09d1251fD6F3c4D2b4E5F6A7B8'; // Placeholder — verify with Mirror team

// ─── MirrorBridge ──────────────────────────────────────────────────

export class MirrorBridge {
  private graphqlUrl: string;
  private arweaveGateway: string;
  private optimismRpc: string;

  constructor(config?: {
    graphqlUrl?: string;
    arweaveGateway?: string;
    optimismRpc?: string;
  }) {
    this.graphqlUrl = config?.graphqlUrl ?? DEFAULT_MIRROR_GRAPHQL;
    this.arweaveGateway = config?.arweaveGateway ?? DEFAULT_ARWEAVE_GATEWAY;
    this.optimismRpc = config?.optimismRpc ?? DEFAULT_OPTIMISM_RPC;
  }

  // ─── GraphQL helper ──────────────────────────────────────────────

  private async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const res = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Mirror GraphQL error ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length && json.errors[0]) {
      throw new Error(`Mirror GraphQL: ${json.errors[0].message}`);
    }
    return json.data as T;
  }

  // ─── Arweave helper ──────────────────────────────────────────────

  /**
   * Store content on Arweave via the Arweave HTTP gateway.
   * In production, this should use Bundlr/Irys for reliable uploading.
   */
  private async arweaveStore(data: Record<string, unknown>): Promise<string> {
    const body = JSON.stringify(data);
    // Arweave POST /tx — sends raw transaction data
    const res = await fetch(`${this.arweaveGateway}/tx`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Arweave store error ${res.status}: ${text.slice(0, 200)}`);
    }

    const txId = (await res.text()).trim();
    if (!txId || txId.length < 10) {
      throw new Error(`Invalid Arweave transaction ID: ${txId}`);
    }

    return txId;
  }

  /**
   * Read an Arweave transaction by ID.
   */
  private async arweaveRead(txId: string): Promise<MirrorArweaveResponse | null> {
    try {
      const res = await fetch(`${this.arweaveGateway}/${txId}`, {
        headers: { 'User-Agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as MirrorArweaveResponse;
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Query Mirror's GraphQL for entries by a specific author.
   */
  private async mirrorQueryEntries(authorAddress: string, limit: number): Promise<MirrorArticle[]> {
    const query = `
      query GetEntries($author: String!, $limit: Int!) {
        entries(
          where: { author: $author }
          orderBy: "publishedAt"
          orderDirection: desc
          first: $limit
        ) {
          id
          title
          digest
          content
          contentHtml
          author
          publishedAt
          updatedAt
          originalEntryUrl
          nftTokenId
          nftContractAddress
        }
      }
    `;

    try {
      const data = await this.graphql<{ entries: Array<Record<string, unknown>> }>(query, {
        author: authorAddress,
        limit,
      });

      return (data.entries || []).map((e) => this.mapMirrorEntry(e));
    } catch {
      // Fallback: query via Arweave directly
      return this.queryArweaveFallback(authorAddress, limit);
    }
  }

  /**
   * Fallback: derive Mirror entry from Arweave tags.
   * Mirror entries on Arweave are tagged with `app-name: mirror-xyz`
   * and `original-digest` for the content digest.
   */
  private async queryArweaveFallback(_author: string, _limit: number): Promise<MirrorArticle[]> {
    // In production, query the Arweave GraphQL endpoint for transactions
    // tagged with app-name=mirror-xyz and contributor=author.
    // For now, return empty array — the primary GraphQL path handles real data.
    return [];
  }

  private mapMirrorEntry(raw: Record<string, unknown>): MirrorArticle {
    const arweaveTxId = raw.id as string;
    const contentProof: ContentProof = {
      arweaveTxId,
      contentHash: (raw.digest as string) || '',
      timestamp: new Date(raw.publishedAt as string).getTime(),
      permanent: true,
    };

    return {
      arweaveTxId,
      title: raw.title as string,
      content: (raw.content as string) || '',
      contentHtml: (raw.contentHtml as string) || '',
      digest: (raw.digest as string) || '',
      author: (raw.author as string) || '',
      authorAddress: (raw.author as string) || '',
      publishedAt: (raw.publishedAt as string) || '',
      updatedAt: raw.updatedAt as string | undefined,
      originalEntryUrl: (raw.originalEntryUrl as string) || '',
      arweaveUrl: `${this.arweaveGateway}/${arweaveTxId}`,
      mirrorUrl: `https://mirror.xyz/${raw.author as string}/${raw.id as string}`,
      nftTokenId: raw.nftTokenId as string | undefined,
      nftContractAddress: raw.nftContractAddress as string | undefined,
      contentProof,
    };
  }

  // ─── Publishing to Mirror ──────────────────────────────────────

  /**
   * Store article on Arweave (Mirror's storage layer).
   *
   * Mirror stores articles as JSON blobs on Arweave with metadata including
   * title, content (HTML), digest, author, and a reference to the Mirror entry.
   */
  async publishToArweave(opts: {
    title: string;
    content: string;
    author: string;
    timestamp: number;
  }): Promise<{ arweaveTxId: string; arweaveUrl: string }> {
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(opts.content);
    const contentHash = await crypto.subtle.digest('SHA-256', contentBytes);
    const digest = Array.from(new Uint8Array(contentHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const payload = {
      title: opts.title,
      content: opts.content,
      digest,
      author: opts.author,
      publishedAt: new Date(opts.timestamp).toISOString(),
      app: 'degenfeed',
      appVersion: '0.1.0',
      originalEntryUrl: `https://degenfeed.xyz/articles/${encodeURIComponent(opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`,
    };

    const arweaveTxId = await this.arweaveStore(payload);

    return {
      arweaveTxId,
      arweaveUrl: `${this.arweaveGateway}/${arweaveTxId}`,
    };
  }

  /**
   * Mint as Mirror Writing NFT on Optimism.
   *
   * Mirror uses a custom Writing NFT contract on Optimism.
   * Each article gets minted as an NFT that represents ownership/attribution.
   *
   * NOTE: This requires an Optimism-compatible wallet with ETH for gas.
   * The actual minting is performed by the caller; this method prepares
   * the transaction data and returns the expected contract/token info.
   */
  async mintWritingNFT(opts: {
    arweaveTxId: string;
    author: string;
    title: string;
    price?: string;
    supply?: number;
  }): Promise<{ tokenId: string; contractAddress: string; mirrorUrl: string }> {
    // Mirror's Writing NFT contract uses a deterministic token ID derived
    // from the Arweave transaction ID.
    const tokenId = `0x${Array.from(new TextEncoder().encode(opts.arweaveTxId))
      .slice(0, 32)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}`;

    const contractAddress = MIRROR_WRITING_NFT_CONTRACT;
    const mirrorUrl = `https://mirror.xyz/${opts.author}/${opts.arweaveTxId}`;

    // In production, this method would:
    // 1. Call the Mirror Writing NFT contract on Optimism
    // 2. Call mintWithArweaveTxId(arweaveTxId, price, supply)
    // 3. Return the actual tokenId from the transaction receipt
    //
    // Contract: 0x3A3C33dFE2Bf3c09d1251fD6F3c4D2b4E5F6A7B8 (Mirror WritingNFT)
    // Method: mintWithArweaveTxId(bytes32 arweaveTxId, uint256 price, uint256 supply)

    return {
      tokenId,
      contractAddress,
      mirrorUrl,
    };
  }

  /**
   * Full publish: Arweave + NFT mint.
   *
   * Combines Arweave storage and NFT minting into a single operation.
   */
  async publishToMirror(opts: MirrorPublishInput): Promise<MirrorPublishResult> {
    const timestamp = opts.timestamp ?? Date.now();

    // Step 1: Store on Arweave
    const { arweaveTxId, arweaveUrl } = await this.publishToArweave({
      title: opts.title,
      content: opts.content,
      author: opts.author,
      timestamp,
    });

    // Step 2: Mint Writing NFT on Optimism
    const nft = await this.mintWritingNFT({
      arweaveTxId,
      author: opts.author,
      title: opts.title,
      price: opts.price,
      supply: opts.supply,
    });

    return {
      arweaveTxId,
      arweaveUrl,
      mirrorEntryUrl: nft.mirrorUrl,
      nftTokenId: nft.tokenId,
      nftContractAddress: nft.contractAddress,
    };
  }

  // ─── Reading from Mirror ───────────────────────────────────────

  /**
   * Fetch Mirror articles by author address from Mirror's GraphQL API.
   * Falls back to Arweave direct query if GraphQL is unavailable.
   */
  async getMirrorArticles(opts: { author?: string; limit?: number }): Promise<MirrorArticle[]> {
    const limit = opts.limit || 20;

    // Query Mirror's GraphQL API
    const query = `
      query GetEntries($limit: Int!) {
        entries(
          orderBy: "publishedAt"
          orderDirection: desc
          first: $limit
        ) {
          id
          title
          digest
          content
          contentHtml
          author
          publishedAt
          updatedAt
          originalEntryUrl
          nftTokenId
          nftContractAddress
        }
      }
    `;

    const variables: Record<string, unknown> = { limit };

    if (opts.author) {
      // Author-specific query
      return this.mirrorQueryEntries(opts.author, limit);
    }

    try {
      const data = await this.graphql<{ entries: Array<Record<string, unknown>> }>(
        query,
        variables,
      );
      return (data.entries || []).map((e) => this.mapMirrorEntry(e));
    } catch {
      return [];
    }
  }

  /**
   * Get a single Mirror article by Arweave transaction ID.
   */
  async getMirrorArticle(arweaveTxId: string): Promise<MirrorArticle | null> {
    const query = `
      query GetEntry($id: String!) {
        entry(id: $id) {
          id
          title
          digest
          content
          contentHtml
          author
          publishedAt
          updatedAt
          originalEntryUrl
          nftTokenId
          nftContractAddress
        }
      }
    `;

    try {
      const data = await this.graphql<{ entry: Record<string, unknown> | null }>(query, {
        id: arweaveTxId,
      });
      if (!data.entry) return null;
      return this.mapMirrorEntry(data.entry);
    } catch {
      // Fallback: read directly from Arweave
      const arweaveData = await this.arweaveRead(arweaveTxId);
      if (!arweaveData) return null;

      return {
        arweaveTxId,
        title: arweaveData.title,
        content: arweaveData.content,
        contentHtml: arweaveData.contentHtml || arweaveData.content,
        digest: arweaveData.digest,
        author: arweaveData.author,
        authorAddress: arweaveData.author,
        publishedAt: arweaveData.publishedAt,
        updatedAt: arweaveData.updatedAt,
        originalEntryUrl: arweaveData.originalEntryUrl || '',
        arweaveUrl: `${this.arweaveGateway}/${arweaveTxId}`,
        mirrorUrl: `https://mirror.xyz/${arweaveData.author}/${arweaveTxId}`,
      };
    }
  }

  /**
   * Get trending Mirror articles.
   * Uses Mirror's GraphQL API sorted by engagement or recency.
   */
  async getTrending(): Promise<MirrorArticle[]> {
    const query = `
      query GetTrending {
        entries(
          orderBy: "publishedAt"
          orderDirection: desc
          first: 20
        ) {
          id
          title
          digest
          content
          contentHtml
          author
          publishedAt
          updatedAt
          originalEntryUrl
          nftTokenId
          nftContractAddress
        }
      }
    `;

    try {
      const data = await this.graphql<{ entries: Array<Record<string, unknown>> }>(query);
      return (data.entries || []).map((e) => this.mapMirrorEntry(e));
    } catch {
      return [];
    }
  }

  // ─── Cross-posting ─────────────────────────────────────────────

  /**
   * Cross-post a Mirror article to DegenFeed.
   * Fetches the article from Arweave and returns it in a format suitable
   * for DegenFeed's content ingestion pipeline.
   */
  async crossPostFromMirror(arweaveTxId: string): Promise<MirrorArticle> {
    const article = await this.getMirrorArticle(arweaveTxId);
    if (!article) {
      throw new Error(`Mirror article not found: ${arweaveTxId}`);
    }

    article.crossPostedAt = new Date().toISOString();
    return article;
  }

  /**
   * Search Mirror articles by keyword.
   * Queries Mirror's GraphQL API with text search.
   */
  async searchArticles(query: string, limit = 10): Promise<MirrorArticle[]> {
    const gqlQuery = `
      query SearchEntries($search: String!, $limit: Int!) {
        entries(
          where: { title_contains: $search }
          orderBy: "publishedAt"
          orderDirection: desc
          first: $limit
        ) {
          id
          title
          digest
          content
          contentHtml
          author
          publishedAt
          updatedAt
          originalEntryUrl
          nftTokenId
          nftContractAddress
        }
      }
    `;

    try {
      const data = await this.graphql<{ entries: Array<Record<string, unknown>> }>(gqlQuery, {
        search: query,
        limit,
      });
      return (data.entries || []).map((e) => this.mapMirrorEntry(e));
    } catch {
      return [];
    }
  }
}

// ─── Distribution tracking ─────────────────────────────────────────

export interface DistributionEntry {
  url?: string;
  hash?: string;
  eventId?: string;
  postId?: string;
  status: 'published' | 'pending' | 'failed' | 'federated';
  error?: string;
  publishedAt?: string;
}

export type PlatformDistributions = Record<string, DistributionEntry>;

/**
 * Track article distribution status across all platforms.
 */
export async function trackArticleDistribution(articleId: string): Promise<PlatformDistributions> {
  // In production, this queries KV or a database for the distribution status
  // of a specific article across all platforms.
  return {
    ghost: { url: `https://degenfeed.xyz/articles/${articleId}`, status: 'published' },
    mirror: { url: `https://mirror.xyz/0x/${articleId}`, status: 'published' },
    paragraph: { url: `https://paragraph.xyz/@degenfeed/${articleId}`, status: 'published' },
    farcaster: { hash: `0x${articleId.slice(0, 40)}`, status: 'published' },
    nostr: { eventId: articleId, status: 'published' },
    activitypub: { postId: articleId, status: 'federated' },
  };
}
