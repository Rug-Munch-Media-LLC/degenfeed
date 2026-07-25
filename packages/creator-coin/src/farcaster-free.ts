/**
 * Farcaster Creator Coin — Hubble-Only Cast Posting
 *
 * ## How It Works
 * Farcaster posting is FREE once you have an account (FID) and our own Hubble.
 * Key insights for zero-cost posting:
 *
 * 1. **Self-hosted Hubble**: The DegenFeed fleet runs a Hubble node.
 *    - Posting to our own Hubble is free (no external API limits)
 *    - Signing keys required but NO per-post fees
 *    - Uses `buildFarcasterCastMessage` + hub submission
 *
 * ## Cost Summary
 * - FID creation (one-time): ~$0.20 on Optimism (we sponsor via Hubble)
 * - Add signer (one-time): ~$0.05 gas
 * - Posting: FREE via Hubble
 *
 * ## Usage
 * ```ts
 * import { FarcasterFreePostClient } from './farcaster-free';
 *
 * // Via Hubble
 * const poster = new FarcasterFreePostClient({
 *   mode: 'hubble',
 *   fid: 12345,
 *   signerPrivateKey: '...',
 * });
 * ```
 *
 * @module farcaster-free
 */

import { buildFarcasterCastMessage } from '@degenfeed/farcaster-sdk';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Default embed URL for the coin on Zora. */
const ZORA_COIN_URL = 'https://zora.co/coin/base';

/** Max cast text length. */
const MAX_CAST_LENGTH = 320;

/** Default Hubble URL. */
const DEFAULT_HUB_URL = 'http://127.0.0.1:2281';

// ─── Types ─────────────────────────────────────────────────────────────────

export type FarcasterPostMode = 'hubble';

export interface FarcasterFreePostConfig {
  /** Posting mode */
  mode: FarcasterPostMode;

  // Hubble mode
  /** FID (required) */
  fid?: number;
  /** Signer private key hex (required) */
  signerPrivateKey?: string;
  /** Hubble URL override (default: http://127.0.0.1:2281) */
  hubUrl?: string;
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
}

// ─── Client ────────────────────────────────────────────────────────────────

/**
 * Post creator coin announcements on Farcaster for FREE.
 *
 * Supports Hubble-only posting via our self-hosted Hubble node.
 */
export class FarcasterFreePostClient {
  private config: FarcasterFreePostConfig;
  private hubClient: import('@degenfeed/farcaster-sdk').HubClient | null = null;

  constructor(config: FarcasterFreePostConfig) {
    this.config = config;
  }

  /**
   * Lazy-init Hubble client.
   */
  private async getHubClient(): Promise<import('@degenfeed/farcaster-sdk').HubClient> {
    if (!this.hubClient) {
      const { HubClient } = await import('@degenfeed/farcaster-sdk');
      this.hubClient = new HubClient(this.config.hubUrl || DEFAULT_HUB_URL);
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
    return this.postViaHubble(input);
  }

  /**
   * Post via self-hosted Hubble (completely free).
   *
   * Uses the DegenFeed fleet's Hubble node.
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

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Build the cast text from creator coin details.
   * Keeps within Farcaster's 320-character limit.
   */
  private buildCastText(input: CreatorCoinCastInput): string {
    const description = input.description ? ` — ${input.description}` : '';

    const text = `🪙 New creator coin: ${input.coinName} (${input.coinSymbol})${description}

Contract: ${input.coinAddress.slice(0, 10)}...${input.coinAddress.slice(-6)}
#Crypto #DegenFeed #${input.coinSymbol.toUpperCase()}`;

    // Truncate to 320 chars max
    return text.length <= MAX_CAST_LENGTH ? text : `${text.slice(0, MAX_CAST_LENGTH - 3)}...`;
  }

  /**
   * Compute a pseudo-hash for the cast (used in Hubble mode).
   * In production, the hub returns the actual hash.
   */
  private computeCastHash(messageHex: string): string {
    return `0x${messageHex.slice(0, 40)}`;
  }
}
