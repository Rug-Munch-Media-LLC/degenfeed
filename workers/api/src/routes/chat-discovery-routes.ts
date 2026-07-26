/**
 * @degenfeed/api-worker — Cross-Protocol Chat Discovery Routes
 *
 * GET  /api/chat/discover              — Search communities across all protocols
 * GET  /api/chat/discover/trending     — Trending communities
 * GET  /api/chat/discover/protocol/:p  — Communities by protocol
 * GET  /api/chat/discover/recommended  — Recommended based on interests
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── GET /api/chat/discover ─────────────────────────────────────────────────

export async function handleDiscoverySearch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const protocols = url.searchParams.get('protocols')?.split(',').filter(Boolean) ?? [];
  const tags = url.searchParams.get('tags')?.split(',').filter(Boolean) ?? [];
  const trending = url.searchParams.get('trending') === 'true';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);

  try {
    const { getDiscovery } = await import('@degenfeed/realtime/chat-discovery');
    const discovery = getDiscovery();

    const result = await discovery.search({ query, protocols, tags, trending, limit }, env as any);

    return noCacheJsonResponse({
      ok: true,
      communities: result.communities,
      meta: result.meta,
    });
  } catch (err) {
    console.error('[chat-discovery] Search failed:', err);
    return jsonResponse({ error: 'Discovery search failed' }, 500);
  }
}

// ─── GET /api/chat/discover/trending ────────────────────────────────────────

export async function handleDiscoveryTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

  try {
    const { getDiscovery } = await import('@degenfeed/realtime/chat-discovery');
    const discovery = getDiscovery();

    const communities = await discovery.getTrending(env as any, limit);

    return noCacheJsonResponse({
      ok: true,
      communities,
      meta: {
        total: communities.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[chat-discovery] Trending failed:', err);
    return jsonResponse({ error: 'Failed to get trending' }, 500);
  }
}

// ─── GET /api/chat/discover/protocol/:protocol ──────────────────────────────

export async function handleDiscoveryByProtocol(
  request: Request,
  env: Env,
  protocol: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);

  const validProtocols = [
    'irc',
    'matrix',
    'nostr',
    'farcaster',
    'bluesky',
    'xmpp',
    'telegram',
    'discord',
  ];
  if (!validProtocols.includes(protocol)) {
    return jsonResponse(
      { error: `Invalid protocol. Must be one of: ${validProtocols.join(', ')}` },
      400,
    );
  }

  try {
    const { getDiscovery } = await import('@degenfeed/realtime/chat-discovery');
    const discovery = getDiscovery();

    const communities = await discovery.getByProtocol(protocol, env as any, limit);

    return noCacheJsonResponse({
      ok: true,
      protocol,
      communities,
      meta: {
        total: communities.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[chat-discovery] By protocol failed:', err);
    return jsonResponse({ error: 'Failed to get communities' }, 500);
  }
}

// ─── GET /api/chat/discover/recommended ─────────────────────────────────────

export async function handleDiscoveryRecommended(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const url = new URL(request.url);
  const tags = url.searchParams.get('tags')?.split(',').filter(Boolean) ?? [
    'bitcoin',
    'crypto',
    'defi',
  ];
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);

  try {
    const { getDiscovery } = await import('@degenfeed/realtime/chat-discovery');
    const discovery = getDiscovery();

    const communities = await discovery.getRecommended(tags, env as any, limit);

    return noCacheJsonResponse({
      ok: true,
      tags,
      communities,
      meta: {
        total: communities.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[chat-discovery] Recommended failed:', err);
    return jsonResponse({ error: 'Failed to get recommendations' }, 500);
  }
}
