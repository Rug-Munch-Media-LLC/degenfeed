/**
 * @routes/recommendations — Recommendation API endpoints
 *
 * Routes:
 *   GET    /api/recommendations/videos     — Personalized video recommendations
 *   GET    /api/recommendations/shorts     — Personalized shorts recommendations
 *   GET    /api/recommendations/streams    — Live stream recommendations
 *   GET    /api/recommendations/related    — "Because you watched" (query: ?source=&id=)
 *   GET    /api/recommendations/trending   — Personalized trending
 *   GET    /api/recommendations/discover   — Discover new creators
 *   POST   /api/recommendations/interaction — Record user interaction
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import {
  type ContentSource,
  type InteractionAction,
  RecommendationEngine,
  type RecommendationOptions,
} from '../lib/recommendation-engine';
import { requireSession } from '../session';
import { methodNotAllowed } from '../response-helpers';

// ─── Helper: extract wallet from session ─────────────────────────────────

async function requireWallet(request: Request, env: Env): Promise<string | null> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return null;
  return session.address;
}

// ─── GET /api/recommendations/videos ────────────────────────────────────

export async function handleVideoRecommendations(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const wallet = await requireWallet(request, env);
  if (!wallet) return jsonResponse({ error: 'Session required' }, 401);

  const engine = new RecommendationEngine(env);
  const opts = parseRecommendationOptions(url);

  try {
    const results = await engine.getVideoRecommendations(wallet, opts);
    return jsonResponse({
      data: results,
      meta: {
        total: results.length,
        wallet: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[rec] video recommendations error:', err);
    return jsonResponse({ error: 'Failed to generate recommendations' }, 500);
  }
}

// ─── GET /api/recommendations/shorts ────────────────────────────────────

export async function handleShortsRecommendations(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const wallet = await requireWallet(request, env);
  if (!wallet) return jsonResponse({ error: 'Session required' }, 401);

  const engine = new RecommendationEngine(env);
  const opts = parseRecommendationOptions(new URL(request.url));

  try {
    const results = await engine.getShortsRecommendations(wallet, opts);
    return jsonResponse({
      data: results,
      meta: {
        total: results.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[rec] shorts recommendations error:', err);
    return jsonResponse({ error: 'Failed to generate recommendations' }, 500);
  }
}

// ─── GET /api/recommendations/streams ───────────────────────────────────

export async function handleStreamRecommendations(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const wallet = await requireWallet(request, env);
  if (!wallet) return jsonResponse({ error: 'Session required' }, 401);

  const engine = new RecommendationEngine(env);

  try {
    const results = await engine.getStreamRecommendations(wallet);
    return jsonResponse({
      data: results,
      meta: {
        total: results.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[rec] stream recommendations error:', err);
    return jsonResponse({ error: 'Failed to generate recommendations' }, 500);
  }
}

// ─── GET /api/recommendations/related ───────────────────────────────────

export async function handleRelatedRecommendations(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const source = url.searchParams.get('source') as ContentSource | null;
  const contentId = url.searchParams.get('id');

  if (!source || !contentId) {
    return jsonResponse({ error: 'source and id query parameters required' }, 400);
  }

  const validSources: ContentSource[] = [
    'youtube',
    'peertube',
    'tiktok',
    'instagram',
    'twitch',
    'kick',
    'rumble',
    'odysee',
  ];
  if (!validSources.includes(source)) {
    return jsonResponse(
      { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
      400,
    );
  }

  const engine = new RecommendationEngine(env);

  try {
    const results = await engine.getRelatedContent(contentId, source);
    return jsonResponse({
      data: results,
      meta: {
        total: results.length,
        source,
        contentId,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[rec] related recommendations error:', err);
    return jsonResponse({ error: 'Failed to generate related content' }, 500);
  }
}

// ─── GET /api/recommendations/trending ──────────────────────────────────

export async function handlePersonalizedTrending(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const url = new URL(request.url);
  const wallet = await requireWallet(request, env);
  if (!wallet) return jsonResponse({ error: 'Session required' }, 401);

  const category = url.searchParams.get('category') || undefined;
  const engine = new RecommendationEngine(env);

  try {
    const results = await engine.getPersonalizedTrending(wallet, category);
    return jsonResponse({
      data: results,
      meta: {
        total: results.length,
        category: category ?? 'all',
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[rec] personalized trending error:', err);
    return jsonResponse({ error: 'Failed to generate trending' }, 500);
  }
}

// ─── GET /api/recommendations/discover ──────────────────────────────────

export async function handleDiscoverRecommendations(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const wallet = await requireWallet(request, env);
  if (!wallet) return jsonResponse({ error: 'Session required' }, 401);

  const engine = new RecommendationEngine(env);

  try {
    const results = await engine.getDiscoverNew(wallet);
    return jsonResponse({
      data: results,
      meta: {
        total: results.length,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    console.error('[rec] discover error:', err);
    return jsonResponse({ error: 'Failed to generate discoveries' }, 500);
  }
}

// ─── POST /api/recommendations/interaction ─────────────────────────────

export async function handleRecordInteraction(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const wallet = await requireWallet(request, env);
  if (!wallet) return jsonResponse({ error: 'Session required' }, 401);

  let body: {
    contentId?: string;
    action?: InteractionAction;
    category?: string;
    tags?: string[];
    creatorId?: string;
    source?: ContentSource;
    dwellMs?: number;
    completionRate?: number;
    duration?: number;
    heldTokenMint?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.contentId || !body.action) {
    return jsonResponse({ error: 'contentId and action are required' }, 400);
  }

  const validActions: InteractionAction[] = ['watch', 'like', 'share', 'skip', 'complete', 'tip'];
  if (!validActions.includes(body.action)) {
    return jsonResponse(
      { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
      400,
    );
  }

  const engine = new RecommendationEngine(env);

  try {
    await engine.recordInteraction(wallet, body.contentId, body.action, {
      dwellMs: body.dwellMs,
      completionRate: body.completionRate,
      category: body.category,
      tags: body.tags,
      creatorId: body.creatorId,
      source: body.source,
      duration: body.duration,
      heldTokenMint: body.heldTokenMint,
    });

    return noCacheJsonResponse({ ok: true });
  } catch (err) {
    console.error('[rec] record interaction error:', err);
    return jsonResponse({ error: 'Failed to record interaction' }, 500);
  }
}

// ─── Option parsing ─────────────────────────────────────────────────────

function parseRecommendationOptions(url: URL): RecommendationOptions {
  const opts: RecommendationOptions = {};

  const limit = url.searchParams.get('limit');
  if (limit) opts.limit = Math.min(Number(limit) || 20, 100);

  const excludeWatched = url.searchParams.get('excludeWatched');
  if (excludeWatched !== null) opts.excludeWatched = excludeWatched !== 'false';

  const sourceFilter = url.searchParams.get('sources');
  if (sourceFilter) {
    const validSources: ContentSource[] = [
      'youtube',
      'peertube',
      'tiktok',
      'instagram',
      'twitch',
      'kick',
      'rumble',
      'odysee',
    ];
    opts.sourceFilter = sourceFilter
      .split(',')
      .filter((s) => validSources.includes(s as ContentSource)) as ContentSource[];
  }

  const categoryFilter = url.searchParams.get('categories');
  if (categoryFilter) {
    opts.categoryFilter = categoryFilter.split(',').filter(Boolean);
  }

  const durationMin = url.searchParams.get('durationMin');
  const durationMax = url.searchParams.get('durationMax');
  if (durationMin || durationMax) {
    opts.durationFilter = {};
    if (durationMin) opts.durationFilter.min = Number(durationMin);
    if (durationMax) opts.durationFilter.max = Number(durationMax);
  }

  const freshness = url.searchParams.get('freshness') as RecommendationOptions['freshnessFilter'];
  if (freshness && ['day', 'week', 'month', 'all'].includes(freshness)) {
    opts.freshnessFilter = freshness;
  }

  return opts;
}
