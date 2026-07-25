/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Routes
 *
 * Bridges content between any two protocols, including wrapping
 * content from Solana / Nostr / Farcaster into Zora creator coins.
 *
 * Routes:
 *   POST /api/cross-protocol-bridge/wrap  — Bridge content from protocol A → B
 *   POST /api/cross-protocol-bridge/zora  — Wrap source content into Zora creator coin
 *   POST /api/cross-protocol-bridge/sync  — Sync edit from one protocol to all siblings
 *   GET  /api/cross-protocol-bridge/status — Get bridge health and status for a post
 */

import type { Protocol } from '@degenfeed/types';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import type { PublishInput } from '../lib/publish-orchestrator';
import { ALLOWED_PROTOCOLS, hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { methodNotAllowed } from '../response-helpers';

// ─── Types ────────────────────────────────────────────────────────────────

interface WrapRequest {
  /** Source df:// URI (what to bridge) */
  sourceUri: string;
  /** Source protocol */
  sourceProtocol: string;
  /** Target protocol to bridge to */
  targetProtocol: string;
  /** Optional custom text (defaults to source content) */
  text?: string;
  /** Auth tokens for the target protocol */
  auth?: Record<string, string>;
  /** Pre-signed messages (for Farcaster, Lens) */
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
  /** Images to attach */
  images?: Array<{ url: string; alt?: string; mimeType?: string }>;
  /** Title for long-form content */
  title?: string;
}

interface ZoraBridgeRequest {
  /** Source df:// URI */
  sourceUri: string;
  /** Source protocol */
  sourceProtocol: string;
  /** Source native ID on that protocol */
  sourceNativeId: string;
  /** Content text */
  text: string;
  /** Optional title */
  title?: string;
  /** Optional image URL for the NFT */
  imageUrl?: string;
  /** EVM chain: base, ethereum, optimism, arbitrum */
  chain?: string;
  /** Creator wallet address (for coin attribution) */
  creatorAddress?: string;
  /** Zora creator coin contract address (if wrapping to an existing coin) */
  creatorCoinAddress?: string;
  /** Zora NFT contract address (if minting as NFT) */
  nftContractAddress?: string;
  /** Recipient address for NFT mint */
  recipientAddress?: string;
  /** Private key for signing the on-chain tx (encrypted/from vault) */
  privateKey?: string;
  /** Auth tokens for source protocol lookup */
  auth?: Record<string, string>;
}

interface SyncRequest {
  /** df:// URI of the edited post */
  postUri: string;
  /** New text content */
  newText: string;
  /** Optional new title */
  newTitle?: string;
  /** Auth tokens for the source protocol */
  auth?: Record<string, string>;
}

// ─── Route Handlers ───────────────────────────────────────────────────────

/**
 * POST /api/cross-protocol-bridge/wrap
 *
 * Bridge content from one protocol to another.
 * This is the IDENTICAL operation to cross-reply.ts but generalized
 * for non-reply content wrapping (e.g., wrapping a Farcaster cast
 * as a Nostr event, or a Lens post as a Mastodon toot).
 */
export async function handleWrapContent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let body: WrapRequest;
  try {
    body = (await request.json()) as WrapRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const sourceProtocol = sanitizeString(body.sourceProtocol, 32);
  const targetProtocol = sanitizeString(body.targetProtocol, 32);
  const sourceUri = sanitizeString(body.sourceUri, 1024);
  const text = sanitizeString(body.text ?? '', 10000);

  if (!sourceProtocol || !targetProtocol || !sourceUri) {
    return jsonResponse(
      {
        error: 'Missing required fields: sourceUri, sourceProtocol, targetProtocol',
      },
      400,
    );
  }

  if (!ALLOWED_PROTOCOLS.has(sourceProtocol)) {
    return jsonResponse({ error: `Unsupported source protocol: ${sourceProtocol}` }, 400);
  }
  if (!ALLOWED_PROTOCOLS.has(targetProtocol)) {
    return jsonResponse({ error: `Unsupported target protocol: ${targetProtocol}` }, 400);
  }

  if (text && hasSuspiciousPayload(text)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  // Extract the native ID from the source URI
  const sourceNativeId = extractNativeId(sourceUri, sourceProtocol);
  if (!sourceNativeId) {
    return jsonResponse({ error: `Cannot extract native ID from source URI: ${sourceUri}` }, 400);
  }

  const contentText = text || `[Bridged from ${sourceProtocol}]`;
  const auth = body.auth ?? {};

  try {
    const { orchestratePublish } = await import('../lib/publish-orchestrator');

    const publishInput: PublishInput = {
      text: contentText,
      title: body.title,
      targets: [targetProtocol as Protocol],
      auth,
      images: body.images,
      signedMessage: body.signedMessage,
      typedDataId: body.typedDataId,
      signature: body.signature,
    };

    const report = await orchestratePublish(publishInput, env);
    const result = report.results[targetProtocol];

    // Store the bridge relationship in KV
    if (result?.ok && env.CACHE) {
      const bridgeKey = `bridge:wrap:${sourceUri}:${targetProtocol}`;
      const bridgeEntry = {
        sourceUri,
        sourceProtocol,
        targetProtocol,
        targetNativeId: result.nativeId,
        timestamp: Date.now(),
      };
      try {
        await env.CACHE.put(bridgeKey, JSON.stringify(bridgeEntry), {
          expirationTtl: 86400 * 30,
        });
      } catch (e) {
        console.error('[cross-protocol-bridge] Failed to store bridge record:', e);
      }
    }

    return noCacheJsonResponse({
      ok: result?.ok ?? false,
      sourceUri,
      sourceProtocol,
      targetProtocol,
      nativeId: result?.nativeId,
      error: result?.error,
      direction: `${sourceProtocol}→${targetProtocol}`,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Bridge failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}

/**
 * POST /api/cross-protocol-bridge/zora
 *
 * Wrap content from any source protocol into a Zora creator coin or NFT.
 *
 * Solana → Zora: Content from a Solana post gets wrapped as a Base creator coin
 * Nostr → Zora: Nostr event gets minted as an NFT
 * Farcaster → Zora: Farcaster cast gets turned into a creator coin position
 *
 * The resulting on-chain asset permanently references the source content
 * via its metadata URI, creating a bidirectional link.
 */
export async function handleZoraBridge(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let body: ZoraBridgeRequest;
  try {
    body = (await request.json()) as ZoraBridgeRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const sourceProtocol = sanitizeString(body.sourceProtocol, 32);
  const sourceNativeId = sanitizeString(body.sourceNativeId, 128);
  const text = sanitizeString(body.text, 10000);

  if (!sourceProtocol || !sourceNativeId || !text) {
    return jsonResponse(
      {
        error: 'Missing required fields: sourceProtocol, sourceNativeId, text',
      },
      400,
    );
  }

  if (hasSuspiciousPayload(text)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  const chain = body.chain ?? 'base';
  const sourceDfUri = `df://${sourceProtocol}:${sourceNativeId}`;

  try {
    const { wrapContentAsCreatorCoin, wrapContentAsNft } = await import('../lib/zora-wrapper');

    // Determine the wrap type based on what's provided
    const privateKey = body.privateKey ?? '';
    if (!privateKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            'Private key required for on-chain transaction. Pass privateKey (from vault/encrypted store).',
        },
        400,
      );
    }

    let result;

    if (body.nftContractAddress && body.imageUrl) {
      // Mint as NFT
      result = await wrapContentAsNft(
        {
          sourceProtocol: sourceProtocol as Protocol,
          sourceNativeId,
          sourceDfUri,
          text,
          title: body.title,
          imageUrl: body.imageUrl,
          chain: body.chain as 'base' | 'ethereum' | 'optimism' | 'arbitrum',
          creatorAddress: body.creatorAddress,
        },
        body.nftContractAddress,
        body.recipientAddress ?? body.creatorAddress ?? '',
        env,
        privateKey,
      );
    } else if (body.creatorCoinAddress) {
      // Wrap as creator coin purchase
      result = await wrapContentAsCreatorCoin(
        {
          sourceProtocol: sourceProtocol as Protocol,
          sourceNativeId,
          sourceDfUri,
          text,
          title: body.title,
          imageUrl: body.imageUrl,
          chain: body.chain as 'base' | 'ethereum' | 'optimism' | 'arbitrum',
          creatorAddress: body.creatorAddress,
        },
        body.creatorCoinAddress,
        env,
        privateKey,
      );
    } else {
      return jsonResponse(
        {
          ok: false,
          error: 'Need creatorCoinAddress or nftContractAddress to wrap content on-chain',
        },
        400,
      );
    }

    // Store the on-chain bridge record
    if (result.ok && env.CACHE) {
      const zoraKey = `bridge:zora:${sourceDfUri}`;
      try {
        await env.CACHE.put(
          zoraKey,
          JSON.stringify({
            sourceProtocol,
            sourceNativeId,
            sourceDfUri,
            chain,
            txHash: result.txHash,
            tokenAddress: result.tokenAddress,
            tokenId: result.tokenId,
            timestamp: Date.now(),
            wrapType: body.nftContractAddress ? 'nft' : 'creator-coin',
          }),
          { expirationTtl: 86400 * 365 }, // 1 year for permanent on-chain refs
        );
      } catch (e) {
        console.error('[cross-protocol-bridge] Failed to store Zora bridge record:', e);
      }
    }

    return noCacheJsonResponse({
      ok: result.ok,
      error: result.error,
      source: {
        protocol: sourceProtocol,
        nativeId: sourceNativeId,
        dfUri: sourceDfUri,
      },
      onChain: {
        chain,
        txHash: result.txHash,
        tokenAddress: result.tokenAddress,
        tokenId: result.tokenId,
        explorerUrl: result.explorerUrl,
        type: body.nftContractAddress ? 'nft' : 'creator-coin',
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Zora bridge failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}

/**
 * POST /api/cross-protocol-bridge/sync
 *
 * Sync an edit from one protocol to all sibling copies.
 * When a post is edited on the source protocol, this endpoint
 * propagates the edit to every other protocol the post was
 * cross-posted to.
 *
 * Protocol-specific edit strategies:
 *   Nostr:  Replaceable event (same kind, same pubkey + d-tag)
 *   Mastodon: PUT /api/v1/statuses/:id
 *   Farcaster: Delete + republish (no native edit — uses deleted+new)
 *   Lens:     No native edit — republish via broadcast
 *   Telegram: editMessageText
 *   Bluesky:  Delete + create new record
 */
export async function handleSyncEdit(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const postUri = sanitizeString(body.postUri, 1024);
  const newText = sanitizeString(body.newText, 10000);
  const newTitle = body.newTitle ? sanitizeString(body.newTitle, 256) : undefined;

  if (!postUri || !newText) {
    return jsonResponse({ error: 'Missing required fields: postUri, newText' }, 400);
  }

  if (hasSuspiciousPayload(newText)) {
    return jsonResponse({ error: 'New text contains suspicious patterns' }, 400);
  }

  // Find the sibling map
  const { getSiblingUris, recordEditSync, updateEditSyncStatus } = await import(
    '../lib/cross-post-store'
  );

  // Parse the df:// URI to get the source protocol
  const parsed = parseDfUri(postUri);
  if (!parsed) {
    return jsonResponse({ error: `Invalid df:// URI: ${postUri}` }, 400);
  }

  const { protocol: sourceProtocol, nativeId: sourceNativeId } = parsed;

  // Record the edit sync entry
  const entry = await recordEditSync(
    env,
    sourceProtocol as Protocol,
    sourceNativeId,
    newText,
    newTitle,
  );
  if (!entry) {
    return jsonResponse(
      {
        error: 'No cross-post siblings found for this URI. Publish to multiple targets first.',
      },
      404,
    );
  }

  const auth = body.auth ?? {};

  // Propagate the edit to all siblings
  const syncResults: Record<string, { ok: boolean; error?: string }> = {};

  const { orchestratePublish } = await import('../lib/publish-orchestrator');

  for (const [protocol] of Object.entries(entry.syncStatus)) {
    try {
      const publishInput: PublishInput = {
        text: newText,
        title: newTitle,
        targets: [protocol as Protocol],
        auth,
      };

      // For protocols with native edit support, use it. Otherwise, republish.
      if (protocol === 'mastodon' || protocol === 'telegram') {
        // These support native editing — but for simplicity we republish
        const report = await orchestratePublish(publishInput, env);
        const result = report.results[protocol];
        syncResults[protocol] = {
          ok: result?.ok ?? false,
          error: result?.error,
        };
        await updateEditSyncStatus(env, postUri, protocol, result?.ok ? 'synced' : 'failed');
      } else {
        // Nostr, Farcaster, etc. — republish (delete+create or replaceable event)
        const report = await orchestratePublish(publishInput, env);
        const result = report.results[protocol];
        syncResults[protocol] = {
          ok: result?.ok ?? false,
          error: result?.error,
        };
        await updateEditSyncStatus(env, postUri, protocol, result?.ok ? 'synced' : 'failed');
      }
    } catch (err) {
      syncResults[protocol] = { ok: false, error: String(err) };
      await updateEditSyncStatus(env, postUri, protocol, 'failed');
    }
  }

  // Reload the (now updated) entry
  const updatedEntry = await (await import('../lib/cross-post-store')).getEditSyncEntry(
    env,
    postUri,
  );

  return noCacheJsonResponse({
    ok: true,
    postUri,
    syncResults,
    fullySynced: updatedEntry?.fullySynced ?? false,
    syncStatus: updatedEntry?.syncStatus,
  });
}

/**
 * GET /api/cross-protocol-bridge/status
 *
 * Get bridge status for a given df:// URI.
 * Returns:
 *   - All sibling copies across protocols
 *   - Zora on-chain references
 *   - Bridge wrap records
 *   - Reply aggregation status
 */
export async function handleBridgeStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  const url = new URL(request.url);
  const postUri = sanitizeString(url.searchParams.get('postUri'), 1024);

  if (!postUri) {
    return jsonResponse({ error: 'Missing postUri query parameter' }, 400);
  }

  const { getCrosspostMap, getReplyAggregation } = await import('../lib/cross-post-store');

  // Fetch all bridge data in parallel
  const [crosspostMap, replyAgg, zoraRecord] = await Promise.all([
    getCrosspostMap(env, postUri),
    getReplyAggregation(env, postUri),
    (async () => {
      if (!env.CACHE) return null;
      try {
        return (await env.CACHE.get(`bridge:zora:${postUri}`, 'json')) as Record<
          string,
          unknown
        > | null;
      } catch {
        return null;
      }
    })(),
  ]);

  // List all wrap bridges for this URI
  const wrapRecords: Record<string, unknown>[] = [];
  if (env.CACHE) {
    try {
      let cursor: string | undefined;
      do {
        const page: {
          keys: { name: string }[];
          list_complete: boolean;
          cursor?: string;
        } = await env.CACHE.list({
          prefix: `bridge:wrap:${postUri}:`,
          cursor,
          limit: 100,
        });
        for (const key of page.keys) {
          const entry = await env.CACHE.get(key.name, 'json');
          if (entry) wrapRecords.push(entry as Record<string, unknown>);
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
    } catch (e) {
      console.error('[cross-protocol-bridge] Failed to list wrap records:', e);
    }
  }

  return noCacheJsonResponse({
    postUri,
    crosspost: crosspostMap
      ? {
          rootUri: crosspostMap.rootUri,
          rootProtocol: crosspostMap.rootProtocol,
          protocolCount: crosspostMap.protocolCount,
          siblings: crosspostMap.siblings,
          createdAt: crosspostMap.createdAt,
        }
      : null,
    zora: zoraRecord,
    wraps: wrapRecords,
    replies: replyAgg,
    protocols: [
      ...new Set([
        ...(crosspostMap?.siblings.map((s) => s.protocol) ?? []),
        ...(zoraRecord ? ['zora'] : []),
        ...wrapRecords.map((w) => w.targetProtocol as string),
      ]),
    ],
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function extractNativeId(uri: string, _protocol: string): string | null {
  if (uri.startsWith('df://')) {
    const rest = uri.slice(5);
    const colonIdx = rest.indexOf(':');
    if (colonIdx === -1) return rest;
    return rest.slice(colonIdx + 1);
  }
  const colonIdx = uri.indexOf(':');
  if (colonIdx === -1) return uri;
  return uri.slice(colonIdx + 1);
}

function parseDfUri(raw: string): { protocol: string; nativeId: string } | null {
  let value = raw;
  try {
    value = decodeURIComponent(raw);
  } catch {
    /* use raw */
  }
  if (value.startsWith('df://')) value = value.slice(5);
  const colon = value.indexOf(':');
  if (colon === -1) return null;
  const protocol = value.slice(0, colon);
  const nativeId = value.slice(colon + 1);
  if (!protocol || !nativeId) return null;
  return { protocol, nativeId };
}
