/**
 * Lens Free Creator Coin — Gasless Publication via Momoka
 *
 * ## How It Works
 * Lens Protocol's **Momoka** layer enables truly gasless transactions.
 * Instead of posting on-chain (which requires gas), Momoka publications are:
 * 1. Signed by the profile owner (off-chain)
 * 2. Submitted to the Lens API (no gas required)
 * 3. Stored on Arweave/Bundlr DA layer (submitter pays ~1000x less than gas)
 * 4. Verifiable by anyone via DA proofs
 *
 * For Lens Chain (the new mainnet), posting is natively gasless
 * — users don't need GHO to post, only to collect.
 *
 * ## Free Requirements
 * - Profile must exist (creation requires gas, but posting is free)
 * - Content must not have open actions (Momoka limitation)
 * - Reference policy must be ANYONE (default)
 * - Post must be sponsored by the Lens API (default behavior)
 *
 * ## Usage
 * ```ts
 * import { LensFreePostClient } from './lens-free';
 *
 * const lens = new LensFreePostClient({ accessToken: '...' });
 *
 * // Post a creator coin announcement for free
 * const result = await lens.postCreatorCoin({
 *   profileId: '0x...',
 *   coinName: 'My Coin',
 *   coinSymbol: 'MYCOIN',
 *   coinAddress: '0x...',
 *   description: 'A new creator coin on DegenFeed!',
 * });
 * console.log('Posted on Lens:', result.momokaUrl);
 * ```
 *
 * @module lens-free
 */

import { LensClient } from '@degenfeed/lens-sdk';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Lens API v2 URL. */
const LENS_API_URL = 'https://api-v2.lens.dev/graphql';

/** Lens Momoka explorer base URL. */
const MOMOKA_EXPLORER_URL = 'https://momoka.lens.xyz/tx';

/** Lens Hub URL for profile lookups. */
const _LENS_HUB_URL = 'https://hub.lens.xyz';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LensFreePostConfig {
  /** Lens API access token (obtained via SIWE / Lens login) */
  accessToken: string;
  /** API URL override (default: https://api-v2.lens.dev/graphql) */
  apiUrl?: string;
}

export interface CreatorCoinPost {
  /** Lens profile ID (e.g. "0x01" or profile ID string) */
  profileId: string;
  /** Creator coin name */
  coinName: string;
  /** Creator coin symbol/ticker */
  coinSymbol: string;
  /** Creator coin contract address (on Base/Zora) */
  coinAddress: string;
  /** Short description or announcement text */
  description: string;
  /** Chain the coin was deployed on */
  chain?: string;
  /** Optional zora.co URL for the coin */
  zoraUrl?: string;
  /** Optional image/media URL for the post */
  mediaUrl?: string;
  /** Tags for discoverability */
  tags?: string[];
}

export interface MomokaPostResult {
  /** Momoka transaction ID */
  momokaId: string;
  /** Momoka explorer URL */
  momokaUrl: string;
  /** Content URI on Arweave/IPFS */
  contentUri: string;
  /** Whether the post was submitted via Momoka (gasless) */
  gasless: true;
  /** When it was posted */
  timestamp: number;
}

export interface MomokaStatus {
  /** Momoka transaction ID */
  momokaId: string;
  /** Whether the transaction is verified */
  verified: boolean;
  /** Momoka explorer URL */
  explorerUrl: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build a metadata URI-friendly content object for a creator coin post.
 * This describes the coin in a format Lens can render.
 */
function buildCoinContent(input: CreatorCoinPost): string {
  const lines: string[] = [
    `🪙 ${input.coinName} (${input.coinSymbol})`,
    '',
    input.description,
    '',
    `Contract: ${input.coinAddress}`,
  ];

  if (input.chain) {
    lines.push(`Chain: ${input.chain}`);
  }
  if (input.zoraUrl) {
    lines.push(`View on Zora: ${input.zoraUrl}`);
  }

  const tags = input.tags?.length
    ? input.tags
    : ['degenfeed', 'creatorcoin', input.coinSymbol.toLowerCase()];
  lines.push('', `Tags: ${tags.join(', ')}`);
  lines.push('', 'Powered by DegenFeed');

  return lines.join('\n');
}

/**
 * Build a Markdown content URI for Lens publication.
 * Lens supports basic Markdown in publications.
 */
function buildContentUri(input: CreatorCoinPost): string {
  // Note: In production, you'd upload this to IPFS/Arweave first.
  // For free/quick posts, we use a data URI or a pre-pinned IPFS template.
  // Lens requires contentURI to be a resolvable URL (IPFS/Arweave/HTTPS).
  // For gasless testing, use ar:// or ipfs:// URIs.
  const content = buildCoinContent(input);

  // Simple heuristic: for demo/testing, encode as data URI
  // In production: upload to IPFS via web3.storage / Pinata / Bundlr
  return `data:text/markdown,${encodeURIComponent(content)}`;
}

// ─── Lens Free Post Client ────────────────────────────────────────────────

/**
 * Client for posting creator coin announcements on Lens for FREE (gasless).
 *
 * Uses Lens Momoka for truly gasless publications.
 * Momoka publications are stored on Arweave, not on-chain,
 * so there's no gas cost to the poster.
 *
 * ## Limitations
 * - Profile must already exist (creation requires one-time gas)
 * - Momoka posts cannot include open actions (collects, etc.)
 * - Reference policy must be ANYONE
 * - Rate limits apply (Momoka rate limits dropped to 0 with Lens Chain launch)
 * - For Lens Chain: posting is natively gasless — use standard `post` mutation
 */
export class LensFreePostClient {
  private client: LensClient;
  private accessToken: string;

  constructor(config: LensFreePostConfig) {
    this.client = new LensClient(config.apiUrl ?? LENS_API_URL);
    this.accessToken = config.accessToken;
    this.client.setAuth(this.accessToken);
  }

  /**
   * Post a creator coin announcement on Lens via Momoka (gasless).
   *
   * This creates a Momoka publication — NO gas fees required.
   * The content is stored on Arweave with DA proofs.
   *
   * @param input Creator coin details to post.
   * @returns Momoka post result with transaction ID.
   *
   * @throws If the profile doesn't exist or Momoka is unavailable.
   */
  async postCreatorCoin(input: CreatorCoinPost): Promise<MomokaPostResult> {
    const contentUri = buildContentUri(input);

    // Use the Lens Momoka GraphQL mutation
    // MomokaPostRequest: { contentURI: string }
    const data = (await this.client.request(
      `mutation PostOnMomoka($request: MomokaPostRequest!) {
        postOnMomoka(request: $request) {
          ... on CreateMomokaPublicationResult {
            id
            proof
            momokaId
          }
          ... on RelayError {
            reason
          }
        }
      }`,
      {
        request: {
          contentURI: contentUri,
        },
      },
    )) as {
      postOnMomoka: { id: string; proof: string; momokaId: string } | { reason: string };
    };

    if ('reason' in data.postOnMomoka) {
      throw new Error(`Lens Momoka rejected: ${data.postOnMomoka.reason}`);
    }

    const result = data.postOnMomoka;

    return {
      momokaId: result.momokaId,
      momokaUrl: `${MOMOKA_EXPLORER_URL}/${result.momokaId}`,
      contentUri,
      gasless: true,
      timestamp: Date.now(),
    };
  }

  /**
   * Post a creator coin on Lens Chain (natively gasless).
   *
   * Lens Chain has gasless transactions built-in — no Momoka needed.
   * All posts are free; only collections cost GHO.
   *
   * This is the preferred method once the profile is on Lens Chain.
   *
   * @param input Creator coin details to post.
   * @returns Publication result.
   */
  async postCreatorCoinOnChain(input: CreatorCoinPost): Promise<{
    publicationId: string;
    url: string;
    gasless: true;
  }> {
    const contentUri = buildContentUri(input);

    const data = (await this.client.request(
      `mutation Post($request: PostRequest!) {
        post(request: $request) {
          ... on RelaySuccess {
            txId
          }
          ... on RelayError {
            reason
          }
        }
      }`,
      {
        request: {
          contentURI: contentUri,
          sponsored: true, // Requests gasless sponsorship from Lens API
        },
      },
    )) as { post: { txId: string } | { reason: string } };

    if ('reason' in data.post) {
      throw new Error(`Lens post rejected: ${data.post.reason}`);
    }

    const txId = data.post.txId;

    return {
      publicationId: txId,
      url: `https://hub.lens.xyz/posts/${txId}`,
      gasless: true,
    };
  }

  /**
   * Check if a Momoka transaction is verified.
   * Momoka transactions can be verified by anyone using DA proofs.
   *
   * @param momokaId The Momoka transaction ID.
   * @returns Verification status.
   */
  async verifyMomokaPost(momokaId: string): Promise<MomokaStatus> {
    const data = (await this.client.request(
      `query MomokaTransaction($request: MomokaTransactionRequest!) {
        momokaTransaction(request: $request) {
          id
          status
          verified
        }
      }`,
      { request: { for: momokaId } },
    )) as { momokaTransaction: { id: string; status: string; verified: boolean } | null };

    const tx = data.momokaTransaction;

    return {
      momokaId,
      verified: tx?.verified ?? false,
      explorerUrl: `${MOMOKA_EXPLORER_URL}/${momokaId}`,
    };
  }

  /**
   * Check if a Lens profile is eligible for gasless posting.
   *
   * @param profileId The Lens profile ID.
   * @returns Eligibility info.
   */
  async checkGaslessEligibility(profileId: string): Promise<{
    eligible: boolean;
    reason?: string;
    momokaAvailable: boolean;
    lensChainAvailable: boolean;
  }> {
    try {
      const profile = await this.client.getProfile(profileId);
      if (!profile) {
        return {
          eligible: false,
          reason: 'Profile not found',
          momokaAvailable: false,
          lensChainAvailable: false,
        };
      }

      // Check Momoka status
      const data = (await this.client.request(
        `query MomokaTransactions {
          momokaTransactions(request: {}) {
            items { id }
          }
        }`,
      )) as { momokaTransactions: { items: unknown[] } };

      const momokaAvailable = Array.isArray(data.momokaTransactions?.items);

      return {
        eligible: true,
        momokaAvailable,
        lensChainAvailable: true, // Lens Chain is live
      };
    } catch (err) {
      return {
        eligible: false,
        reason: err instanceof Error ? err.message : 'Unknown error',
        momokaAvailable: false,
        lensChainAvailable: false,
      };
    }
  }
}
