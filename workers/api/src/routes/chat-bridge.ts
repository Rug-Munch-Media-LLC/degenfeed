/**
 * /api/chat/bridge — Protocol Bridge Management
 *
 * Routes:
 *   POST /api/chat/bridge/:protocol/enable   — Enable a protocol bridge
 *   POST /api/chat/bridge/:protocol/disable  — Disable a protocol bridge
 *   GET  /api/chat/bridge/status             — Bridge health per protocol
 *   GET  /api/chat/bridge/:protocol/health   — Health check for specific protocol
 *
 * Matrix is the universal hub. All protocols bridge THROUGH Matrix.
 * One Matrix room = one DegenFeed chat conversation.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// Lazy-load the chat super-app
let _matrixHub: typeof import('@degenfeed/chat-super-app').MatrixHub | null = null;
async function getHub() {
  if (!_matrixHub) {
    const mod = await import('@degenfeed/chat-super-app');
    _matrixHub = mod.getMatrixHub();
  }
  return _matrixHub!;
}

const SUPPORTED_PROTOCOLS = [
  'nostr',
  'lens',
  'bluesky',
  'farcaster',
  'mastodon',
  'activitypub',
  'telegram',
  'discord',
  'irc',
  'xmpp',
  'signal',
  'session',
  'xmtp',
] as const;

type ProtocolStr = (typeof SUPPORTED_PROTOCOLS)[number];

function isValidProtocol(p: string): p is ProtocolStr {
  return SUPPORTED_PROTOCOLS.includes(p as ProtocolStr);
}

// ─── POST /api/chat/bridge/:protocol/enable ──────────────────────────────

export async function handleEnableBridge(
  request: Request,
  env: Env,
  protocol: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
  }

  try {
    const hub = await getHub();

    // Initialize the hub if not already
    await hub.initialize(env);

    // Read optional config from body
    let body: Record<string, string> = {};
    try {
      body = (await request.json()) as Record<string, string>;
    } catch {
      // No body — use defaults
    }

    const config = await hub.enableBridge(env, protocol, {
      nativeEndpoint: body.nativeEndpoint,
      nativeToken: body.nativeToken,
      metadata: body.metadata ? JSON.parse(body.metadata) : {},
    });

    return jsonResponse(
      {
        ok: true,
        protocol,
        roomId: config.roomId,
        bridgeType: config.bridgeType,
        status: 'enabled',
      },
      200,
    );
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to enable bridge',
      },
      500,
    );
  }
}

// ─── POST /api/chat/bridge/:protocol/disable ─────────────────────────────

export async function handleDisableBridge(
  request: Request,
  env: Env,
  protocol: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
  }

  try {
    const hub = await getHub();
    await hub.initialize(env);
    await hub.disableBridge(env, protocol);

    return jsonResponse({ ok: true, protocol, status: 'disabled' }, 200);
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to disable bridge',
      },
      500,
    );
  }
}

// ─── GET /api/chat/bridge/status ─────────────────────────────────────────

export async function handleBridgeStatus(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const hub = await getHub();
    await hub.initialize(env);
    const statuses = await hub.getBridgeStatuses(env);

    return noCacheJsonResponse({
      ok: true,
      matrixHub: {
        url: env.MATRIX_INSTANCE_URL || 'http://localhost:8448',
        connected: await hub.checkConduitHealth(),
      },
      bridges: statuses,
      totalProtocols: statuses.length,
      activeBridges: statuses.filter((s) => s.enabled).length,
      healthyBridges: statuses.filter((s) => s.healthy).length,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to get bridge status',
      },
      500,
    );
  }
}

// ─── GET /api/chat/bridge/:protocol/health ───────────────────────────────

export async function handleProtocolHealth(
  _request: Request,
  env: Env,
  protocol: string,
): Promise<Response> {
  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
  }

  try {
    const hub = await getHub();
    await hub.initialize(env);
    const statuses = await hub.getBridgeStatuses(env);
    const status = statuses.find((s) => s.protocol === protocol);

    if (!status) {
      return jsonResponse({ error: `Bridge not found: ${protocol}` }, 404);
    }

    return noCacheJsonResponse({ ok: true, ...status });
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Health check failed',
        protocol,
        healthy: false,
      },
      200,
    ); // Return 200 with healthy:false rather than 500
  }
}

// ─── POST /api/chat/bridge/:protocol/send — Send via bridged protocol ────

export async function handleBridgeSend(
  request: Request,
  env: Env,
  protocol: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!isValidProtocol(protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
  }

  let body: { conversationId: string; body: string; toId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.body || !body.toId) {
    return jsonResponse({ error: 'Missing required fields: conversationId, body, toId' }, 400);
  }

  try {
    const hub = await getHub();
    await hub.initialize(env);

    const bridgeMessage = {
      id: crypto.randomUUID(),
      roomId: body.conversationId,
      senderId: session.address,
      senderProtocol: protocol as any,
      body: body.body,
      encrypted: false,
      bridgedTo: [],
      timestamp: Date.now(),
    };

    const result = await hub.routeMessage(env, bridgeMessage, protocol as any);

    return jsonResponse(
      {
        ok: result.delivered.length > 0,
        messageId: bridgeMessage.id,
        delivered: result.delivered,
        failed: result.failed,
      },
      result.delivered.length > 0 ? 200 : 202,
    );
  } catch (err) {
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Failed to send via bridge',
      },
      500,
    );
  }
}
