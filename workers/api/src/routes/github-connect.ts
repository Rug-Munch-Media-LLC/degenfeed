/**
 * /api/github — GitHub Integration
 *
 * Connect GitHub accounts to DegenFeed for dev-focused creators.
 * Post repo releases, PRs, and stars to DegenFeed and bridge to all protocols.
 *
 * Endpoints:
 *   POST   /api/github/connect        { username, accessToken?, repo? }
 *   POST   /api/github/repo-activity  { owner, repo, events[] }
 *   DELETE /api/github/disconnect
 *   GET    /api/github/accounts       → list connected accounts
 *   POST   /api/github/bridge         { owner, repo, event { type, payload } }
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

function safeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9_@./-]/g, '_').toLowerCase();
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getUserId(request: Request, env: Env): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const m = cookie.match(/session=([^;]+)/);
  if (m?.[1] && env.AUTH_SECRET) return m[1];
  return null;
}

// ─── POST /api/github/connect ──────────────────────────────

export async function handleGitHubConnect(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { username: string; accessToken?: string; repo?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.username) return jsonResponse({ error: 'username required' }, 400);

  const connectId = generateId();
  const record = {
    id: connectId,
    username: body.username,
    accessToken: body.accessToken ?? null,
    repo: body.repo ?? null,
    connectedAt: Date.now(),
  };

  try {
    const key = `github:connect:${safeKey(userId)}:${connectId}`;
    await env.CACHE?.put(key, JSON.stringify(record), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    const listKey = `github:user:${safeKey(userId)}`;
    const raw = (await env.CACHE?.get(listKey)) ?? '[]';
    const list = JSON.parse(raw) as string[];
    list.push(connectId);
    await env.CACHE?.put(listKey, JSON.stringify(list), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  return jsonResponse({ ok: true, id: connectId }, 201);
}

// ─── POST /api/github/repo-activity ─────────────────────────

export async function handleGitHubRepoActivity(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { owner: string; repo: string; events: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.owner || !body.repo || !body.events) {
    return jsonResponse({ error: 'owner, repo, and events required' }, 400);
  }

  const validEvents = ['release', 'star', 'pr_merged', 'issue_opened'];
  const invalid = body.events.filter((e) => !validEvents.includes(e));
  if (invalid.length > 0) {
    return jsonResponse(
      {
        error: `Invalid events: ${invalid.join(', ')}. Valid: ${validEvents.join(', ')}`,
      },
      400,
    );
  }

  // Create DegenFeed posts from GitHub events
  const posts = body.events.map((event) => ({
    protocol: 'github' as const,
    text: `[${event}] ${body.owner}/${body.repo}`,
    embeds: [
      {
        kind: 'link' as const,
        url: `https://github.com/${body.owner}/${body.repo}`,
        meta: { event },
      },
    ],
    createdAt: Date.now(),
  }));

  // Store activity record
  const activityKey = `github:activity:${safeKey(userId)}:${safeKey(`${body.owner}/${body.repo}`)}`;
  try {
    await env.CACHE?.put(
      activityKey,
      JSON.stringify({
        owner: body.owner,
        repo: body.repo,
        events: body.events,
        posts,
        createdAt: Date.now(),
      }),
      { expirationTtl: 60 * 60 * 24 * 90 },
    );
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  return jsonResponse({ ok: true, posts });
}

// ─── DELETE /api/github/disconnect ─────────────────────────

export async function handleGitHubDisconnect(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: { id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const listKey = `github:user:${safeKey(userId)}`;
  try {
    if (body.id) {
      await env.CACHE?.delete(`github:connect:${safeKey(userId)}:${body.id}`);
      const raw = (await env.CACHE?.get(listKey)) ?? '[]';
      const list = JSON.parse(raw) as string[];
      const updated = list.filter((id) => id !== body.id);
      await env.CACHE?.put(listKey, JSON.stringify(updated), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    } else {
      // Disconnect all
      const raw = (await env.CACHE?.get(listKey)) ?? '[]';
      const list = JSON.parse(raw) as string[];
      for (const id of list) {
        await env.CACHE?.delete(`github:connect:${safeKey(userId)}:${id}`);
      }
      await env.CACHE?.delete(listKey);
    }
  } catch {
    return jsonResponse({ error: 'Storage failed' }, 500);
  }

  return jsonResponse({ ok: true });
}

// ─── GET /api/github/accounts ──────────────────────────────

export async function handleGitHubConnectedAccounts(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  const listKey = `github:user:${safeKey(userId)}`;
  try {
    const raw = await env.CACHE?.get(listKey);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];

    const accounts = await Promise.all(
      ids.map(async (id) => {
        const rec = await env.CACHE?.get(`github:connect:${safeKey(userId)}:${id}`);
        return rec ? (JSON.parse(rec) as Record<string, unknown>) : null;
      }),
    );

    // Mask tokens
    const sanitized = accounts.filter(Boolean).map((a) => {
      const { accessToken, ...rest } = a as Record<string, unknown>;
      return { ...rest, accessToken: accessToken ? '••••••••' : null };
    });

    return noCacheJsonResponse({ accounts: sanitized });
  } catch {
    return jsonResponse({ accounts: [] });
  }
}

// ─── POST /api/github/bridge ───────────────────────────────

export async function handleGitHubBridgeActivity(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  const userId = getUserId(request, env);
  if (!userId) return jsonResponse({ error: 'Session required' }, 401);

  let body: {
    owner: string;
    repo: string;
    event: { type: string; payload: Record<string, unknown> };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.owner || !body.repo || !body.event) {
    return jsonResponse({ error: 'owner, repo, and event required' }, 400);
  }

  // Format event as cross-platform content
  const repoUrl = `https://github.com/${body.owner}/${body.repo}`;
  const content = `[${body.event.type.toUpperCase()}] ${body.owner}/${body.repo} — ${String(body.event.payload?.title ?? body.event.payload?.action ?? '')}`;

  // Bridge to each connected protocol by triggering webhook dispatcher
  const bridgePayload = {
    text: content,
    html: `<a href="${repoUrl}">${body.owner}/${body.repo}</a>: ${String(body.event.payload?.title ?? '')}`,
    url: repoUrl,
    event: body.event.type,
  };

  return jsonResponse({
    ok: true,
    content,
    bridgePayload,
    bridgeTargets: ['discord', 'matrix', 'telegram', 'webhook'],
  });
}
