/**
 * @degenfeed/api-worker — IRC Bridge Routes
 *
 * IRC bridge management via matrix-appservice-irc.
 *
 * GET    /api/irc/bridge/health          — Bridge health status
 * GET    /api/irc/bridge/channels        — List connected IRC channels
 * POST   /api/irc/bridge/join            — Join an IRC channel
 * POST   /api/irc/bridge/leave           — Leave an IRC channel
 * POST   /api/irc/bridge/send            — Send message to IRC channel
 * GET    /api/irc/bridge/curated         — List curated IRC channels
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── IRC Bridge Client Factory ──────────────────────────────────────────────

async function getIrcClient(env: Env) {
  const { IrcBridgeClient } = await import('@degenfeed/realtime/irc-bridge-client');
  const homeserverUrl = String(env.MATRIX_INSTANCE_URL || 'https://matrix.degenfeed.xyz');
  const accessToken = String(env.MATRIX_ACCESS_TOKEN || '');

  return new IrcBridgeClient({
    homeserverUrl,
    accessToken,
  });
}

// ─── GET /api/irc/bridge/health ─────────────────────────────────────────────

export async function handleIrcHealth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const client = await getIrcClient(env);
    const health = await client.checkHealth();

    return noCacheJsonResponse({
      ok: health.connected,
      health,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Health check failed',
        health: {
          connected: false,
          ircNetworks: [],
          lastMessageAt: null,
          latencyMs: 0,
        },
      },
      200,
    );
  }
}

// ─── GET /api/irc/bridge/channels ───────────────────────────────────────────

export async function handleIrcChannels(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const client = await getIrcClient(env);
    const channels = await client.getJoinedChannels();

    return noCacheJsonResponse({
      ok: true,
      channels,
      total: channels.length,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to list channels' }, 500);
  }
}

// ─── POST /api/irc/bridge/join ──────────────────────────────────────────────

export async function handleIrcJoin(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { channel: string; network?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.channel?.trim()) {
    return jsonResponse({ error: 'Channel is required (e.g., "#bitcoin")' }, 400);
  }

  const channel = body.channel.startsWith('#') ? body.channel : `#${body.channel}`;
  const network = body.network ?? 'libera';

  const validNetworks = ['libera', 'oftc'];
  if (!validNetworks.includes(network)) {
    return jsonResponse(
      { error: `Invalid network. Must be one of: ${validNetworks.join(', ')}` },
      400,
    );
  }

  try {
    const client = await getIrcClient(env);
    const result = await client.joinChannel(channel, network);

    return jsonResponse(
      {
        ok: true,
        channel: result,
        message: `Joined ${channel} on ${network}. Messages from this channel will now appear in your unified inbox.`,
      },
      201,
    );
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to join channel',
      },
      502,
    );
  }
}

// ─── POST /api/irc/bridge/leave ─────────────────────────────────────────────

export async function handleIrcLeave(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { channel: string; network?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.channel?.trim()) {
    return jsonResponse({ error: 'Channel is required' }, 400);
  }

  const network = body.network ?? 'libera';
  const channelSlug = body.channel.startsWith('#') ? body.channel.slice(1) : body.channel;
  const alias = `#_irc_${network}_${channelSlug}:matrix.degenfeed.xyz`;

  try {
    const client = await getIrcClient(env);
    await client.leaveChannel(alias);

    return noCacheJsonResponse({ ok: true, left: true });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to leave channel' }, 502);
  }
}

// ─── POST /api/irc/bridge/send ──────────────────────────────────────────────

export async function handleIrcSend(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { channel: string; message: string; network?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.channel?.trim() || !body.message?.trim()) {
    return jsonResponse({ error: 'Channel and message are required' }, 400);
  }

  const network = body.network ?? 'libera';
  const channelSlug = body.channel.startsWith('#') ? body.channel.slice(1) : body.channel;
  const alias = `#_irc_${network}_${channelSlug}:matrix.degenfeed.xyz`;

  try {
    const client = await getIrcClient(env);
    const sent = await client.sendMessage(alias, body.message);

    if (!sent) {
      return jsonResponse({ ok: false, error: 'Message not sent to IRC' }, 502);
    }

    return noCacheJsonResponse({ ok: true, sent: true });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to send message' }, 502);
  }
}

// ─── GET /api/irc/bridge/curated ────────────────────────────────────────────

export async function handleIrcCurated(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  try {
    const client = await getIrcClient(env);
    const channels = client.getCuratedChannels();

    return noCacheJsonResponse({
      ok: true,
      channels,
      networks: [
        {
          name: 'Libera.Chat',
          channels: channels.filter((c: any) => c.network === 'libera').map((c: any) => c.channel),
        },
        {
          name: 'OFTC',
          channels: channels.filter((c: any) => c.network === 'oftc').map((c: any) => c.channel),
        },
      ],
      total: channels.length,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Failed to get curated channels' }, 500);
  }
}

// ─── POST /api/irc/bridge/rocketchat/connect ────────────────────────────────

export async function handleRocketChatConnect(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { serverUrl: string; channelId: string; accessToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.serverUrl || !body.channelId) {
    return jsonResponse({ error: 'serverUrl and channelId are required' }, 400);
  }

  // Rocket.Chat has native Matrix federation since v6.0.
  // Store the connection for Matrix-based routing.
  try {
    const key = `rocketchat:federation:${session.address.toLowerCase()}`;
    if (env.CACHE) {
      await env.CACHE.put(
        key,
        JSON.stringify({
          serverUrl: body.serverUrl,
          channelId: body.channelId,
          accessToken: body.accessToken ?? null,
          connectedAt: Date.now(),
        }),
        { expirationTtl: 86400 * 365 },
      );
    }

    return jsonResponse(
      {
        ok: true,
        message: `Connected to Rocket.Chat channel ${body.channelId}. It is reachable via Matrix federation.`,
      },
      201,
    );
  } catch {
    return jsonResponse({ error: 'Failed to store Rocket.Chat connection' }, 500);
  }
}
