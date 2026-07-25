/**
 * /api/dedup/* — Cross-platform deduplication API.
 *
 * Routes:
 *   POST /api/dedup/check          — Check if content is duplicate
 *   POST /api/dedup/register       — Register content in dedup registry
 *   GET  /api/dedup/cluster/:id    — Get all copies of same content
 *   POST /api/dedup/mark-seen      — Mark content as seen by user
 *   GET  /api/dedup/seen/stats     — User's seen content stats
 *
 * All routes accept JSON request bodies and return JSON responses.
 * Seen-related routes require a wallet session.
 */

import type { Env } from '../index';
import { jsonResponse } from '../index';
import { type DedupCheckRequest, GlobalDedupRegistry } from '../lib/global-dedup';
import { SeenContentManager } from '../lib/seen-content';
import { verifySessionCookie } from '../session';

// ─── Session Helper ───────────────────────────────────────────────────────

async function getWalletFromSession(request: Request, env: Env): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const match = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('__Host-dfid='));
  if (!match || !env.AUTH_SECRET) return null;
  const cookieValue = match.slice('__Host-dfid='.length);
  try {
    const payload = await verifySessionCookie(cookieValue, env.AUTH_SECRET);
    return payload?.address ?? null;
  } catch {
    return null;
  }
}

// ─── POST /api/dedup/check ───────────────────────────────────────────────

export async function handleDedupCheck(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as DedupCheckRequest;

    // Validate
    if (!body.protocol || !body.sourceId) {
      return jsonResponse({ error: 'protocol and sourceId are required' }, 400);
    }
    if (!body.text && !body.title && !body.url && !body.rssGuid) {
      return jsonResponse(
        { error: 'At least one of text, title, url, or rssGuid is required' },
        400,
      );
    }

    const registry = new GlobalDedupRegistry(env);
    const result = await registry.checkDuplicate(body);

    return jsonResponse({
      isDuplicate: result.isDuplicate,
      method: result.method,
      clusterId: result.clusterId,
      confidence: result.confidence,
      copyCount: result.copyCount,
      protocols: result.protocols,
      canonicalReference: result.canonicalReference,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid request: ${msg}` }, 400);
  }
}

// ─── POST /api/dedup/register ─────────────────────────────────────────────

export async function handleDedupRegister(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as DedupCheckRequest;

    // Validate
    if (!body.protocol || !body.sourceId) {
      return jsonResponse({ error: 'protocol and sourceId are required' }, 400);
    }

    const registry = new GlobalDedupRegistry(env);
    const result = await registry.register(body);

    return jsonResponse({
      clusterId: result.clusterId,
      isNew: result.isNew,
      registered: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid request: ${msg}` }, 400);
  }
}

// ─── GET /api/dedup/cluster/:id ───────────────────────────────────────────

export async function handleDedupCluster(
  _request: Request,
  env: Env,
  clusterId: string,
): Promise<Response> {
  if (!clusterId) {
    return jsonResponse({ error: 'clusterId parameter is required' }, 400);
  }

  const registry = new GlobalDedupRegistry(env);
  const cluster = await registry.getCluster(clusterId);

  if (!cluster) {
    return jsonResponse({ error: 'Cluster not found' }, 404);
  }

  return jsonResponse({
    clusterId: cluster.clusterId,
    canonicalHash: cluster.canonicalHash,
    copyCount: cluster.copyCount,
    protocols: cluster.protocols,
    createdAt: cluster.createdAt,
    updatedAt: cluster.updatedAt,
    copies: cluster.copies.map((c) => ({
      sourceProtocol: c.sourceProtocol,
      sourceId: c.sourceId,
      firstSeen: c.firstSeen,
      contentHash: c.contentHash,
      titleFingerprint: c.titleFingerprint,
    })),
  });
}

// ─── POST /api/dedup/mark-seen ────────────────────────────────────────────

export async function handleDedupMarkSeen(request: Request, env: Env): Promise<Response> {
  const wallet = await getWalletFromSession(request, env);
  if (!wallet) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  try {
    const body = (await request.json()) as {
      fingerprintHash: string;
      clusterId: string;
      protocol: string;
      sourceId: string;
      liked?: boolean;
      engaged?: boolean;
      dwellTime?: number;
    };

    if (!body.fingerprintHash || !body.clusterId) {
      return jsonResponse({ error: 'fingerprintHash and clusterId are required' }, 400);
    }

    const seenManager = new SeenContentManager(env);
    await seenManager.markSeen(
      wallet,
      body.fingerprintHash,
      body.clusterId,
      body.protocol || 'unknown',
      body.sourceId || '',
      { liked: body.liked, engaged: body.engaged, dwellTime: body.dwellTime },
    );

    return jsonResponse({ ok: true, seen: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid request: ${msg}` }, 400);
  }
}

// ─── POST /api/dedup/mark-seen (batch) ───────────────────────────────────

export async function handleDedupMarkSeenBatch(request: Request, env: Env): Promise<Response> {
  const wallet = await getWalletFromSession(request, env);
  if (!wallet) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  try {
    const body = (await request.json()) as {
      items: Array<{
        fingerprintHash: string;
        clusterId: string;
        protocol: string;
        sourceId: string;
        liked?: boolean;
        engaged?: boolean;
        dwellTime?: number;
      }>;
    };

    if (!body.items || body.items.length === 0) {
      return jsonResponse({ error: 'items array is required' }, 400);
    }

    const seenManager = new SeenContentManager(env);
    let marked = 0;

    for (const item of body.items) {
      if (!item.fingerprintHash || !item.clusterId) continue;
      await seenManager.markSeen(
        wallet,
        item.fingerprintHash,
        item.clusterId,
        item.protocol || 'unknown',
        item.sourceId || '',
        { liked: item.liked, engaged: item.engaged, dwellTime: item.dwellTime },
      );
      marked++;
    }

    return jsonResponse({ ok: true, marked });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid request: ${msg}` }, 400);
  }
}

// ─── GET /api/dedup/seen/stats ────────────────────────────────────────────

export async function handleDedupSeenStats(request: Request, env: Env): Promise<Response> {
  const wallet = await getWalletFromSession(request, env);
  if (!wallet) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const seenManager = new SeenContentManager(env);
  const stats = await seenManager.getStats(wallet);
  const timeStats = await seenManager.computeTimeWindowStats(wallet);

  return jsonResponse({
    totalSeen: stats.totalSeen,
    firstSeenAt: stats.firstSeenAt,
    lastSeenAt: stats.lastSeenAt,
    byProtocol: stats.byProtocol,
    seenLast24h: timeStats.last24h,
    seenLast7d: timeStats.last7d,
    engagementRate: stats.engagementRate,
    totalDwellTime: stats.totalDwellTime,
  });
}

// ─── POST /api/dedup/has-seen (batch check) ──────────────────────────────

export async function handleDedupHasSeen(request: Request, env: Env): Promise<Response> {
  const wallet = await getWalletFromSession(request, env);
  if (!wallet) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  try {
    const body = (await request.json()) as { fingerprints: string[] };

    if (!body.fingerprints || body.fingerprints.length === 0) {
      return jsonResponse({ error: 'fingerprints array is required' }, 400);
    }

    if (body.fingerprints.length > 500) {
      return jsonResponse({ error: 'Maximum 500 fingerprints per request' }, 400);
    }

    const seenManager = new SeenContentManager(env);
    const seenSet = await seenManager.filterSeen(wallet, body.fingerprints);

    return jsonResponse({
      seen: Object.fromEntries(body.fingerprints.map((fp) => [fp, seenSet.has(fp)])),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid request: ${msg}` }, 400);
  }
}

// ─── POST /api/dedup/seen/feedback — Record engagement feedback ─────────

export async function handleDedupSeenFeedback(request: Request, env: Env): Promise<Response> {
  const wallet = await getWalletFromSession(request, env);
  if (!wallet) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  try {
    const body = (await request.json()) as {
      fingerprintHash: string;
      liked?: boolean;
      engaged?: boolean;
      dwellTime?: number;
    };

    if (!body.fingerprintHash) {
      return jsonResponse({ error: 'fingerprintHash is required' }, 400);
    }

    const seenManager = new SeenContentManager(env);
    await seenManager.recordEngagement(wallet, body.fingerprintHash, {
      liked: body.liked,
      engaged: body.engaged,
      dwellTime: body.dwellTime,
    });

    return jsonResponse({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Invalid request: ${msg}` }, 400);
  }
}
