/**
 * /api/discord — Discord Bot Integration
 *
 * Connect Discord servers to DegenFeed for cross-posting stream
 * announcements, bridging chat messages, and creator coin alerts.
 *
 * Endpoints:
 *   POST   /api/discord/connect            { guildId?, channelId, webhookId?, webhookToken? }
 *   POST   /api/discord/channel/announce   { channelId, content, embeds? }
 *   GET    /api/discord/channels            → list connected channels
 *   DELETE /api/discord/disconnect          { channelId? }
 *   POST   /api/discord/bridge              { channelId, messageId, streamId }
 *   GET    /api/discord/oauth               → OAuth authorization URL
 *   GET    /api/discord/callback            → OAuth callback handler
 *   GET    /api/discord/guilds              → List user's Discord servers
 *   POST   /api/discord/bridge/enable       → Enable cross-posting to channel
 *   POST   /api/discord/community/create   → Create creator coin Discord server template
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { consumeState, DISCORD_STATE_PREFIX, generateOAuthState, storeState } from './oauth-state';

function safeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9:_-]/g, '_').toLowerCase();
}

/** Discovers the session wallet from cookie. Falls back to 'anon'. */
function getUserId(request: Request, env: Env): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(/session=([^;]+)/);
  if (m?.[1] && env.AUTH_SECRET) return m[1];
  return null;
}

// ─── POST /api/discord/connect ────────────────────────────────

export async function handleDiscordConnect(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: {
    guildId?: string;
    channelId: string;
    webhookId?: string;
    webhookToken?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.channelId) return jsonResponse({ error: 'channelId required' }, 400);

  const record = {
    guildId: body.guildId ?? null,
    channelId: body.channelId,
    webhookId: body.webhookId ?? null,
    webhookToken: body.webhookToken ?? null,
    connectedAt: Date.now(),
  };

  const key = `discord:connect:${safeKey(userId)}:${body.channelId}`;
  try {
    await env.CACHE?.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  // Index in user's channel list
  const listKey = `discord:user:${safeKey(userId)}`;
  try {
    const raw = (await env.CACHE?.get(listKey)) ?? '[]';
    const list = JSON.parse(raw) as string[];
    if (!list.includes(body.channelId)) {
      list.push(body.channelId);
      await env.CACHE?.put(listKey, JSON.stringify(list), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    }
  } catch {
    /* best-effort index */
  }

  return jsonResponse({ ok: true, channelId: body.channelId }, 201);
}

// ─── POST /api/discord/channel/announce ──────────────────────

export async function handleDiscordChannelAnnounce(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { channelId: string; content: string; embeds?: unknown[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.channelId || !body.content) {
    return jsonResponse({ error: 'channelId and content required' }, 400);
  }

  // Load connection record to get webhook credentials
  const key = `discord:connect:${safeKey(userId)}:${body.channelId}`;
  let record: { webhookId?: string; webhookToken?: string } | null = null;
  try {
    const raw = await env.CACHE?.get(key);
    if (raw) record = JSON.parse(raw);
  } catch {
    /* ignore */
  }

  if (!record?.webhookId || !record?.webhookToken) {
    return jsonResponse({ error: 'No webhook configured for this channel. Connect first.' }, 400);
  }

  // Execute the Discord webhook
  try {
    const payload: Record<string, unknown> = { content: body.content };
    if (body.embeds) payload.embeds = body.embeds;

    const res = await fetch(
      `https://discord.com/api/v10/webhooks/${record.webhookId}/${record.webhookToken}?wait=true`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const err = await res.text().catch(() => 'unknown');
      return jsonResponse({ error: `Discord webhook failed: ${res.status} ${err}` }, 502);
    }
    const result = await res.json();
    return jsonResponse({
      ok: true,
      messageId: (result as Record<string, unknown>).id ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Discord request failed: ${msg}` }, 502);
  }
}

// ─── GET /api/discord/channels ────────────────────────────────

export async function handleDiscordChannelsList(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  const listKey = `discord:user:${safeKey(userId)}`;
  try {
    const raw = await env.CACHE?.get(listKey);
    const channelIds: string[] = raw ? (JSON.parse(raw) as string[]) : [];

    const channels = await Promise.all(
      channelIds.map(async (cid) => {
        const rec = await env.CACHE?.get(`discord:connect:${safeKey(userId)}:${cid}`);
        return rec ? (JSON.parse(rec) as Record<string, unknown>) : null;
      }),
    );

    return noCacheJsonResponse({ channels: channels.filter(Boolean) });
  } catch {
    return jsonResponse({ channels: [] });
  }
}

// ─── DELETE /api/discord/disconnect ──────────────────────────

export async function handleDiscordDisconnect(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { channelId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (body.channelId) {
    // Remove specific channel
    const key = `discord:connect:${safeKey(userId)}:${body.channelId}`;
    try {
      await env.CACHE?.delete(key);
    } catch {
      /* ignore */
    }
    const listKey = `discord:user:${safeKey(userId)}`;
    try {
      const raw = (await env.CACHE?.get(listKey)) ?? '[]';
      const list = JSON.parse(raw) as string[];
      const updated = list.filter((c) => c !== body.channelId);
      await env.CACHE?.put(listKey, JSON.stringify(updated), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    } catch {
      /* ignore */
    }
  } else {
    // Remove all
    try {
      const listKey = `discord:user:${safeKey(userId)}`;
      const raw = (await env.CACHE?.get(listKey)) ?? '[]';
      const list = JSON.parse(raw) as string[];
      for (const cid of list) {
        await env.CACHE?.delete(`discord:connect:${safeKey(userId)}:${cid}`);
      }
      await env.CACHE?.delete(listKey);
    } catch {
      /* ignore */
    }
  }

  return jsonResponse({ ok: true });
}

// ─── POST /api/discord/bridge ────────────────────────────────

export async function handleDiscordBridgeMessage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { channelId: string; messageId: string; streamId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.channelId || !body.streamId) {
    return jsonResponse({ error: 'channelId and streamId required' }, 400);
  }

  // Record bridge mapping in KV
  const bridgeKey = `discord:bridge:stream:${body.streamId}`;
  try {
    const raw = (await env.CACHE?.get(bridgeKey)) ?? '[]';
    const mappings = JSON.parse(raw) as Array<{
      channelId: string;
      messageId?: string;
    }>;
    mappings.push({ channelId: body.channelId, messageId: body.messageId });
    await env.CACHE?.put(bridgeKey, JSON.stringify(mappings), {
      expirationTtl: 60 * 60 * 24 * 7,
    });
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  return jsonResponse({ ok: true, streamId: body.streamId });
}

// ─── GET /api/discord/oauth — Generate Discord OAuth URL ────────────────

/**
 * GET /api/discord/oauth
 * Returns the Discord OAuth2 authorization URL for connecting a Discord account.
 * Scopes: identify, email, guilds (to list servers), webhook.incoming (to post)
 */
export async function handleDiscordOAuth(request: Request, env: Env): Promise<Response> {
  const clientId = env.DISCORD_CLIENT_ID;
  if (!clientId) return jsonResponse({ error: 'Discord OAuth not configured' }, 501);

  const state = generateOAuthState();
  await storeState(env, state, DISCORD_STATE_PREFIX);

  const url = new URL(request.url);
  const callbackUrl = `${url.protocol}//${url.hostname}/api/discord/callback`;

  const authorizeUrl =
    'https://discord.com/api/oauth2/authorize?' +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'identify email guilds webhook.incoming',
      state,
    }).toString();

  return jsonResponse({ authorizeUrl, state });
}

// ─── GET /api/discord/callback — Discord OAuth callback ────────────────

/**
 * GET /api/discord/callback
 * Handles the Discord OAuth2 callback, exchanges code for tokens,
 * and stores the connection for the authenticated user.
 */
export async function handleDiscordOAuthCallback(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const clientId = env.DISCORD_CLIENT_ID;
  const clientSecret = env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return jsonResponse({ error: 'Discord OAuth not configured' }, 501);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return jsonResponse({ error: `Discord OAuth denied: ${error}` }, 400);
  }
  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state' }, 400);
  }

  const stateValid = await consumeState(env, state, DISCORD_STATE_PREFIX);
  if (!stateValid) {
    return jsonResponse({ error: 'Invalid or expired OAuth state' }, 403);
  }

  const redirectUri = `${url.protocol}//${url.hostname}/api/discord/callback`;

  // Exchange code for token
  let tokenData: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return jsonResponse({ error: `Token exchange failed: ${err.slice(0, 200)}` }, 400);
    }
    tokenData = (await tokenRes.json()) as typeof tokenData;
  } catch (err) {
    return jsonResponse({ error: `Token exchange request failed: ${(err as Error).message}` }, 502);
  }

  if (!tokenData.access_token) {
    return jsonResponse({ error: 'No access token received' }, 400);
  }

  // Fetch user info
  let discordUser: {
    id?: string;
    username?: string;
    discriminator?: string;
    avatar?: string;
    email?: string;
  } = {};
  try {
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userRes.ok) {
      discordUser = (await userRes.json()) as typeof discordUser;
    }
  } catch {
    // non-fatal
  }

  const wallet = session.address.toLowerCase();
  const discordId = discordUser.id ?? 'unknown';

  // Store Discord connection in KV
  const connectionRecord = {
    discordId,
    username: discordUser.username,
    discriminator: discordUser.discriminator,
    avatar: discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png`
      : null,
    email: discordUser.email,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    scope: tokenData.scope,
    connectedAt: Date.now(),
  };

  const connKey = `discord:oauth:${safeKey(wallet)}`;
  try {
    await env.CACHE?.put(connKey, JSON.stringify(connectionRecord), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    return jsonResponse({ error: 'Failed to store connection' }, 500);
  }

  return jsonResponse({
    ok: true,
    discordId,
    username: discordUser.username,
    discriminator: discordUser.discriminator,
    avatar: connectionRecord.avatar,
  });
}

// ─── GET /api/discord/guilds — List user's Discord servers ────────────

/**
 * GET /api/discord/guilds
 * Returns a list of Discord servers (guilds) the user has access to.
 * Requires a valid Discord OAuth connection.
 */
export async function handleDiscordGuilds(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const connKey = `discord:oauth:${safeKey(session.address.toLowerCase())}`;
  let connection: { accessToken?: string } | null = null;
  try {
    const raw = await env.CACHE?.get(connKey);
    if (raw) connection = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!connection?.accessToken) {
    return jsonResponse({ error: 'No Discord connection found. Connect via OAuth first.' }, 400);
  }

  try {
    const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { authorization: `Bearer ${connection.accessToken}` },
    });

    if (!guildsRes.ok) {
      return jsonResponse({ error: 'Failed to fetch guilds. Re-authorize Discord.' }, 400);
    }

    const guilds = (await guildsRes.json()) as Array<{
      id: string;
      name: string;
      icon?: string;
      owner: boolean;
      permissions: string;
    }>;

    return jsonResponse({
      guilds: guilds.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
        owner: g.owner,
      })),
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to list guilds: ${(err as Error).message}` }, 502);
  }
}

// ─── POST /api/discord/bridge/enable — Enable cross-posting ───────────

/**
 * POST /api/discord/bridge/enable
 * Enables cross-posting from DegenFeed to a Discord channel via webhook.
 * Requires a Discord OAuth session with webhook.incoming scope.
 */
export async function handleDiscordBridgeEnable(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    guildId: string;
    channelId: string;
    webhookName?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.guildId || !body.channelId) {
    return jsonResponse({ error: 'guildId and channelId required' }, 400);
  }

  const connKey = `discord:oauth:${safeKey(session.address.toLowerCase())}`;
  let connection: { accessToken?: string } | null = null;
  try {
    const raw = await env.CACHE?.get(connKey);
    if (raw) connection = JSON.parse(raw);
  } catch {
    // ignore
  }

  if (!connection?.accessToken) {
    return jsonResponse({ error: 'No Discord OAuth session' }, 400);
  }

  // Create webhook in the specified channel
  try {
    const webhookRes = await fetch(
      `https://discord.com/api/v10/channels/${body.channelId}/webhooks`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${connection.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: body.webhookName ?? 'DegenFeed Bridge',
        }),
      },
    );

    if (!webhookRes.ok) {
      const err = await webhookRes.text();
      const status = webhookRes.status;
      if (status === 403) {
        return jsonResponse(
          {
            error: 'Missing permissions. Bot needs "Manage Webhooks" permission.',
          },
          403,
        );
      }
      return jsonResponse(
        {
          error: `Failed to create webhook: ${err.slice(0, 200)}`,
        },
        502,
      );
    }

    const webhook = (await webhookRes.json()) as {
      id: string;
      token: string;
      channel_id: string;
      guild_id?: string;
    };

    // Store the connection
    const record = {
      guildId: body.guildId,
      channelId: body.channelId,
      webhookId: webhook.id,
      webhookToken: webhook.token,
      enabled: true,
      createdAt: Date.now(),
    };

    const key = `discord:connect:${safeKey(session.address)}:${body.channelId}`;
    await env.CACHE?.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    // Update user's channel list
    const listKey = `discord:user:${safeKey(session.address)}`;
    try {
      const raw = (await env.CACHE?.get(listKey)) ?? '[]';
      const list = JSON.parse(raw) as string[];
      if (!list.includes(body.channelId)) {
        list.push(body.channelId);
        await env.CACHE?.put(listKey, JSON.stringify(list), {
          expirationTtl: 60 * 60 * 24 * 365,
        });
      }
    } catch {
      // best-effort
    }

    return jsonResponse({
      ok: true,
      channelId: body.channelId,
      webhookId: webhook.id,
    });
  } catch (err) {
    return jsonResponse(
      {
        error: `Webhook creation failed: ${(err as Error).message}`,
      },
      502,
    );
  }
}

// ─── POST /api/discord/community/create — Create coin Discord server ──

/**
 * POST /api/discord/community/create
 * Creates a Discord server template for a creator coin community.
 * The user can use this template to set up their own server.
 */
export async function handleDiscordCommunityCreate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    coinSymbol: string;
    coinName?: string;
    guildName?: string;
    inviteLink?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.coinSymbol) {
    return jsonResponse({ error: 'coinSymbol required' }, 400);
  }

  const wallet = session.address.toLowerCase();
  const symbol = body.coinSymbol.toUpperCase();
  const guildName = body.guildName ?? `${symbol} Community`;
  const coinName = body.coinName ?? symbol;

  // Create a Discord server template link (placeholder — needs Discord bot with
  // MANAGE_GUILD permission and a pre-made template)
  const templateCode = `${symbol.toLowerCase()}-community`;
  const templateUrl = `https://discord.new/${templateCode}`;

  // Store the community association
  const communityRecord = {
    coinSymbol: symbol,
    coinName,
    guildName,
    creatorWallet: wallet,
    templateCode,
    inviteUrl: body.inviteLink ?? templateUrl,
    createdAt: Date.now(),
  };

  const communityKey = `discord:community:${symbol.toLowerCase()}`;
  try {
    await env.CACHE?.put(communityKey, JSON.stringify(communityRecord), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    return jsonResponse({ error: 'Failed to store community record' }, 500);
  }

  return jsonResponse({
    ok: true,
    coinSymbol: symbol,
    guildName,
    templateUrl,
    note: 'Use this template to create your Discord server. In production, the bot would auto-create it.',
  });
}

// ─── GET /api/discord/community/:symbol — Get community info ──────────

/**
 * GET /api/discord/community/:symbol
 * Returns Discord community info for a creator coin.
 */
export async function handleDiscordCommunityInfo(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const symbol = url.pathname.split('/').pop()?.toUpperCase();

  if (!symbol) {
    return jsonResponse({ error: 'Symbol required' }, 400);
  }

  try {
    const communityKey = `discord:community:${symbol.toLowerCase()}`;
    const raw = await env.CACHE?.get(communityKey);
    if (!raw) {
      return jsonResponse({ exists: false, symbol });
    }
    const record = JSON.parse(raw);
    return jsonResponse({
      exists: true,
      symbol: record.coinSymbol,
      guildName: record.guildName,
      inviteUrl: record.inviteUrl,
      createdAt: record.createdAt,
    });
  } catch {
    return jsonResponse({ error: 'Failed to fetch community info' }, 500);
  }
}

// ─── GET /api/discord/connection — Get current connection status ──────

/**
 * GET /api/discord/connection
 * Returns the current Discord OAuth connection status.
 */
export async function handleDiscordConnectionStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const connKey = `discord:oauth:${safeKey(session.address.toLowerCase())}`;
  try {
    const raw = await env.CACHE?.get(connKey);
    if (!raw) {
      return jsonResponse({ connected: false });
    }
    const connection = JSON.parse(raw) as {
      discordId: string;
      username: string;
      discriminator?: string;
      avatar?: string;
      email?: string;
      connectedAt: number;
      expiresAt?: number;
    };
    return jsonResponse({
      connected: true,
      discordId: connection.discordId,
      username: connection.username,
      discriminator: connection.discriminator,
      avatar: connection.avatar,
      connectedAt: connection.connectedAt,
      expiresAt: connection.expiresAt,
    });
  } catch {
    return jsonResponse({ connected: false, error: 'Failed to read connection' });
  }
}

// ─── DELETE /api/discord/connection — Disconnect Discord ──────────────

/**
 * DELETE /api/discord/connection
 * Disconnects Discord OAuth connection.
 */
export async function handleDiscordDisconnectOAuth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const connKey = `discord:oauth:${safeKey(session.address.toLowerCase())}`;
  try {
    await env.CACHE?.delete(connKey);
    return jsonResponse({ ok: true, message: 'Discord disconnected' });
  } catch {
    return jsonResponse({ error: 'Failed to disconnect' }, 500);
  }
}
