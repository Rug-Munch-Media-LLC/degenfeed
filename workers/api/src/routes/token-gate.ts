/**
 * @degenfeed/api-worker — Enhanced Token Gate Verification API
 *
 * Endpoints:
 *   POST /api/token-gate/verify        — Verify user holds required token
 *   POST /api/token-gate/verify-multi   — Verify combined/tiered gate config
 *   POST /api/token-gate/gate-content   — Store gate config for content
 *   GET  /api/token-gate/gate/:id       — Get gate config for content
 *   GET  /api/token-gate/:postId        — Get token gate for a post (legacy)
 *
 * Gate types supported:
 *   - Single token/NFT gate
 *   - Combined gates (AND/OR logic)
 *   - Tiered gates (different access levels)
 *   - Time-based holding requirements
 */

import {
  checkGateConfig,
  checkTokenGate,
  type GateCheckResult,
  type GateConfig,
  resolveTokenGateSymbol,
  type TokenGate,
} from '@degenfeed/token-gate';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';

// ─── KV cache constants ────────────────────────────────────────────────────

const CACHE_TTL_SEC = 300; // 5 minutes
const CACHE_KV_PREFIX = 'token-gate:verify:';
const GATE_CONFIG_PREFIX = 'gate-config:';

// ─── POST /api/token-gate/verify ─────────────────────────────────────────

interface VerifyRequest {
  gate?: TokenGate;
  walletAddress?: string;
}

export async function handleTokenGateVerify(request: Request, env: Env): Promise<Response> {
  let body: VerifyRequest;
  try {
    body = (await request.json()) as VerifyRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const gate = body.gate;
  if (!gate?.chain || !gate.type || !gate.contractAddress) {
    return jsonResponse(
      { error: 'Token gate config required (chain, type, contractAddress)' },
      400,
    );
  }

  // Validate chain
  const validChains = ['ethereum', 'base', 'polygon', 'solana', 'arbitrum', 'optimism'];
  if (!validChains.includes(gate.chain)) {
    return jsonResponse({ error: `Invalid chain: ${gate.chain}` }, 400);
  }

  // Validate type
  const validTypes = ['erc20', 'erc721', 'erc1155'];
  if (!validTypes.includes(gate.type)) {
    return jsonResponse({ error: `Invalid token type: ${gate.type}` }, 400);
  }

  // Validate contract address
  const contractAddress = sanitizeString(gate.contractAddress, 64);
  if (!contractAddress) {
    return jsonResponse({ error: 'Invalid contract address' }, 400);
  }
  gate.contractAddress = contractAddress;

  const walletAddress = sanitizeString(body.walletAddress, 64);
  if (!walletAddress) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  // Validate wallet address format
  if (gate.chain === 'solana') {
    if (walletAddress.length < 32 || walletAddress.length > 44) {
      return jsonResponse({ error: 'Invalid Solana wallet address' }, 400);
    }
  } else {
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return jsonResponse({ error: 'Invalid EVM wallet address' }, 400);
    }
  }

  // Check cache first
  const cacheKey = buildCacheKey(gate, walletAddress);
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as { holds: boolean };
        return noCacheJsonResponse(parsed);
      }
    } catch {
      // Cache hiccup — fall through to on-chain check
    }
  }

  // Verify on-chain
  try {
    const holds = await checkTokenGate(gate, walletAddress);

    // Cache the result
    if (env.CACHE) {
      try {
        await env.CACHE.put(cacheKey, JSON.stringify({ holds }), {
          expirationTtl: CACHE_TTL_SEC,
        });
      } catch {
        // Non-fatal cache write failure
      }
    }

    return noCacheJsonResponse({ holds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/token-gate/verify-multi — Verify combined/tiered gates ───

interface VerifyMultiRequest {
  config?: GateConfig;
  walletAddress?: string;
}

export async function handleTokenGateVerifyMulti(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: VerifyMultiRequest;
  try {
    body = (await request.json()) as VerifyMultiRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const config = body.config;
  if (!config || !config.type || !config.enabled !== undefined) {
    return jsonResponse({ error: 'Gate config required (type, enabled)' }, 400);
  }

  const walletAddress = sanitizeString(body.walletAddress ?? session.address, 64);
  if (!walletAddress) {
    return jsonResponse({ error: 'Wallet address required' }, 400);
  }

  try {
    const result: GateCheckResult = await checkGateConfig(config, walletAddress);

    // Cache results for tiered gates (5 min)
    if (env.CACHE && config.type !== 'tiered') {
      try {
        const tierCacheKey = `${CACHE_KV_PREFIX}multi:${JSON.stringify(config).slice(0, 100)}:${walletAddress.toLowerCase()}`;
        await env.CACHE.put(tierCacheKey, JSON.stringify(result), {
          expirationTtl: CACHE_TTL_SEC,
        });
      } catch {
        // Non-fatal
      }
    }

    return noCacheJsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return jsonResponse({ error: message }, 500);
  }
}

// ─── POST /api/token-gate/gate-content — Store gate config for content ───

interface GateContentRequest {
  contentId?: string;
  contentType?: string;
  config?: GateConfig;
}

export async function handleTokenGateContent(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: GateContentRequest;
  try {
    body = (await request.json()) as GateContentRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const contentId = sanitizeString(body.contentId, 256);
  const contentType = sanitizeString(body.contentType, 32) || 'post';
  const config = body.config;

  if (!contentId) {
    return jsonResponse({ error: 'contentId required' }, 400);
  }

  if (!config || config.enabled === undefined) {
    return jsonResponse({ error: 'Gate config required' }, 400);
  }

  // Validate gate type
  const validGateTypes = ['single', 'combined', 'tiered'];
  if (config.type && !validGateTypes.includes(config.type)) {
    return jsonResponse({ error: `Invalid gate type: ${config.type}` }, 400);
  }

  // Validate content type
  const validContentTypes = ['post', 'feed', 'community', 'stream', 'ama', 'file', 'download'];
  if (contentType && !validContentTypes.includes(contentType)) {
    return jsonResponse({ error: `Invalid content type: ${contentType}` }, 400);
  }

  // Store the gate configuration
  const gateKey = `${GATE_CONFIG_PREFIX}${contentType}:${contentId}`;
  const gateData = {
    ...config,
    contentType: contentType as GateContentRequest['contentType'],
    createdBy: session.address,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    await env.CACHE?.put(gateKey, JSON.stringify(gateData), {
      expirationTtl: 60 * 60 * 24 * 365, // 1 year
    });
    return noCacheJsonResponse({ success: true, gateKey });
  } catch {
    return jsonResponse({ error: 'Storage unavailable' }, 500);
  }
}

// ─── GET /api/token-gate/gate/:contentType/:contentId — Get gate config ───

export async function handleTokenGateGet(
  _request: Request,
  env: Env,
  contentType: string,
  contentId: string,
): Promise<Response> {
  const sanitizedContentType = sanitizeString(contentType, 32);
  const sanitizedContentId = sanitizeString(contentId, 256);

  if (!sanitizedContentType || !sanitizedContentId) {
    return jsonResponse({ error: 'Invalid content type or id' }, 400);
  }

  const gateKey = `${GATE_CONFIG_PREFIX}${sanitizedContentType}:${sanitizedContentId}`;

  try {
    const raw = await env.CACHE?.get(gateKey);
    if (!raw) {
      return jsonResponse({ gate: null, message: 'No gate configured for this content' });
    }
    const gateConfig = JSON.parse(raw);
    return jsonResponse({ gate: gateConfig });
  } catch {
    return jsonResponse({ error: 'Failed to retrieve gate config' }, 500);
  }
}

// ─── DELETE /api/token-gate/gate/:contentType/:contentId — Remove gate ───

export async function handleTokenGateDelete(
  request: Request,
  env: Env,
  contentType: string,
  contentId: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const sanitizedContentType = sanitizeString(contentType, 32);
  const sanitizedContentId = sanitizeString(contentId, 256);

  if (!sanitizedContentType || !sanitizedContentId) {
    return jsonResponse({ error: 'Invalid content type or id' }, 400);
  }

  const gateKey = `${GATE_CONFIG_PREFIX}${sanitizedContentType}:${sanitizedContentId}`;

  try {
    await env.CACHE?.delete(gateKey);
    return jsonResponse({ success: true, message: 'Gate removed' });
  } catch {
    return jsonResponse({ error: 'Failed to remove gate config' }, 500);
  }
}

// ─── GET /api/token-gate/resolve — Resolve gate symbol ───────────────────

interface ResolveRequest {
  gate?: TokenGate;
}

export async function handleTokenGateResolve(request: Request, _env: Env): Promise<Response> {
  let body: ResolveRequest;
  try {
    body = (await request.json()) as ResolveRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const gate = body.gate;
  if (!gate?.chain || !gate.type || !gate.contractAddress) {
    return jsonResponse({ error: 'Token gate config required' }, 400);
  }

  try {
    const symbol = await resolveTokenGateSymbol(gate);
    return noCacheJsonResponse({ symbol });
  } catch {
    return jsonResponse({ error: 'Could not resolve token symbol' }, 500);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildCacheKey(gate: TokenGate, walletAddress: string): string {
  const parts = [
    gate.chain,
    gate.contractAddress.toLowerCase(),
    gate.tokenId ?? '',
    gate.type,
    walletAddress.toLowerCase(),
  ];
  return `${CACHE_KV_PREFIX}${parts.join(':')}`;
}
