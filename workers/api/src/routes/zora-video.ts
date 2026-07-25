/**
 * @degenfeed/api-worker — Zora Video NFT Routes
 *
 * Full REST API for Zora video NFT lifecycle:
 *   POST   /api/zora/video/mint                    — Mint a video as Zora NFT
 *   GET    /api/zora/video/:id                     — Get video NFT details
 *   GET    /api/zora/video/trending                — Trending video NFTs
 *   GET    /api/zora/video/creator/:address        — Creator's video NFTs
 *   POST   /api/zora/video/:id/collect             — Collect/buy a video NFT
 *   POST   /api/zora/video/:id/tip                 — Tip via creator coin on video
 *   POST   /api/zora/video/:id/announce            — Announce to all protocols
 *
 * KV schema (CACHE namespace):
 *   zora:video:trending:{chain}          → ZoraVideoNFT[] (cached for 5 min)
 *   zora:video:creator:{address}         → ZoraVideoNFT[]
 *   zora:video:lookup:{chain}:{id}       → ZoraVideoNFT
 *   zora:video:announce:{id}             → AnnounceResult
 *
 * Integrates with @degenfeed/zora-sdk for on-chain operations and
 * the existing cross-protocol announcement system.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ZoraVideoMintRequest {
  /** NFT name */
  name: string;
  /** NFT description */
  description?: string;
  /** IPFS URI of the video (ipfs://<cid>) */
  videoUri: string;
  /** IPFS URI of the thumbnail */
  thumbnailUri?: string;
  /** Duration in seconds */
  duration: number;
  /** Edition size: 1 = unique, >1 = open edition */
  editionSize?: number;
  /** Royalty in bps (default 500 = 5%) */
  royaltyBps?: number;
  /** Linked creator coin address (optional) */
  linkedCreatorCoin?: string;
  /** Chain to mint on */
  chain?: 'base' | 'ethereum' | 'optimism' | 'arbitrum' | 'zora';
  /** Mint price in ETH string (e.g. "0.001") */
  mintPrice?: string;
  /** Referrer address for fee split */
  referrer?: string;
}

export interface ZoraVideoCollectRequest {
  /** Amount to spend (in ETH or native currency) */
  amount: string;
  /** Recipient address (defaults to session wallet) */
  recipient?: string;
}

export interface ZoraVideoTipRequest {
  /** Amount in ETH to tip */
  amount: string;
}

export interface ZoraVideoAnnounceRequest {
  /** ActivityPub/OAuth token for posting */
  activityPubToken?: string;
  /** ActivityPub instance URL */
  activityPubInstance?: string;
  /** Bluesky DID handle or email */
  blueskyIdentifier?: string;
  /** Bluesky app password */
  blueskyPassword?: string;
  /** Nostr private key hex */
  nostrPrivateKey?: string;
  /** Farccaster signer UUID */
  farcasterSigner?: string;
  /** Farcaster FID */
  farcasterFid?: number;
}

// ─── KV Key patterns ───────────────────────────────────────────────────────

function _trendingKey(chain: string): string {
  return `zora:video:trending:${chain}`;
}

function creatorKey(address: string): string {
  return `zora:video:creator:${address.toLowerCase()}`;
}

function lookupKey(chain: string, tokenId: string): string {
  return `zora:video:lookup:${chain}:${tokenId}`;
}

function announceKey(tokenId: string): string {
  return `zora:video:announce:${tokenId}`;
}

// ─── Router ────────────────────────────────────────────────────────────────

const zoraVideo = new Hono<{ Bindings: Env }>();

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/zora/video/mint — Mint a video as Zora NFT
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.post('/mint', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  try {
    const body = (await c.req.json()) as ZoraVideoMintRequest;

    // Validate required fields
    if (!body.name?.trim()) {
      return jsonResponse({ error: 'Name is required' }, 400);
    }
    if (!body.videoUri) {
      return jsonResponse({ error: 'videoUri is required' }, 400);
    }
    if (!body.duration || body.duration < 1) {
      return jsonResponse({ error: 'Duration must be >= 1 second' }, 400);
    }

    const chain = body.chain ?? 'base';
    const royaltyBps = body.royaltyBps ?? 500;
    const editionSize = body.editionSize ?? 1;

    // Get Pinata JWT from env
    const pinataJwt = c.env.PINATA_API_KEY
      ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
      : '';

    if (!pinataJwt) {
      return jsonResponse({ error: 'PINATA_API_KEY not configured' }, 500);
    }

    // Generate thumbnail if not provided
    let thumbnailUri = body.thumbnailUri;
    if (!thumbnailUri) {
      const { keccak256, stringToHex } = await import('viem');
      const hash = keccak256(stringToHex(body.videoUri)).slice(0, 10);
      thumbnailUri = `https://picsum.photos/seed/${hash}/640/360`;
    }

    // Use the ZoraVideoSDK to mint
    const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');

    const sdk = new ZoraVideoSDK({
      pinataJwt,
      defaultChain: chain,
      crossChainRegistry: c.env.CACHE,
    });

    const result = await sdk.mintVideoNFT({
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      videoUri: body.videoUri,
      thumbnailUri,
      duration: body.duration,
      creator: creatorAddress as `0x${string}`,
      editionSize,
      royaltyBps,
      linkedCreatorCoin: (body.linkedCreatorCoin || undefined) as `0x${string}` | undefined,
      referrer: (body.referrer || undefined) as `0x${string}` | undefined,
      chain,
    });

    // Cache in KV for trending/creator lookups
    try {
      const videoData = {
        tokenId: result.tokenId,
        contractAddress: result.contractAddress,
        name: body.name.trim(),
        description: body.description?.trim() ?? '',
        videoUri: body.videoUri,
        thumbnailUri,
        duration: body.duration,
        creator: creatorAddress,
        editionSize,
        royaltyBps,
        linkedCreatorCoin: body.linkedCreatorCoin ?? null,
        chain,
        mintPrice: body.mintPrice ?? '0',
        createdAt: new Date().toISOString(),
        metadataUri: result.metadataUri,
      };

      // Store under creator key
      const existingRaw = await c.env.CACHE?.get(creatorKey(creatorAddress));
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      existing.unshift(videoData);
      await c.env.CACHE?.put(creatorKey(creatorAddress), JSON.stringify(existing.slice(0, 200)), {
        expirationTtl: 86400 * 365,
      });

      // Store lookup
      await c.env.CACHE?.put(lookupKey(chain, result.tokenId), JSON.stringify(videoData), {
        expirationTtl: 86400 * 365,
      });
    } catch {
      // Non-critical — caching is best-effort
    }

    return noCacheJsonResponse(
      {
        ok: true,
        nft: {
          tokenId: result.tokenId,
          contractAddress: result.contractAddress,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          metadataUri: result.metadataUri,
        },
      },
      201,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Mint failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/zora/video/:id — Get video NFT details
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.get('/:id', async (c) => {
  const tokenId = c.req.param('id');
  const chain = c.req.query('chain') ?? 'base';
  const contract = c.req.query('contract');

  if (!tokenId || tokenId.length < 1) {
    return jsonResponse({ error: 'Invalid token ID' }, 400);
  }

  try {
    // Try KV lookup first
    const lookupRaw = await c.env.CACHE?.get(lookupKey(chain, tokenId));
    if (lookupRaw) {
      const cached = JSON.parse(lookupRaw);
      return noCacheJsonResponse({ video: cached });
    }

    // If contract address provided, fetch on-chain
    if (contract) {
      const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');
      const pinataJwt = c.env.PINATA_API_KEY
        ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
        : '';

      if (!pinataJwt) {
        return jsonResponse({ error: 'PINATA_API_KEY not configured — set env var for on-chain video lookup' }, 501);
      }

      const sdk = new ZoraVideoSDK({
        pinataJwt,
        defaultChain: chain as 'base' | 'ethereum' | 'zora',
      });

      const video = await sdk.getVideoNFT(tokenId, contract as `0x${string}`, chain);

      return noCacheJsonResponse({ video });
    }

    return jsonResponse({ error: 'Video NFT not found' }, 404);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch video: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/zora/video/trending — Trending video NFTs
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.get('/trending', async (c) => {
  const chain = c.req.query('chain') ?? 'base';
  const limit = Math.min(Number(c.req.query('limit')) || 30, 100);
  const cursor = c.req.query('cursor');

  try {
    const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');
    const pinataJwt = c.env.PINATA_API_KEY
      ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
      : '';

    if (!pinataJwt) {
      return jsonResponse({ error: 'PINATA_API_KEY not configured — set env var to fetch trending NFTs' }, 501);
    }

    const sdk = new ZoraVideoSDK({
      pinataJwt,
      defaultChain: chain as 'base' | 'ethereum' | 'zora',
    });

    const videos = await sdk.getTrendingVideoNFTs(
      {
        limit,
        network: chain as 'base' | 'ethereum' | 'zora',
        cursor,
      },
      { CACHE: c.env.CACHE },
    );

    return noCacheJsonResponse({
      videos,
      total: videos.length,
      hasMore: videos.length >= limit,
      cursor: videos.length >= limit ? String(Number(cursor || 0) + 1) : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch trending: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /api/zora/video/creator/:address — Creator's video NFTs
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.get('/creator/:address', async (c) => {
  const creatorAddress = c.req.param('address').toLowerCase();
  const limit = Math.min(Number(c.req.query('limit')) || 50, 200);

  if (!creatorAddress || creatorAddress.length < 10) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');
    const pinataJwt = c.env.PINATA_API_KEY
      ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
      : '';

    if (!pinataJwt) {
      return jsonResponse({ error: 'PINATA_API_KEY not configured — set env var to fetch creator NFTs' }, 501);
    }

    const sdk = new ZoraVideoSDK({
      pinataJwt,
    });

    const videos = await sdk.getCreatorVideoNFTs(creatorAddress as `0x${string}`, {
      CACHE: c.env.CACHE,
    });

    // Also fetch from our KV cache
    try {
      const cachedRaw = await c.env.CACHE?.get(creatorKey(creatorAddress));
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        // Merge SDK results with cached, preferring cached
        const merged = [...cached];
        for (const v of videos) {
          if (!merged.find((m: { tokenId: string }) => m.tokenId === v.tokenId)) {
            merged.push(v);
          }
        }
        return noCacheJsonResponse({
          videos: merged.slice(0, limit),
          total: merged.length,
        });
      }
    } catch {
      // Fall through
    }

    return noCacheJsonResponse({
      videos: videos.slice(0, limit),
      total: videos.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Failed to fetch creator videos: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/zora/video/:id/collect — Collect/buy a video NFT
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.post('/:id/collect', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address?.toLowerCase();
  if (!walletAddress) {
    return jsonResponse({ error: 'Wallet address not found' }, 401);
  }

  const tokenId = c.req.param('id');
  const chain = c.req.query('chain') ?? 'base';
  const contract = c.req.query('contract');

  if (!tokenId || !contract) {
    return jsonResponse({ error: 'tokenId and contract query params required' }, 400);
  }

  try {
    const body = (await c.req.json()) as ZoraVideoCollectRequest;
    const amount = body.amount ?? '0.001';
    const recipient = (body.recipient ?? walletAddress) as `0x${string}`;

    const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');
    const pinataJwt = c.env.PINATA_API_KEY
      ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
      : '';

    if (!pinataJwt) {
      return jsonResponse({ error: 'PINATA_API_KEY not configured — set env var to collect' }, 501);
    }

    const sdk = new ZoraVideoSDK({
      pinataJwt,
      defaultChain: chain as 'base' | 'ethereum' | 'zora',
    });

    const result = await sdk.collectVideoNFT(
      tokenId,
      contract as `0x${string}`,
      amount,
      recipient,
      chain,
    );

    return noCacheJsonResponse({
      ok: true,
      collect: result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Collect failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/zora/video/:id/tip — Tip via creator coin on video
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.post('/:id/tip', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const tipperAddress = session.address?.toLowerCase();
  if (!tipperAddress) {
    return jsonResponse({ error: 'Wallet address not found' }, 401);
  }

  const tokenId = c.req.param('id');
  const chain = c.req.query('chain') ?? 'base';
  const contract = c.req.query('contract');

  if (!tokenId || !contract) {
    return jsonResponse({ error: 'tokenId and contract query params required' }, 400);
  }

  try {
    const body = (await c.req.json()) as ZoraVideoTipRequest;
    const _amountWei = BigInt(body.amount) ?? 1000000000000000n; // Default 0.001 ETH

    const { parseEther } = await import('viem');
    const parsedAmount = body.amount ? parseEther(body.amount) : 1000000000000000n;

    const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');
    const pinataJwt = c.env.PINATA_API_KEY
      ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
      : '';

    if (!pinataJwt) {
      return jsonResponse({ error: 'PINATA_API_KEY not configured — set env var to tip' }, 501);
    }

    const sdk = new ZoraVideoSDK({
      pinataJwt,
      defaultChain: chain as 'base' | 'ethereum' | 'zora',
    });

    const result = await sdk.tipVideo(
      tokenId,
      contract as `0x${string}`,
      tipperAddress as `0x${string}`,
      parsedAmount,
      chain,
    );

    return noCacheJsonResponse({
      ok: true,
      tip: result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Tip failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/zora/video/:id/announce — Announce to all protocols
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.post('/:id/announce', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address?.toLowerCase();
  if (!walletAddress) {
    return jsonResponse({ error: 'Wallet address not found' }, 401);
  }

  const tokenId = c.req.param('id');
  const chain = c.req.query('chain') ?? 'base';
  const contract = c.req.query('contract');

  if (!tokenId || !contract) {
    return jsonResponse({ error: 'tokenId and contract query params required' }, 400);
  }

  try {
    const body = (await c.req.json()) as ZoraVideoAnnounceRequest;

    const { ZoraVideoSDK } = await import('@degenfeed/zora-sdk/video');
    const pinataJwt = c.env.PINATA_API_KEY
      ? `${c.env.PINATA_API_KEY}:${c.env.PINATA_SECRET_KEY ?? ''}`
      : '';

    if (!pinataJwt) {
      return jsonResponse({ error: 'PINATA_API_KEY not configured — set env var to announce' }, 501);
    }

    const sdk = new ZoraVideoSDK({
      pinataJwt,
      defaultChain: chain as 'base' | 'ethereum' | 'zora',
    });

    const result = await sdk.announceToAllProtocols(
      tokenId,
      contract as `0x${string}`,
      chain,
      { CACHE: c.env.CACHE },
      {
        activityPub:
          body.activityPubToken && body.activityPubInstance
            ? {
                instanceUrl: body.activityPubInstance,
                accessToken: body.activityPubToken,
              }
            : undefined,
        atProtocol:
          body.blueskyIdentifier && body.blueskyPassword
            ? { did: body.blueskyIdentifier, appPassword: body.blueskyPassword }
            : undefined,
        nostr: body.nostrPrivateKey ? { privateKey: body.nostrPrivateKey } : undefined,
        farcaster:
          body.farcasterSigner && body.farcasterFid
            ? { fid: body.farcasterFid, mnemonic: body.farcasterSigner }
            : undefined,
      },
    );

    // Cache the result
    try {
      await c.env.CACHE?.put(announceKey(tokenId), JSON.stringify(result), {
        expirationTtl: 86400,
      });
    } catch {
      // Non-critical
    }

    return noCacheJsonResponse({
      ok: true,
      announce: result,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Announce failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/zora/video/upload — Upload video to IPFS (pre-mint step)
// ═════════════════════════════════════════════════════════════════════════════

zoraVideo.post('/upload', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const formData = await c.req.parseBody({ all: true });
    const file = formData.file as File | Blob | undefined;

    if (!file) {
      return jsonResponse({ error: 'Video file is required' }, 400);
    }

    // Max 500MB
    if (file.size > 500 * 1024 * 1024) {
      return jsonResponse({ error: 'Video file must be under 500MB' }, 400);
    }

    const pinataSecret = c.env.PINATA_SECRET_KEY;
    const pinataKey = c.env.PINATA_API_KEY;

    if (!pinataKey || !pinataSecret) {
      return jsonResponse({ error: 'Pinata credentials not configured' }, 500);
    }

    const pinataJwt = `${pinataKey}:${pinataSecret}`;

    // Use the ZoraVideoSDK to upload
    const { ZoraVideoSDK, uploadToIpfs } = await import('@degenfeed/zora-sdk/video');
    const result = await uploadToIpfs(
      file,
      (formData.fileName as string) || `video-${Date.now()}.mp4`,
      { jwt: pinataJwt },
      { pinToArweave: formData.pinToArweave === 'true' },
    );

    return noCacheJsonResponse(
      {
        ok: true,
        upload: {
          ipfsUri: result.ipfsUri,
          ipfsCid: result.ipfsCid,
          arweaveUri: result.arweaveUri ?? null,
          gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.ipfsCid}`,
        },
      },
      201,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonResponse({ error: `Upload failed: ${msg}` }, 500);
  }
});

export default zoraVideo;
