/**
 * @degenfeed/api-worker — Zora Creator Earnings Routes
 *
 * Creator earnings on Zora via Protocol Rewards:
 *   GET    /api/zora/earnings/:address/summary     — Full earnings summary
 *   GET    /api/zora/earnings/:address/rewards      — Protocol Rewards balance
 *   POST   /api/zora/earnings/:address/claim        — Claim Protocol Rewards
 *   GET    /api/zora/earnings/:address/tips         — Recent tips received
 *   GET    /api/zora/earnings/:address/nfts         — Per-NFT earnings
 *   GET    /api/zora/earnings/:address/top          — Top earning NFTs
 *   POST   /api/zora/earnings/:address/record-earning — Record an earning event
 *   POST   /api/zora/earnings/tip                    — Send a tip
 *
 * All data is tracked via our self-hosted indexer + Zora Protocol Rewards.
 */
import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ═════════════════════════════════════════════════════════════════════════
// Router
// ═════════════════════════════════════════════════════════════════════════

const zoraEarnings = new Hono<{ Bindings: Env }>();

const INDEXER_URL = 'http://127.0.0.1:8091';

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/earnings/:address/summary — Full earnings summary
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.get('/:address/summary', async (c) => {
  const creatorAddress = c.req.param('address').toLowerCase();

  if (!creatorAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const { ZoraEarnings } = await import('@degenfeed/zora-sdk/earnings');
    const earnings = new ZoraEarnings({ indexerUrl: INDEXER_URL });

    const summary = await earnings.getCreatorEarnings(creatorAddress as `0x${string}`);

    return noCacheJsonResponse({ summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch earnings: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/earnings/:address/rewards — Protocol Rewards balance
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.get('/:address/rewards', async (c) => {
  const creatorAddress = c.req.param('address').toLowerCase();

  if (!creatorAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const { ZoraEarnings } = await import('@degenfeed/zora-sdk/earnings');
    const earnings = new ZoraEarnings({ indexerUrl: INDEXER_URL });

    const rewards = await earnings.getProtocolRewards(creatorAddress as `0x${string}`);

    return noCacheJsonResponse({ rewards });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch rewards: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/earnings/:address/claim — Claim Protocol Rewards
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.post('/:address/claim', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const creatorAddress = c.req.param('address').toLowerCase();

  if (!creatorAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  // Verify the session owns this address
  if (session.address?.toLowerCase() !== creatorAddress) {
    return jsonResponse({ error: 'Cannot claim rewards for another address' }, 403);
  }

  try {
    const { ZoraEarnings } = await import('@degenfeed/zora-sdk/earnings');
    const earnings = new ZoraEarnings({ indexerUrl: INDEXER_URL });

    // Need a wallet client — this is a relayer-based operation
    const { createWalletClient, http: viemHttp } = await import('viem');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { base } = await import('viem/chains');

    const relayerKey = c.env.X402_RELAYER_KEY;
    if (!relayerKey) {
      return jsonResponse({ error: 'Relayer not configured — claim manually via Zora' }, 501);
    }

    const account = privateKeyToAccount(relayerKey as `0x${string}`);
    const walletClient = createWalletClient({
      chain: base,
      transport: viemHttp(),
      account,
    });

    const result = await earnings.claimProtocolRewards(
      creatorAddress as `0x${string}`,
      walletClient,
    );

    // Record claim in indexer
    try {
      await fetch(`${INDEXER_URL}/api/earnings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          creator_address: creatorAddress,
          source: 'protocol_reward',
          amount_wei: result.amountWei,
          tx_hash: result.txHash,
          timestamp: Math.floor(Date.now() / 1000),
          metadata: { claimed: true, via: 'degenfeed-relayer' },
        }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Non-critical
    }

    return noCacheJsonResponse({ ok: true, claim: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Claim failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/earnings/:address/tips — Recent tips received
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.get('/:address/tips', async (c) => {
  const creatorAddress = c.req.param('address').toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 20, 1), 100);

  if (!creatorAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const res = await fetch(`${INDEXER_URL}/api/tips?creator=${creatorAddress}&limit=${limit}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return noCacheJsonResponse({ tips: [], total: 0 });
    }

    const data = (await res.json()) as {
      data?: Record<string, unknown>[];
      meta?: Record<string, unknown>;
    };
    return noCacheJsonResponse({
      tips: data.data ?? [],
      total: data.data?.length ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch tips: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/earnings/:address/nfts — Per-NFT earnings breakdown
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.get('/:address/nfts', async (c) => {
  const creatorAddress = c.req.param('address').toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 50, 1), 200);

  if (!creatorAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const { ZoraEarnings } = await import('@degenfeed/zora-sdk/earnings');
    const earnings = new ZoraEarnings({ indexerUrl: INDEXER_URL });

    const nfts = await earnings.getPerNFTSalesHistory(creatorAddress as `0x${string}`);

    return noCacheJsonResponse({
      nfts: nfts.slice(0, limit),
      total: nfts.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch NFT earnings: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/zora/earnings/:address/top — Top earning NFTs
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.get('/:address/top', async (c) => {
  const creatorAddress = c.req.param('address').toLowerCase();
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 10, 1), 50);

  if (!creatorAddress.startsWith('0x')) {
    return jsonResponse({ error: 'Invalid creator address' }, 400);
  }

  try {
    const { ZoraEarnings } = await import('@degenfeed/zora-sdk/earnings');
    const earnings = new ZoraEarnings({ indexerUrl: INDEXER_URL });

    const top = await earnings.getTopEarningNFTs(creatorAddress as `0x${string}`, limit);

    return noCacheJsonResponse({
      topEarningNFTs: top,
      total: top.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch top earnings: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/earnings/tip — Send a tip
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.post('/tip', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.creatorAddress || !body.amountWei) {
      return jsonResponse({ error: 'creatorAddress and amountWei required' }, 400);
    }

    const { ZoraEarnings } = await import('@degenfeed/zora-sdk/earnings');
    const earnings = new ZoraEarnings({ indexerUrl: INDEXER_URL });

    const tip = await earnings.recordTip({
      tipper: session.address! as `0x${string}`,
      creatorAddress: body.creatorAddress as `0x${string}`,
      amountWei: BigInt(body.amountWei as string),
      nftContract: body.nftContract as `0x${string}` | undefined,
      nftTokenId: body.nftTokenId as string | undefined,
    });

    return noCacheJsonResponse({ ok: true, tip }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Tip failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/zora/earnings/record — Record an earning event (for indexer)
// ═════════════════════════════════════════════════════════════════════════

zoraEarnings.post('/record', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  try {
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body.creatorAddress || !body.source || !body.amountWei) {
      return jsonResponse({ error: 'creatorAddress, source, and amountWei required' }, 400);
    }

    const VALID_SOURCES = [
      'primary_sale',
      'secondary_royalty',
      'protocol_reward',
      'tip',
      'referral',
    ];
    if (!VALID_SOURCES.includes(body.source as string)) {
      return jsonResponse(
        {
          error: `Invalid source. Must be one of: ${VALID_SOURCES.join(', ')}`,
        },
        400,
      );
    }

    const res = await fetch(`${INDEXER_URL}/api/earnings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        creator_address: body.creatorAddress,
        source: body.source,
        amount_wei: String(body.amountWei),
        token_id: body.tokenId,
        collection_address: body.collectionAddress,
        tx_hash: body.txHash,
        timestamp: body.timestamp ?? Math.floor(Date.now() / 1000),
        metadata: body.metadata ?? {},
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return jsonResponse({ error: 'Indexer rejected earning record' }, 502);
    }

    const result = await res.json();
    return noCacheJsonResponse({ ok: true, earning: result }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to record earning: ${msg}` }, 500);
  }
});

export default zoraEarnings;
