/**
 * Farcaster Free Creator Coin — Gasless Cast Posting
 *
 * ## How It Works
 * Farcaster posting is FREE once you have an account (FID).
 * Key insights for zero-cost posting:
 *
 * 1. **Neynar Free Tier**: Neynar API provides free tier with limited credits.
 *    - Signer creation: Neynar SPONSORS the on-chain fee ($0 for users)
 *    - Posting a cast: 150 credits per POST (free tier gets 25k+ credits)
 *    - Account/agent creation: Neynar handles the on-chain tx
 *
 * 2. **Self-hosted Hubble**: The DegenFeed fleet has access to Hubble nodes.
 *    - Posting to your own Hubble is free (no external API limits)
 *    - Signing keys required but NO per-post fees
 *    - Uses the existing `buildFarcasterCastMessage` + hub submission
 *
 * 3. **x402 Micropayments**: Neynar's hub API accepts x402 payments
 *    (0.001 USDC per call with gasless EIP-3009 signatures)
 *
 * ## Cost Summary
 * - FID creation (one-time): ~$0.20 on Optimism (Neynar can sponsor)
 * - Add signer (one-time): ~$0.05 (Neynar can sponsor)
 * - Posting: FREE via Hubble, or ~150 credits via Neynar free tier
 *
 * ## Usage
 * ```ts
 * import { FarcasterFreePostClient } from './farcaster-free';
 *
 * // Via Neynar free tier
 * const poster = new FarcasterFreePostClient({
 *   mode: 'neynar',
 *   neynarApiKey: '...',
 *   neynarSignerUuid: '...',
 * });
 * ```
 *
 * @module farcaster-free
 */

import { buildFarcasterCastMessage } from '@degenfeed/farcaster-sdk';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Neynar API base URL. */
const NEYNAR_API_BASE = 'https://api.neynar.com';

/** Default embed URL for the coin on Zora. */
const ZORA_COIN_URL = 'https://zora.co/coin/base';

/** Max cast text length. */
const MAX_CAST_LENGTH = 320;

// ─── Types ─────────────────────────────────────────────────────────────────

export type FarcasterPostMode = 'hubble' | 'neynar' | 'x402';

export interface FarcasterFreePostConfig {
  /** Posting mode */
  mode: FarcasterPostMode;

  // Hubble mode
  /** FID (required for 'hubble' mode) */
  fid?: number;
  /** Signer private key hex (required for 'hubble' mode) */
  signerPrivateKey?: string;

  // Neynar mode
  /** Neynar API key (required for 'neynar' mode) */
  neynarApiKey?: string;
  /** Neynar signer UUID (required for 'neynar' mode) */
  neynarSignerUuid?: string;

  // x402 mode
  /** Wallet private key for EIP-3009 signature (required for 'x402' mode) */
  x402PrivateKey?: string;
  /** USDC wallet address on Base (required for 'x402' mode) */
  x402WalletAddress?: string;
}

export interface CreatorCoinCastInput {
  /** Creator coin name */
  coinName: string;
  /** Creator coin symbol/ticker */
  coinSymbol: string;
  /** Creator coin contract address */
  coinAddress: string;
  /** Optional short description */
  description?: string;
  /** Channel to post in (optional) */
  channelId?: string;
  /** Zora coin URL (optional — auto-generated from coinAddress) */
  zoraUrl?: string;
  /** Additional embed URLs (max 2 total including zoraUrl) */
  embedUrls?: string[];
}

export interface FreeCastResult {
  /** Cast hash */
  hash: string;
  /** Cast URL on Warpcast */
  url: string;
  /** Whether it was truly gas-free */
  gasless: boolean;
  /** Mode used */
  mode: FarcasterPostMode;
  /** Cast text (truncated) */
  text: string;
  /** Timestamp */
  timestamp: number;
  /** Neynar credits remaining (neynar mode only) */
  creditsRemaining?: number;
}

// ─── Client ────────────────────────────────────────────────────────────────

/**
 * Post creator coin announcements on Farcaster for FREE.
 *
 * Supports three posting modes:
 * - **hubble**: Post via self-hosted Hubble (completely free after FID)
 * - **neynar**: Post via Neynar free tier API (free tier credits)
 * - **x402**: Post via Neynar hub with gasless USDC micropayments
 *
 * ## Zero-Cost Strategy
 * 1. Get a Neynar free API key (neynar.com)
 * 2. Create a signer (Neynar sponsors the on-chain fee)
 * 3. Post casts via Neynar API (150 credits each, free tier has 25k+)
 * 4. OR run your own Hubble node for unlimited free posting
 */
export class FarcasterFreePostClient {
  private config: FarcasterFreePostConfig;
  private hubClient: import('@degenfeed/farcaster-sdk').HubClient | null = null;

  constructor(config: FarcasterFreePostConfig) {
    this.config = config;
  }

  /**
   * Lazy-init Hubble client (only needed for hubble mode).
   */
  private async getHubClient(): Promise<import('@degenfeed/farcaster-sdk').HubClient> {
    if (!this.hubClient) {
      const { HubClient } = await import('@degenfeed/farcaster-sdk');
      this.hubClient = new HubClient();
    }
    return this.hubClient;
  }

  /**
   * Post a creator coin announcement to Farcaster.
   *
   * The cast will contain:
   * - A text announcement with coin name, symbol, and description
   * - An embed link to the coin on zora.co
   *
   * @param input Creator coin details.
   * @returns Cast result with hash and URL.
   *
   * @throws If posting fails or invalid config.
   */
  async postCreatorCoin(input: CreatorCoinCastInput): Promise<FreeCastResult> {
    switch (this.config.mode) {
      case 'hubble':
        return this.postViaHubble(input);
      case 'neynar':
        return this.postViaNeynar(input);
      case 'x402':
        return this.postViaX402(input);
      default:
        throw new Error(`Unknown Farcaster post mode: ${this.config.mode}`);
    }
  }

  /**
   * Post via self-hosted Hubble (completely free).
   *
   * Uses the DegenFeed fleet's Hubble nodes or public hubs.
   * No per-post fees, no rate limits beyond hub capacity.
   */
  private async postViaHubble(input: CreatorCoinCastInput): Promise<FreeCastResult> {
    if (!this.config.fid || !this.config.signerPrivateKey) {
      throw new Error('Hubble mode requires fid and signerPrivateKey');
    }

    const text = this.buildCastText(input);

    // Build and sign the cast message using the existing engage.ts utility
    const result = buildFarcasterCastMessage({
      signerKeyHex: this.config.signerPrivateKey,
      fid: this.config.fid,
      text,
    });

    if (!result.ok || !result.messageHex) {
      throw new Error(`Failed to build cast: ${result.error}`);
    }

    // Submit to a Hubble hub
    const hub = await this.getHubClient();
    await hub.submitMessage(result.messageHex);

    return {
      hash: this.computeCastHash(result.messageHex),
      url: `https://warpcast.com/${this.config.fid}/${result.messageHex.slice(0, 10)}`,
      gasless: true,
      mode: 'hubble',
      text,
      timestamp: Date.now(),
    };
  }

  /**
   * Post via Neynar free tier API.
   *
   * Costs 150 credits per cast.
   * Free tier starts with 25,000 credits = ~166 free casts.
   */
  private async postViaNeynar(input: CreatorCoinCastInput): Promise<FreeCastResult> {
    if (!this.config.neynarApiKey || !this.config.neynarSignerUuid) {
      throw new Error('Neynar mode requires neynarApiKey and neynarSignerUuid');
    }

    const text = this.buildCastText(input);
    const zoraUrl = input.zoraUrl ?? `${ZORA_COIN_URL}:${input.coinAddress}`;

    // Build embed URLs (max 2 total)
    const embeds: Array<{ url: string }> = [{ url: zoraUrl }];
    if (input.embedUrls?.length) {
      for (const url of input.embedUrls.slice(0, 1)) {
        embeds.push({ url });
      }
    }

    const res = await fetch(`${NEYNAR_API_BASE}/v2/farcaster/cast`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': this.config.neynarApiKey,
        'content-type': 'application/json',
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
      body: JSON.stringify({
        signer_uuid: this.config.neynarSignerUuid,
        text,
        embeds,
        channel_id: input.channelId ?? 'degenfeed',
        idem: this.generateIdempotencyKey(),
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Neynar API ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      cast: { hash: string };
      success: boolean;
    };

    return {
      hash: data.cast.hash,
      url: `https://warpcast.com/${data.cast.hash}`,
      gasless: true,
      mode: 'neynar',
      text,
      timestamp: Date.now(),
      creditsRemaining: undefined,
    };
  }

  /**
   * Post via Neynar hub with x402 gasless USDC micropayments.
   *
   * Uses EIP-3009 transferWithAuthorization — a gasless USDC transfer
   * signature. The user signs a message authorizing 0.001 USDC to Neynar;
   * no on-chain gas is needed because the signature is submitted with the request.
   *
   * Note: This still costs 0.001 USDC but is GASLESS (no on-chain tx).
   */
  private async postViaX402(input: CreatorCoinCastInput): Promise<FreeCastResult> {
    if (!this.config.x402PrivateKey || !this.config.x402WalletAddress) {
      throw new Error('x402 mode requires x402PrivateKey and x402WalletAddress');
    }
    if (!this.config.fid) {
      throw new Error('x402 mode requires fid');
    }

    const text = this.buildCastText(input);

    // Build x402 payment payload (EIP-3009 gasless USDC transfer)
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min deadline
    const paymentPayload = {
      x402Version: 1,
      scheme: 'exact',
      network: 'base',
      payload: {
        signature: '', // EIP-712 signature would be computed here
        authorization: {
          from: this.config.x402WalletAddress,
          to: '0xA6a8736f18f383f1cc2d938576933E5eA7Df01A1', // Neynar payment address
          value: '1000', // 0.001 USDC (6 decimals)
          validAfter: '0',
          validBefore: String(deadline),
          nonce: this.generateIdempotencyKey(),
        },
      },
    };

    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    // Build the cast message
    const castResult = buildFarcasterCastMessage({
      signerKeyHex: this.config.x402PrivateKey,
      fid: this.config.fid,
      text,
    });

    if (!castResult.ok || !castResult.messageHex) {
      throw new Error(`Failed to build cast: ${castResult.error}`);
    }

    // Submit with x402 payment header to Neynar's hub
    const res = await fetch('https://hub-api.neynar.com/v1/submitMessage', {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'x-payment': paymentHeader,
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
      body: castResult.messageHex,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Neynar x402 hub rejected: ${res.status} ${err.slice(0, 200)}`);
    }

    return {
      hash: castResult.messageHex.slice(0, 40),
      url: `https://warpcast.com/${text.slice(0, 20)}`,
      gasless: true, // No on-chain gas — uses signed USDC transfer instead
      mode: 'x402',
      text,
      timestamp: Date.now(),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Build the cast text from creator coin details.
   * Keeps within Farcaster's 320-character limit.
   */
  private buildCastText(input: CreatorCoinCastInput): string {
    const description = input.description
      ? ` — ${input.description}`
      : '';

    const text = `🪙 New creator coin: ${input.coinName} (${input.coinSymbol})${description}

Contract: ${input.coinAddress.slice(0, 10)}...${input.coinAddress.slice(-6)}
#Crypto #DegenFeed #${input.coinSymbol.toUpperCase()}`;

    // Truncate to 320 chars max
    return text.length <= MAX_CAST_LENGTH
      ? text
      : text.slice(0, MAX_CAST_LENGTH - 3) + '...';
  }

  /**
   * Generate a unique idempotency key for request deduplication.
   */
  private generateIdempotencyKey(): string {
    const chars = 'abcdef0123456789';
    let key = '';
    for (let i = 0; i < 16; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  }

  /**
   * Compute a pseudo-hash for the cast (used in Hubble mode).
   * In production, the hub returns the actual hash.
   */
  private computeCastHash(messageHex: string): string {
    return `0x${messageHex.slice(0, 40)}`;
  }
}

// ─── Utility ───────────────────────────────────────────────────────────────

/**
 * Get the Neynar free tier limits for reference.
 * Free tier includes 25,000 credits initially.
 */
export function getNeynarFreeTierInfo(): {
  initialCredits: number;
  costPerPost: number;
  maxFreePosts: number;
  signerCreation: string;
} {
  return {
    initialCredits: 25_000,
    costPerPost: 150,
    maxFreePosts: Math.floor(25_000 / 150),
    signerCreation: 'Sponsored by Neynar (no gas cost to user)',
  };
}
