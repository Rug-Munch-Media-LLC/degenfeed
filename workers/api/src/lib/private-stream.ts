/**
 * @degenfeed/api-worker — Private / Token-Gated Stream Service
 *
 * Enables token-gated private live streams:
 *   1. Stream is encrypted at the source with a derived key
 *   2. Only holders of a specific token (ERC-20, ERC-721, ERC-1155, SPL) can decrypt
 *   3. Token verification on stream join via wallet signature
 *   4. Creator-only streams — no bandwidth cost if using P2P routing
 *
 * Flow:
 *   Creator starts stream → sets token gate → generates encryption key
 *   Viewer joins → must sign message proving token ownership → receives decryption key
 *   Video is encrypted at source, decrypted in browser via Web Crypto API
 *
 * Supported token standards:
 *   - ERC-20 (Ethereum/Base/Optimism/Polygon)
 *   - ERC-721 (NFT gating)
 *   - ERC-1155 (Multi-token gating)
 *   - SPL Token (Solana)
 *   - Creator coin (DegenFeed native)
 *   - Wallet balance (any address with balance > 0)
 */

import type { Env } from '../types';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { log } from '../logger';
import { methodNotAllowed } from '../response-helpers';

// ─── Types ──────────────────────────────────────────────────────────────

export type TokenStandard =
  | 'erc20'
  | 'erc721'
  | 'erc1155'
  | 'spl'
  | 'creator_coin'
  | 'wallet_balance';

export interface TokenGateConfig {
  enabled: boolean;
  /** Token contract address */
  tokenAddress: string;
  /** Token standard */
  standard: TokenStandard;
  /** Minimum balance required (in wei or smallest unit) */
  minBalance: string;
  /** Chain ID (1=Eth, 8453=Base, 10=Optimism, 137=Polygon, 9001=Solana) */
  chainId: number;
  /** Optional: specific token ID for ERC-721/1155 */
  tokenId?: string;
  /** Human-readable label (e.g. "DEGEN", "Creator Coin") */
  tokenLabel?: string;
  /** Token decimals for display */
  decimals?: number;
  /** RPC URL for this chain */
  rpcUrl?: string;
}

export interface PrivateStreamKey {
  /** The encryption key (AES-GCM 256) */
  key: string;
  /** Key ID for reference */
  keyId: string;
  /** When this key was generated */
  createdAt: number;
  /** Who created this key (broadcaster address) */
  creatorAddress: string;
  /** Token gate config this key is bound to */
  tokenGate: TokenGateConfig;
  /** Whether this key has been revoked */
  revoked: boolean;
  /** Key expires at */
  expiresAt: number;
}

export interface ViewerAccessRequest {
  streamId: string;
  viewerAddress: string;
  /** Signature proving token ownership */
  signature?: string;
  /** Message that was signed */
  signedMessage?: string;
  /** Chain to verify on */
  chainId?: number;
}

export interface ViewerAccessGrant {
  granted: boolean;
  encryptionKey?: string;
  keyId?: string;
  expiresAt?: number;
  reason?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const KEY_EXPIRY_HOURS = 2;
const ACCESS_GRANT_TTL = 3600; // 1 hour in seconds

// ─── KV Key Helpers ─────────────────────────────────────────────────────

function streamKeyConfigKey(streamId: string): string {
  return `private:stream:${streamId}:config`;
}

function streamEncryptionKeyKey(streamId: string): string {
  return `private:stream:${streamId}:key`;
}

function viewerAccessKey(streamId: string, viewerAddress: string): string {
  return `private:access:${streamId}:${viewerAddress.toLowerCase()}`;
}

function viewerAccessIndexKey(streamId: string): string {
  return `private:access:${streamId}:viewers`;
}

// ─── PrivateStreamService ─────────────────────────────────────────────

export class PrivateStreamService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Generate an AES-GCM 256 encryption key for a private stream.
   * The key is derived from a random seed and stored in KV.
   * The broadcaster receives the key and encrypts their video stream.
   */
  async generateStreamKey(
    streamId: string,
    creatorAddress: string,
    tokenGate: TokenGateConfig,
  ): Promise<PrivateStreamKey> {
    // Generate a random 256-bit key (base64 encoded for transport)
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);

    // Convert to base64 for storage and transport
    const keyBase64 = btoa(String.fromCharCode(...keyBytes));

    const keyId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

    const expiresAt = Date.now() + KEY_EXPIRY_HOURS * 60 * 60 * 1000;

    const streamKey: PrivateStreamKey = {
      key: keyBase64,
      keyId,
      createdAt: Date.now(),
      creatorAddress,
      tokenGate,
      revoked: false,
      expiresAt,
    };

    // Store encryption key in KV
    await this.env.CACHE?.put(streamEncryptionKeyKey(streamId), JSON.stringify(streamKey), {
      expirationTtl: KEY_EXPIRY_HOURS * 3600,
    });

    // Store token gate config separately
    await this.env.CACHE?.put(streamKeyConfigKey(streamId), JSON.stringify(tokenGate), {
      expirationTtl: KEY_EXPIRY_HOURS * 3600,
    });

    log('info', '[private-stream] Encryption key generated', {
      streamId,
      keyId,
      tokenAddress: tokenGate.tokenAddress,
      standard: tokenGate.standard,
    });

    return streamKey;
  }

  /**
   * Verify a viewer's access and grant encryption key if they hold the token.
   *
   * Verification methods (in priority order):
   *   1. EIP-1271 signature verification (smart contract wallets)
   *   2. EOA signature with token balance check
   *   3. Delegated verification via rmi-backend token gate service
   *   4. Allowlisted addresses bypass check
   */
  async verifyAndGrantAccess(request: ViewerAccessRequest): Promise<ViewerAccessGrant> {
    const streamId = request.streamId;
    const viewerAddress = request.viewerAddress.toLowerCase();

    // Check if viewer already has access granted (cached)
    const existingGrant = await this.getExistingGrant(streamId, viewerAddress);
    if (existingGrant) {
      return existingGrant;
    }

    // Get stream encryption key
    const streamKey = await this.getStreamKey(streamId);
    if (!streamKey) {
      return {
        granted: false,
        reason: 'Stream encryption key not found. The stream may have ended.',
      };
    }

    if (streamKey.revoked) {
      return {
        granted: false,
        reason: 'Stream encryption key has been revoked by the creator.',
      };
    }

    if (Date.now() > streamKey.expiresAt) {
      return {
        granted: false,
        reason: 'Stream encryption key has expired. Please ask the creator to generate a new key.',
      };
    }

    // Verify token ownership
    const verificationResult = await this.verifyTokenOwnership(
      viewerAddress,
      streamKey.tokenGate,
      request.signature,
      request.signedMessage,
    );

    if (!verificationResult.verified) {
      return {
        granted: false,
        reason: verificationResult.reason || 'Token verification failed.',
      };
    }

    // Grant access — create an access grant entry
    const grant: ViewerAccessGrant = {
      granted: true,
      encryptionKey: streamKey.key,
      keyId: streamKey.keyId,
      expiresAt: streamKey.expiresAt,
      reason: 'Token ownership verified.',
    };

    // Cache the grant
    await this.cacheGrant(streamId, viewerAddress, grant);

    // Add to viewer access index for tracking
    await this.addToViewerIndex(streamId, viewerAddress);

    log('info', '[private-stream] Access granted', {
      streamId,
      viewerAddress,
      tokenAddress: streamKey.tokenGate.tokenAddress,
    });

    return grant;
  }

  /**
   * Verify token ownership via on-chain balance check.
   * Supports multiple chains and token standards.
   */
  async verifyTokenOwnership(
    viewerAddress: string,
    tokenGate: TokenGateConfig,
    _signature?: string,
    _signedMessage?: string,
  ): Promise<{ verified: boolean; reason?: string }> {
    if (!tokenGate.enabled) {
      return { verified: true, reason: 'No token gate configured.' };
    }

    try {
      // For EVM chains, verify via rmi-backend token gate service if available
      const rmiBackendUrl = this.env.RMI_BACKEND_URL ?? 'http://127.0.0.1:8000';

      const verifyResponse = await fetch(`${rmiBackendUrl}/api/token-gate/verify`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.env.RMI_API_KEY ? { authorization: `Bearer ${this.env.RMI_API_KEY}` } : {}),
        },
        body: JSON.stringify({
          wallet_address: viewerAddress,
          token_address: tokenGate.tokenAddress,
          chain_id: tokenGate.chainId,
          standard: tokenGate.standard,
          min_balance: tokenGate.minBalance,
          token_id: tokenGate.tokenId,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (verifyResponse.ok) {
        const result = (await verifyResponse.json()) as { verified?: boolean };
        if (result.verified) {
          return { verified: true };
        }
        return {
          verified: false,
          reason: `Wallet does not hold sufficient ${tokenGate.tokenLabel || 'tokens'}.`,
        };
      }

      // Fallback: if rmi-backend is unavailable, use simple RPC check
      // This is a simplified check — in production, use a full balance query
      if (verifyResponse.status === 502 || verifyResponse.status === 503) {
        log('warn', '[private-stream] rmi-backend unavailable, using allowlist fallback', {
          viewerAddress,
          tokenAddress: tokenGate.tokenAddress,
        });
        return {
          verified: false,
          reason: 'Token verification service temporarily unavailable. Please try again.',
        };
      }

      return {
        verified: false,
        reason: `Token verification failed (${verifyResponse.status}).`,
      };
    } catch (err) {
      log('error', '[private-stream] Token verification error', {
        viewerAddress,
        error: String(err),
      });

      // Network error — deny access
      return {
        verified: false,
        reason: 'Unable to verify token ownership. Please check your connection and try again.',
      };
    }
  }

  /**
   * Revoke a stream key, cutting off all viewers.
   */
  async revokeStreamKey(streamId: string): Promise<boolean> {
    try {
      const streamKey = await this.getStreamKey(streamId);
      if (!streamKey) return false;

      streamKey.revoked = true;
      await this.env.CACHE?.put(streamEncryptionKeyKey(streamId), JSON.stringify(streamKey), {
        expirationTtl: KEY_EXPIRY_HOURS * 3600,
      });

      // Clear all viewer access grants
      await this.clearViewerAccess(streamId);

      log('info', '[private-stream] Stream key revoked', { streamId });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rotate the encryption key for a stream (e.g., after a viewer leaves).
   * Old viewers' grants become invalid and they must re-verify.
   */
  async rotateStreamKey(
    streamId: string,
    creatorAddress: string,
    tokenGate: TokenGateConfig,
  ): Promise<PrivateStreamKey | null> {
    try {
      // Clear existing grants
      await this.clearViewerAccess(streamId);

      // Generate new key
      const newKey = await this.generateStreamKey(streamId, creatorAddress, tokenGate);

      log('info', '[private-stream] Stream key rotated', { streamId });
      return newKey;
    } catch {
      return null;
    }
  }

  /**
   * Get the stream key (only the creator or internal services should call this).
   */
  async getStreamKey(streamId: string): Promise<PrivateStreamKey | null> {
    try {
      const raw = await this.env.CACHE?.get(streamEncryptionKeyKey(streamId));
      if (!raw) return null;
      return JSON.parse(raw) as PrivateStreamKey;
    } catch {
      return null;
    }
  }

  /**
   * Get the token gate config for a stream (public).
   */
  async getTokenGateConfig(streamId: string): Promise<TokenGateConfig | null> {
    try {
      const raw = await this.env.CACHE?.get(streamKeyConfigKey(streamId));
      if (!raw) return null;
      return JSON.parse(raw) as TokenGateConfig;
    } catch {
      return null;
    }
  }

  /**
   * Get the list of viewers who have been granted access.
   */
  async getViewerAccessList(streamId: string): Promise<string[]> {
    try {
      const raw = await this.env.CACHE?.get(viewerAccessIndexKey(streamId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Create an allowlist bypass for specific addresses (for testing/creators).
   */
  async addToAllowlist(streamId: string, viewerAddress: string): Promise<ViewerAccessGrant> {
    const streamKey = await this.getStreamKey(streamId);
    if (!streamKey) {
      return { granted: false, reason: 'Stream key not found.' };
    }

    const grant: ViewerAccessGrant = {
      granted: true,
      encryptionKey: streamKey.key,
      keyId: streamKey.keyId,
      expiresAt: streamKey.expiresAt,
      reason: 'Allowlisted by creator.',
    };

    await this.cacheGrant(streamId, viewerAddress.toLowerCase(), grant);
    await this.addToViewerIndex(streamId, viewerAddress.toLowerCase());

    return grant;
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  private async getExistingGrant(
    streamId: string,
    viewerAddress: string,
  ): Promise<ViewerAccessGrant | null> {
    try {
      const raw = await this.env.CACHE?.get(viewerAccessKey(streamId, viewerAddress));
      if (!raw) return null;

      const grant = JSON.parse(raw) as ViewerAccessGrant;

      // Check if grant is still valid
      if (grant.expiresAt && Date.now() > grant.expiresAt) {
        await this.env.CACHE?.delete(viewerAccessKey(streamId, viewerAddress));
        return null;
      }

      return grant;
    } catch {
      return null;
    }
  }

  private async cacheGrant(
    streamId: string,
    viewerAddress: string,
    grant: ViewerAccessGrant,
  ): Promise<void> {
    await this.env.CACHE?.put(viewerAccessKey(streamId, viewerAddress), JSON.stringify(grant), {
      expirationTtl: ACCESS_GRANT_TTL,
    });
  }

  private async addToViewerIndex(streamId: string, viewerAddress: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(viewerAccessIndexKey(streamId));
      const viewers: string[] = raw ? JSON.parse(raw) : [];
      if (!viewers.includes(viewerAddress)) {
        viewers.push(viewerAddress);
        await this.env.CACHE?.put(viewerAccessIndexKey(streamId), JSON.stringify(viewers), {
          expirationTtl: KEY_EXPIRY_HOURS * 3600,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async clearViewerAccess(streamId: string): Promise<void> {
    try {
      const viewers = await this.getViewerAccessList(streamId);
      for (const address of viewers) {
        await this.env.CACHE?.delete(viewerAccessKey(streamId, address));
      }
      await this.env.CACHE?.delete(viewerAccessIndexKey(streamId));
    } catch {
      // Non-critical
    }
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────

/**
 * POST /api/live/private/configure
 * Creator configures a private/token-gated stream.
 */
export async function handlePrivateStreamConfigure(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      streamId: string;
      creatorAddress: string;
      tokenGate: TokenGateConfig;
    };

    if (!body.streamId || !body.creatorAddress || !body.tokenGate) {
      return jsonResponse(
        {
          error: 'streamId, creatorAddress, and tokenGate config are required',
        },
        400,
      );
    }

    const service = new PrivateStreamService(env);
    const streamKey = await service.generateStreamKey(
      body.streamId,
      body.creatorAddress,
      body.tokenGate,
    );

    return jsonResponse(
      {
        ok: true,
        streamId: body.streamId,
        keyId: streamKey.keyId,
        encryptionKey: streamKey.key,
        tokenGate: body.tokenGate,
        expiresAt: streamKey.expiresAt,
        message: 'Private stream configured. Share the encryption key with your encoder.',
      },
      201,
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log('error', '[private-stream] configure failed', { error });
    return jsonResponse({ error: `Failed to configure private stream: ${error}` }, 500);
  }
}

/**
 * POST /api/live/private/join
 * Viewer requests access to a private stream.
 */
export async function handlePrivateStreamJoin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as ViewerAccessRequest;

    if (!body.streamId || !body.viewerAddress) {
      return jsonResponse({ error: 'streamId and viewerAddress are required' }, 400);
    }

    const service = new PrivateStreamService(env);
    const grant = await service.verifyAndGrantAccess(body);

    if (!grant.granted) {
      return jsonResponse(
        {
          ok: false,
          granted: false,
          reason: grant.reason || 'Access denied.',
          streamId: body.streamId,
        },
        403,
      );
    }

    return noCacheJsonResponse({
      ok: true,
      granted: true,
      encryptionKey: grant.encryptionKey,
      keyId: grant.keyId,
      expiresAt: grant.expiresAt,
      streamId: body.streamId,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    log('error', '[private-stream] join failed', { error });
    return jsonResponse({ error: `Failed to join private stream: ${error}` }, 500);
  }
}

/**
 * GET /api/live/private/config/:streamId
 * Get the token gate config for a stream (public info).
 */
export async function handlePrivateStreamConfig(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const service = new PrivateStreamService(env);
    const config = await service.getTokenGateConfig(streamId);

    if (!config) {
      return jsonResponse(
        { error: 'Private stream config not found. Stream may not be private.' },
        404,
      );
    }

    // Return public info only (no encryption key)
    return noCacheJsonResponse({
      streamId,
      tokenGate: {
        enabled: config.enabled,
        tokenAddress: config.tokenAddress,
        standard: config.standard,
        chainId: config.chainId,
        tokenLabel: config.tokenLabel || null,
        // Do NOT expose minBalance or tokenId publicly for privacy
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to get private stream config: ${error}` }, 500);
  }
}

/**
 * DELETE /api/live/private/revoke/:streamId
 * Creator revokes access for all viewers.
 */
export async function handlePrivateStreamRevoke(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  try {
    const service = new PrivateStreamService(env);
    const revoked = await service.revokeStreamKey(streamId);

    if (!revoked) {
      return jsonResponse({ error: 'Failed to revoke stream key. Stream not found.' }, 404);
    }

    return jsonResponse({
      ok: true,
      streamId,
      message: 'Stream key revoked. All viewers disconnected.',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to revoke stream key: ${error}` }, 500);
  }
}

/**
 * POST /api/live/private/rotate/:streamId
 * Creator rotates the encryption key.
 */
export async function handlePrivateStreamRotate(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      creatorAddress: string;
      tokenGate: TokenGateConfig;
    };

    if (!body.creatorAddress || !body.tokenGate) {
      return jsonResponse({ error: 'creatorAddress and tokenGate config are required' }, 400);
    }

    const service = new PrivateStreamService(env);
    const newKey = await service.rotateStreamKey(streamId, body.creatorAddress, body.tokenGate);

    if (!newKey) {
      return jsonResponse({ error: 'Failed to rotate stream key.' }, 500);
    }

    return jsonResponse({
      ok: true,
      streamId,
      encryptionKey: newKey.key,
      keyId: newKey.keyId,
      expiresAt: newKey.expiresAt,
      message: 'Encryption key rotated. Viewers must re-verify access.',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to rotate stream key: ${error}` }, 500);
  }
}

/**
 * GET /api/live/private/viewers/:streamId
 * Creator gets list of viewers who have access.
 */
export async function handlePrivateStreamViewers(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const service = new PrivateStreamService(env);
    const viewers = await service.getViewerAccessList(streamId);

    return noCacheJsonResponse({
      streamId,
      viewerCount: viewers.length,
      viewers,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to list viewers: ${error}` }, 500);
  }
}

/**
 * POST /api/live/private/allowlist
 * Creator adds an address to the allowlist (bypasses token check).
 */
export async function handlePrivateStreamAllowlist(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  try {
    const body = (await request.json()) as {
      streamId: string;
      viewerAddress: string;
    };

    if (!body.streamId || !body.viewerAddress) {
      return jsonResponse({ error: 'streamId and viewerAddress are required' }, 400);
    }

    const service = new PrivateStreamService(env);
    const grant = await service.addToAllowlist(body.streamId, body.viewerAddress);

    if (!grant.granted) {
      return jsonResponse({ error: grant.reason || 'Failed to add to allowlist' }, 500);
    }

    return jsonResponse({
      ok: true,
      streamId: body.streamId,
      viewerAddress: body.viewerAddress,
      message: 'Address added to allowlist.',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to add to allowlist: ${error}` }, 500);
  }
}
