/**
 * @degenfeed/api-worker — Feddy Communities: Federation & Webhooks
 *
 * Federation health, sync, webhook management, bot API keys,
 * RSS feed, Discord/Telegram links, and webhook delivery.
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import type { BotScope, WebhookEvent } from '../lib/feddy-store';
import {
  createBotKey,
  createWebhook,
  deleteBotKey,
  deleteWebhook,
  type FeddyCommunity,
  generateSecret,
  getBotKeys,
  getCommunityByName,
  getCommunityPosts,
  getFederationHealth,
  getWebhooks,
  hashKey,
  setFederationHealth,
  updateCommunity,
} from '../lib/feddy-store';
import { csrfCheck, requireModOrResponse, requireSession, sanitizeString } from './feddy-helpers';

const feddy = new Hono<{ Bindings: Env }>();

// ─── Federation Health Dashboard ──────────────────────────────────────

feddy.get('/:name/federation-health', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const health = await getFederationHealth(c.env, community.id);

  // Calculate basic health info from the community itself
  const basicHealth = {
    gtsHandle: community.gtsHandle,
    gtsId: community.gtsId,
    federationStatus: community.federationStatus,
    totalFollowers: 0,
    followerInstances: health?.followerInstances ?? [],
    followerGrowth7d: health?.followerGrowth7d ?? 0,
    lastFederatedAt: health?.lastFederatedAt ?? community.updatedAt,
    failedPushes24h: health?.failedPushes24h ?? 0,
    remoteFollowers: health?.remoteFollowers ?? [],
  };

  return noCacheJsonResponse(basicHealth);
});

feddy.post('/:name/federation/sync', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  // In production, this triggers a background task to resync with GoToSocial
  // and push any pending content to followers on other instances.
  // For now, we update the federation health timestamp.
  const health = await getFederationHealth(c.env, community.id);
  const updatedHealth = health ?? {
    communityId: community.id,
    followerInstances: [],
    totalFollowers: 0,
    followerGrowth7d: 0,
    lastFederatedAt: Date.now(),
    failedPushes24h: 0,
    remoteFollowers: [],
  };
  updatedHealth.lastFederatedAt = Date.now();
  await setFederationHealth(c.env, updatedHealth);

  return jsonResponse({ ok: true, syncedAt: Date.now() });
});

// ═══════════════════════════════════════════════════════════════════════
//  WEBHOOKS / BOTS
// ═══════════════════════════════════════════════════════════════════════

// ─── Webhook Management ────────────────────────────────────────────────

feddy.post('/:name/webhooks', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface WebhookBody {
    url?: string;
    events?: WebhookEvent[];
  }
  let body: WebhookBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.url) return jsonResponse({ error: 'URL required' }, 400);

  const validEvents: WebhookEvent[] = [
    'post.created',
    'post.deleted',
    'member.joined',
    'member.left',
    'member.banned',
    'event.created',
    'poll.closed',
    'treasury.deposit',
    'treasury.withdrawal',
  ];
  const events = (body.events ?? ['post.created']).filter((e): e is WebhookEvent =>
    validEvents.includes(e),
  );

  const secret = generateSecret(24);

  const hook: import('../lib/feddy-store').WebhookConfig = {
    id: crypto.randomUUID(),
    communityId: community.id,
    url: sanitizeString(body.url, 500),
    secret,
    events,
    isActive: true,
    createdBy: session.address,
    createdAt: Date.now(),
  };

  await createWebhook(c.env, hook);
  return jsonResponse(
    {
      ...hook,
      // Return the secret only once
      secret,
    },
    201,
  );
});

feddy.get('/:name/webhooks', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const hooks = await getWebhooks(c.env, community.id);
  // Don't expose secrets
  const safeHooks = hooks.map(({ secret: _, ...h }) => h);
  return noCacheJsonResponse({ webhooks: safeHooks });
});

feddy.delete('/:name/webhooks/:hid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const webhookId = sanitizeString(c.req.param('hid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  await deleteWebhook(c.env, community.id, webhookId);
  return jsonResponse({ ok: true, deleted: webhookId });
});

// ─── Bot API Keys ──────────────────────────────────────────────────────

feddy.post('/:name/bot-keys', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface BotKeyBody {
    name?: string;
    scopes?: BotScope[];
  }
  let body: BotKeyBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const validScopes: BotScope[] = ['post:write', 'post:read', 'members:read', 'stats:read'];
  const scopes = (body.scopes ?? ['post:write']).filter((s): s is BotScope =>
    validScopes.includes(s),
  );

  const rawKey = `df_bot_${generateSecret(24)}`;
  const keyHash = await hashKey(rawKey);

  const botKey: import('../lib/feddy-store').BotApiKey = {
    id: crypto.randomUUID(),
    communityId: community.id,
    name: sanitizeString(body.name ?? 'Bot Key', 100),
    keyHash,
    scopes,
    createdBy: session.address,
    createdAt: Date.now(),
    isActive: true,
  };

  await createBotKey(c.env, botKey);

  return jsonResponse(
    {
      id: botKey.id,
      name: botKey.name,
      scopes: botKey.scopes,
      // Return raw key only once
      key: rawKey,
    },
    201,
  );
});

feddy.get('/:name/bot-keys', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  const keys = await getBotKeys(c.env, community.id);
  const safeKeys = keys.map(({ keyHash: _, ...k }) => k);
  return noCacheJsonResponse({ botKeys: safeKeys });
});

feddy.delete('/:name/bot-keys/:kid', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const keyId = sanitizeString(c.req.param('kid'), 64);
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  await deleteBotKey(c.env, community.id, keyId);
  return jsonResponse({ ok: true, deleted: keyId });
});

// ─── RSS Feed ──────────────────────────────────────────────────────────

feddy.get('/:name/rss', async (c) => {
  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const posts = await getCommunityPosts(c.env, community.id, 20);

  // Generate RSS XML
  const rssItems = posts.posts
    .map(
      (p) => `
    <item>
      <title><![CDATA[${p.text.slice(0, 100)}${p.text.length > 100 ? '...' : ''}]]></title>
      <description><![CDATA[${p.text}]]></description>
      <link>https://degenfeed.xyz/feddy/${community.name}</link>
      <guid isPermaLink="false">${p.id}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <author>${p.authorDisplayName}</author>
    </item>
  `,
    )
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${community.displayName}</title>
    <description>${community.description.slice(0, 500)}</description>
    <link>https://degenfeed.xyz/feddy/${community.name}</link>
    <atom:link href="https://degenfeed.xyz/api/feddy/${community.name}/rss" rel="self" type="application/rss+xml"/>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${community.avatarUrl || 'https://degenfeed.xyz/favicon.png'}</url>
      <title>${community.displayName}</title>
      <link>https://degenfeed.xyz/feddy/${community.name}</link>
    </image>
    ${rssItems}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
});

// ─── Links (Discord/Telegram) ─────────────────────────────────────────

feddy.post('/:name/links', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;
  const csrfRes = await csrfCheck(c.req.raw, c.env);
  if (csrfRes) return csrfRes;

  const name = sanitizeString(c.req.param('name'), 30).toLowerCase();
  const community = await getCommunityByName(c.env, name);
  if (!community) return jsonResponse({ error: 'Community not found' }, 404);

  const modCheck = await requireModOrResponse(c.env, community.id, session.address);
  if (modCheck.error) return modCheck.error;

  interface LinksBody {
    discordLink?: string | null;
    telegramLink?: string | null;
  }
  let body: LinksBody;
  try {
    body = await c.req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const updates: Partial<FeddyCommunity> = {};
  if (body.discordLink !== undefined) updates.discordLink = body.discordLink || null;
  if (body.telegramLink !== undefined) updates.telegramLink = body.telegramLink || null;

  const updated = await updateCommunity(c.env, community.id, updates);
  return jsonResponse({
    ok: true,
    discordLink: updated?.discordLink,
    telegramLink: updated?.telegramLink,
  });
});

// ═══════════════════════════════════════════════════════════════════════
//  WEBHOOK FIRING
// ═══════════════════════════════════════════════════════════════════════

export async function fireWebhook(
  url: string,
  secret: string,
  event: string,
  payload: unknown,
): Promise<void> {
  try {
    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: Date.now(),
    });
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-feddy-event': event,
        'x-feddy-signature': await hashKey(`${secret}:${body}`),
        'user-agent': 'DegenFeed-Feddy-Webhook/1.0',
      },
      body,
    });
  } catch {
    // Webhook delivery failure is non-critical
  }
}

export default feddy;
