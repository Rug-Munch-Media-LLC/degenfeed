/**
 * @degenfeed/api-worker — Bridgy Fed Bridge Routes
 *
 * Routes:
 *   GET    /api/bridgy/status      — Check Bridgy Fed bridge health
 *   POST   /api/bridgy/configure   — Configure Bridgy Fed for an instance
 *   GET    /api/bridgy/users       — List users with active bridges
 *   POST   /api/bridgy/cross-post  — Cross-post content via Bridgy Fed
 *   POST   /api/bridgy/register    — Register a user's bridge
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures.
 */

import { requireAdminFromSession } from '../lib/admin-guard';
import {
  type BridgyCrossPostRequest,
  type BridgyFedConfig,
  BridgyFedService,
  type BridgyUserBridge,
} from '../lib/bridgy-service';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import type { Env } from '../types';

// ─── GET /api/bridgy/status — Bridgy Fed Bridge Health ───────────────────

export async function handleBridgyStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  try {
    const service = new BridgyFedService(env);
    const status = await service.getStatus();

    return noCacheJsonResponse({
      ok: status.ok,
      service: status.service,
      version: status.version,
      bridgyFed: status.bridgyFed,
      instances: status.instances,
      summary: {
        total: Object.keys(status.instances).length,
        connected: Object.values(status.instances).filter((i) => i.reachable && i.bridgeEnabled)
          .length,
      },
      checkedAt: status.checkedAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Bridgy Fed health check failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}

// ─── POST /api/bridgy/configure — Configure Bridgy Fed for an Instance ──

export async function handleBridgyConfigure(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  // Require admin authentication
  const admin = await requireAdminFromSession(request, env);
  if (admin instanceof Response) return admin;

  let body: BridgyFedConfig;
  try {
    body = (await request.json()) as BridgyFedConfig;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate required fields
  if (!body.id || !body.domain || !body.protocol) {
    return jsonResponse({ error: 'Missing required fields: id, domain, protocol' }, 400);
  }

  // Sanitize inputs
  body.id = sanitizeString(body.id, 64);
  body.domain = sanitizeString(body.domain, 256);
  body.name = sanitizeString(body.name || body.id, 128);

  const validProtocols = ['activitypub', 'atproto', 'web'];
  if (!validProtocols.includes(body.protocol)) {
    return jsonResponse(
      {
        error: `Invalid protocol: ${body.protocol}. Must be one of: ${validProtocols.join(', ')}`,
      },
      400,
    );
  }

  try {
    const service = new BridgyFedService(env);
    const result = await service.configureInstance({
      ...body,
      enabled: body.enabled !== false, // Default to enabled
    });

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 500);
    }

    return noCacheJsonResponse({
      ok: true,
      message: `Bridgy Fed configured for ${body.id} (${body.domain})`,
      instance: body.id,
      domain: body.domain,
      protocol: body.protocol,
      enabled: body.enabled !== false,
      note: 'Users must opt in to bridging via fed.brid.gy/login for bridging to take effect',
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Failed to configure Bridgy Fed: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}

// ─── GET /api/bridgy/users — List Bridged Users ─────────────────────────

export async function handleBridgyUsers(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }

  const url = new URL(request.url);
  const instance = url.searchParams.get('instance') || undefined;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
  const activeOnly = url.searchParams.get('activeOnly') !== 'false';

  try {
    const service = new BridgyFedService(env);
    const result = await service.getBridgedUsers({ instance, limit, activeOnly });

    return noCacheJsonResponse({
      ok: true,
      users: result.users.map((u) => ({
        userId: u.userId,
        displayName: u.displayName,
        sourceInstance: u.sourceInstance,
        sourceHandle: u.sourceHandle,
        bridgyHandle: u.bridgyHandle,
        targetNetwork: u.targetNetwork,
        active: u.active,
        bridgedAt: u.bridgedAt,
        lastActivity: u.lastActivity,
        followerCount: u.followerCount,
      })),
      meta: {
        total: result.total,
        instance: instance || 'all',
        limit,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Failed to list bridged users: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}

// ─── POST /api/bridgy/cross-post — Cross-Post via Bridgy Fed ────────────

export async function handleBridgyCrossPost(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let body: BridgyCrossPostRequest;
  try {
    body = (await request.json()) as BridgyCrossPostRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const text = sanitizeString(body.text, 10000);
  const sourceInstance = sanitizeString(body.sourceInstance, 64);

  if (!text || !sourceInstance) {
    return jsonResponse({ error: 'Missing required fields: text, sourceInstance' }, 400);
  }

  if (hasSuspiciousPayload(text)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  try {
    const service = new BridgyFedService(env);
    const result = await service.crossPost({
      text,
      sourceInstance,
      sourceUrl: body.sourceUrl,
      images: body.images,
      sourceProtocol: body.sourceProtocol,
      targetProtocols: body.targetProtocols,
      auth: body.auth,
    });

    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          sourceInstance: result.sourceInstance,
          targets: result.targets,
          error: result.error,
        },
        207, // Multi-Status — partial success
      );
    }

    return noCacheJsonResponse({
      ok: true,
      sourceInstance: result.sourceInstance,
      sourceUrl: result.sourceUrl,
      targets: result.targets,
      deliveredTo: result.targets.filter((t) => t.ok).map((t) => t.protocol),
      failed: result.targets.filter((t) => !t.ok).map((t) => t.protocol),
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Cross-post failed: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}

// ─── POST /api/bridgy/register — Register a User Bridge ────────────────

export async function handleBridgyRegisterUser(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let body: BridgyUserBridge;
  try {
    body = (await request.json()) as BridgyUserBridge;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.userId || !body.sourceHandle || !body.bridgyHandle) {
    return jsonResponse(
      { error: 'Missing required fields: userId, sourceHandle, bridgyHandle' },
      400,
    );
  }

  // Sanitize
  body.userId = sanitizeString(body.userId, 256);
  body.sourceHandle = sanitizeString(body.sourceHandle, 256);
  body.bridgyHandle = sanitizeString(body.bridgyHandle, 256);
  body.displayName = body.displayName ? sanitizeString(body.displayName, 128) : undefined;
  body.sourceInstance = sanitizeString(body.sourceInstance || 'gotosocial', 64);

  try {
    const service = new BridgyFedService(env);
    const result = await service.registerUserBridge({
      ...body,
      active: body.active !== false,
      bridgedAt: body.bridgedAt || Date.now(),
    });

    if (!result.ok) {
      return jsonResponse({ ok: false, error: result.error }, 500);
    }

    return noCacheJsonResponse({
      ok: true,
      message: `Bridge registered for ${body.sourceHandle}`,
      bridgyHandle: body.bridgyHandle,
      note: 'Bridging will take effect once the user opts in at fed.brid.gy/login',
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: `Failed to register bridge: ${err instanceof Error ? err.message : String(err)}`,
      },
      500,
    );
  }
}
