/**
 * @degenfeed/api-worker — Zora NFT Routes
 *
 * Full NFT lifecycle on Zora:
 *   POST   /api/zora/mint                     — Mint NFT on Zora
 *   POST   /api/zora/nft/create-collection    — Create NFT collection
 *   POST   /api/zora/nft/gasless-prepare      — Prepare gasless mint
 *   POST   /api/zora/nft/gasless-submit       — Submit gasless mint
 *   GET    /api/zora/nft/trending             — Trending NFTs
 *   GET    /api/zora/nft/:address/:tokenId    — NFT details
 *   GET    /api/zora/nft/:address             — All NFTs in collection
 *   POST   /api/zora/upload                   — Upload media to IPFS
 *
 * All data is self-hosted via our Zora indexer (port 8091).
 * On-chain operations go through @degenfeed/zora-sdk.
 */
import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

const zoraNFT = new Hono<{ Bindings: Env }>();

const INDEXER_URL = 'http://127.0.0.1:8091';

/** Resolve the Zora indexer URL, preferring the worker env override. */
function getIndexerUrl(env: Env): string {
  return env.ZORA_INDEXER_URL || INDEXER_URL;
}


// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/mint — Mint an NFT on Zora
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.post('/mint', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    // Validate
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return jsonResponse({ error: 'name is required' }, 400);
    }
    if (!body.fileUri || typeof body.fileUri !== 'string') {
      return jsonResponse({ error: 'fileUri is required' }, 400);
    }
    if (!body.collectionAddress || typeof body.collectionAddress !== 'string') {
      return jsonResponse({ error: 'collectionAddress is required' }, 400);
    }

    const chain = (body.chain as string) ?? 'base';
    const editionSize = (body.editionSize as number) ?? 1;

    // Use the SDK to mint
    const { ZoraNFTMinter } = await import('@degenfeed/zora-sdk/nft-mint');
    const minter = new ZoraNFTMinter({
      privateKey: c.env.X402_RELAYER_KEY || undefined,
    });

    const result = await minter.mintNFT({
      collectionAddress: body.collectionAddress as `0x${string}`,
      name: body.name.trim(),
      description: (body.description as string)?.trim() ?? '',
      fileUri: body.fileUri as string,
      mimeType: (body.mimeType as string) ?? 'image/png',
      editionSize,
      mintPriceWei: body.mintPriceWei ? BigInt(body.mintPriceWei as string) : undefined,
      royaltyBps: (body.royaltyBps as number) ?? 500,
      creator: creatorAddress as `0x${string}`,
      referrer: (body.referrer as `0x${string}`) || undefined,
      chain: chain as 'base' | 'zora',
    });

    // Record the mint in our indexer
    try {
      await fetch(`${getIndexerUrl(c.env)}/api/mints`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token_id: result.tokenId,
          collection_address: result.contractAddress,
          token_name: body.name.trim(),
          creator_address: creatorAddress,
          minter_address: creatorAddress,
          price_wei: body.mintPriceWei ?? '0',
          quantity: editionSize,
          chain_id: chain === 'zora' ? 7777777 : 8453,
          timestamp: Math.floor(Date.now() / 1000),
          tx_hash: result.txHash,
          metadata_uri: result.metadataUri,
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Non-critical — indexer may not be running
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
          zoraUrl: result.zoraUrl,
        },
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Mint failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/nft/create-collection — Create NFT collection on Zora
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.post('/create-collection', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = session.address?.toLowerCase();
  if (!creatorAddress) {
    return jsonResponse({ error: 'Creator wallet address not found' }, 401);
  }

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return jsonResponse({ error: 'name is required' }, 400);
    }
    if (!body.symbol || typeof body.symbol !== 'string' || !body.symbol.trim()) {
      return jsonResponse({ error: 'symbol is required' }, 400);
    }

    const { ZoraNFTMinter } = await import('@degenfeed/zora-sdk/nft-mint');
    const minter = new ZoraNFTMinter({
      privateKey: c.env.X402_RELAYER_KEY || undefined,
    });

    const result = await minter.createCollection({
      name: body.name.trim(),
      symbol: body.symbol.trim(),
      creator: creatorAddress as `0x${string}`,
      description: (body.description as string)?.trim(),
      image: (body.image as string) || undefined,
      royaltyBps: (body.royaltyBps as number) ?? 500,
      chain: (body.chain as 'base' | 'zora') ?? 'base',
    });

    return noCacheJsonResponse(
      {
        ok: true,
        collection: {
          address: result.collectionAddress,
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          zoraUrl: result.zoraUrl,
        },
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Collection creation failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/nft/gasless-prepare — Prepare gasless mint signature
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.post('/gasless-prepare', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.collectionAddress || !body.quantity) {
      return jsonResponse({ error: 'collectionAddress and quantity required' }, 400);
    }

    const { ZoraNFTMinter } = await import('@degenfeed/zora-sdk/nft-mint');
    const minter = new ZoraNFTMinter();

    const { typedData, signature } = await minter.prepareGaslessMint({
      collectionAddress: body.collectionAddress as `0x${string}`,
      recipient: (body.recipient as `0x${string}`) || session.address!,
      quantity: body.quantity as number,
      relayerUrl: c.env.X402_RELAYER_URL || 'http://127.0.0.1:8787',
      deadline: body.deadline ? BigInt(body.deadline as number) : undefined,
    });

    const typedMessage = typedData.message as { deadline?: bigint | number | string };

    return noCacheJsonResponse({
      ok: true,
      typedData,
      signature,
      deadline: typedMessage.deadline?.toString() ?? '',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Gasless prepare failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/nft/gasless-submit — Submit gasless mint via relayer
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.post('/gasless-submit', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.collectionAddress || !body.signature || !body.quantity) {
      return jsonResponse({ error: 'collectionAddress, signature, quantity required' }, 400);
    }

    const { ZoraNFTMinter } = await import('@degenfeed/zora-sdk/nft-mint');
    const minter = new ZoraNFTMinter();

    const result = await minter.submitGaslessMint(
      {
        collectionAddress: body.collectionAddress as `0x${string}`,
        recipient: (body.recipient as `0x${string}`) || session.address!,
        quantity: body.quantity as number,
        relayerUrl: c.env.X402_RELAYER_URL || 'http://127.0.0.1:8787',
        deadline: body.deadline ? BigInt(body.deadline as number) : undefined,
      },
      body.signature as `0x${string}`,
    );

    return noCacheJsonResponse(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Gasless submit failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/nft/trending — Trending NFTs from our indexer
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.get('/trending', async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

  try {
    const res = await fetch(`${getIndexerUrl(c.env)}/api/trending?limit=${limit}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return jsonResponse({ error: 'Indexer unavailable' }, 502);
    }

    const data = (await res.json()) as {
      data?: Record<string, unknown>[];
      meta?: Record<string, unknown>;
    };
    return noCacheJsonResponse({
      nfts: data.data ?? [],
      meta: data.meta ?? { returned: 0, limit },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch trending: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/nft/:address/:tokenId — Single NFT details
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.get('/:address/:tokenId', async (c) => {
  const contractAddress = c.req.param('address').toLowerCase();
  const tokenId = c.req.param('tokenId');

  if (!contractAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid contract address' }, 400);
  }

  try {
    // Fetch from our indexer
    const res = await fetch(`${getIndexerUrl(c.env)}/api/tokens?collection=${contractAddress}&limit=1`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return jsonResponse({ error: 'NFT not found in indexer' }, 404);
    }

    const data = (await res.json()) as { data?: Record<string, unknown>[] };

    if (!data.data || data.data.length === 0) {
      return jsonResponse({ error: 'NFT not found' }, 404);
    }

    const token = data.data[0];
    if (!token) {
      return jsonResponse({ error: 'NFT not found' }, 404);
    }
    const zoraChain = (token.mint_chain_id as number) === 7777777 ? 'zora' : 'base';

    return noCacheJsonResponse({
      nft: {
        ...token,
        zoraUrl: `https://zora.co/collect/${zoraChain}:${contractAddress}/${tokenId}`,
        basescanUrl: `https://basescan.org/address/${contractAddress}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch NFT: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/nft/:address — All NFTs in a collection
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.get('/:address', async (c) => {
  const contractAddress = c.req.param('address').toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 200);
  const offset = Math.max(Number(c.req.query('offset')) || 0, 0);

  if (!contractAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid contract address' }, 400);
  }

  try {
    const res = await fetch(
      `${getIndexerUrl(c.env)}/api/tokens?collection=${contractAddress}&limit=${limit}&offset=${offset}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return jsonResponse({ error: 'Indexer unavailable' }, 502);
    }

    const data = (await res.json()) as {
      data?: Record<string, unknown>[];
      meta?: Record<string, unknown>;
    };
    return noCacheJsonResponse({
      nfts: data.data ?? [],
      meta: data.meta ?? { total: 0, returned: 0 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch collection: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/upload — Upload media to IPFS (pre-mint)
// ═════════════════════════════════════════════════════════════════════════

zoraNFT.post('/upload', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const formData = await c.req.parseBody({ all: true });
    const file = formData.file as File | Blob | undefined;

    if (!file) {
      return jsonResponse({ error: 'File is required' }, 400);
    }

    if (file.size > 500 * 1024 * 1024) {
      return jsonResponse({ error: 'File must be under 500MB' }, 400);
    }

    const pinataKey = c.env.PINATA_API_KEY;
    const pinataSecret = c.env.PINATA_SECRET_KEY;

    if (!pinataKey || !pinataSecret) {
      return jsonResponse({ error: 'Pinata credentials not configured' }, 500);
    }

    // Upload to IPFS via Pinata
    const form = new FormData();
    form.append('file', file, (formData.fileName as string) || `nft-${Date.now()}`);
    form.append('pinataMetadata', JSON.stringify({ name: `degenfeed-nft-${Date.now()}` }));

    const pinataRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${pinataKey}:${pinataSecret}`,
      },
      body: form,
      signal: AbortSignal.timeout(120000),
    });

    if (!pinataRes.ok) {
      const body = await pinataRes.text().catch(() => '');
      return jsonResponse(
        { error: `Pinata upload failed: ${pinataRes.status}: ${body.slice(0, 200)}` },
        502,
      );
    }

    const pinataData = (await pinataRes.json()) as { IpfsHash: string };

    return noCacheJsonResponse(
      {
        ok: true,
        ipfsUri: `ipfs://${pinataData.IpfsHash}`,
        ipfsCid: pinataData.IpfsHash,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${pinataData.IpfsHash}`,
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Upload failed: ${msg}` }, 500);
  }
});

export default zoraNFT;
