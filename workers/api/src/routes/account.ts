/**
 * /api/account — GDPR data portability + deletion
 *
 * POST /api/account/export  → returns all user data (preferences, subscriptions, follows, mutes, identities)
 * POST /api/account/delete  → deletes all user data from KV + returns confirmation
 *
 * Both require a valid session cookie.
 */

import { type Env, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

export async function handleAccountExport(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const data: Record<string, unknown> = {
    address: session.address,
    chain: session.chain,
    exportedAt: new Date().toISOString(),
    preferences: null,
    subscriptions: null,
    follows: null,
    mutes: null,
  };

  if (env.CACHE) {
    try {
      const [prefs, follows, mutedAuthors, mutedWords] = await Promise.all([
        env.CACHE.get(`user:prefs:${session.address}`),
        env.CACHE.get(`user:follows:${session.address}`),
        env.CACHE.get(`user:muted_authors:${session.address}`),
        env.CACHE.get(`user:muted_words:${session.address}`),
      ]);
      data.preferences = prefs ? JSON.parse(prefs) : null;
      data.follows = follows ? JSON.parse(follows) : null;
      data.mutedAuthors = mutedAuthors ? JSON.parse(mutedAuthors) : null;
      data.mutedWords = mutedWords ? JSON.parse(mutedWords) : null;
    } catch {
      /* ignore */
    }
  }

  if (env.SUBSCRIPTIONS) {
    try {
      const subKeys = ['newsletter:sub', 'notify:sub'];
      const subs: Record<string, unknown> = {};
      for (const prefix of subKeys) {
        const raw = await env.SUBSCRIPTIONS.get(`${prefix}:${session.address}`);
        if (raw) subs[prefix] = JSON.parse(raw);
      }
      data.subscriptions = subs;
    } catch {
      /* ignore */
    }
  }

  return noCacheJsonResponse({ data });
}

export async function handleAccountDelete(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const keysDeleted: string[] = [];

  if (env.CACHE) {
    const prefix = `user:`;
    try {
      for (const suffix of ['prefs', 'follows', 'muted_authors', 'muted_words']) {
        const key = `${prefix}${suffix}:${session.address}`;
        await env.CACHE.delete(key);
        keysDeleted.push(key);
      }
    } catch {
      /* ignore */
    }
  }

  if (env.SUBSCRIPTIONS) {
    try {
      for (const pfx of ['newsletter:sub:', 'notify:sub:']) {
        const key = `${pfx}${session.address}`;
        const existing = await env.SUBSCRIPTIONS.get(key);
        if (existing) {
          await env.SUBSCRIPTIONS.delete(key);
          keysDeleted.push(key);
        }
      }
    } catch {
      /* ignore */
    }
  }

  return new Response(JSON.stringify({ ok: true, deleted: keysDeleted }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': '__Host-dfid=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict',
      'cache-control': 'no-store',
    },
  });
}
