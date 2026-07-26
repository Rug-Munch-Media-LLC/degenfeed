/**
 * /api/rmi/* — Bridge to the rmi-backend DataBus.
 *
 * Surfaces rmi-backend's institutional-grade news, intel, and data
 * to DegenFeed as a unified feed. The same provider is also exposed
 * to the worker for use in /api/feed/home aggregation.
 *
 * Endpoints:
 *   GET /api/rmi/news          → /api/v1/news/feed
 *   GET /api/rmi/news/headlines → /api/v1/news/headlines
 *   GET /api/rmi/news/sources   → /api/v1/news/sources
 *   GET /api/rmi/news/sentiment → /api/v1/news/sentiment
 *   GET /api/rmi/news/stats     → /api/v1/news/stats
 *   GET /api/rmi/health         → rmi-backend up check
 */

import { RmiDataBusProvider, type RmiFeedResponse } from '@degenfeed/feed-providers';
import { rmiUrl } from '@degenfeed/utils';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

function provider(env: Env): RmiDataBusProvider {
  return new RmiDataBusProvider({ backendUrl: rmiUrl(env) });
}

export async function handleRmiNews(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
  const category = url.searchParams.get('category') ?? undefined;
  const sentiment = url.searchParams.get('sentiment') ?? undefined;
  const source = url.searchParams.get('source') ?? undefined;
  const tier = url.searchParams.get('tier') ?? undefined;
  const refresh = url.searchParams.get('refresh') === 'true';

  try {
    const backendUrl = buildUrl(rmiUrl(env), '/api/v1/news/feed', {
      limit: String(limit),
      ...(category ? { category } : {}),
      ...(sentiment ? { sentiment } : {}),
      ...(source ? { source } : {}),
      ...(tier ? { tier } : {}),
      ...(refresh ? { refresh: 'true' } : {}),
    });
    const cacheKey = `rmi:news:v1:${category || 'all'}:${sentiment || 'all'}:${source || 'all'}:${tier || 'all'}:${limit}`;
    try {
      const cached = await env.CACHE?.get(cacheKey);
      if (cached) {
        return jsonResponse(JSON.parse(cached));
      }
    } catch {
      /* KV operation failed -- non-critical, continue */
    }

    const headers: Record<string, string> = { accept: 'application/json' };
    const res = await fetch(backendUrl, { headers, signal: request.signal });
    if (!res.ok) {
      return jsonResponse({ error: `rmi backend ${res.status}` }, 502);
    }
    const data = (await res.json()) as RmiFeedResponse;
    const posts = (data.articles ?? []).slice(0, limit);

    const response = {
      data: posts,
      meta: {
        total: data.total ?? posts.length,
        limit,
        sourceCount: data.source_count ?? 0,
        sources: data.sources ?? [],
        sentiment: data.sentiment_summary ?? {},
        tiers: data.tiers ?? [],
        fetchedAt: Date.now(),
      },
    };
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), {
        expirationTtl: 180,
      });
    } catch {
      /* KV operation failed -- non-critical, continue */
    }
    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'rmi news failed' }, 502);
  }
}

export async function handleRmiHeadlines(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const count = Math.min(Number(url.searchParams.get('count')) || 10, 50);
  const category = url.searchParams.get('category') ?? undefined;
  const cacheKey = `rmi:headlines:v1:${category || 'all'}:${count}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* KV operation failed -- non-critical, continue */
  }
  try {
    const p = provider(env);
    const data = await p.fetchHeadlines(count, category);
    const response = {
      data: data.headlines ?? [],
      count: data.count ?? 0,
      fetchedAt: Date.now(),
    };
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), {
        expirationTtl: 300,
      });
    } catch {
      /* KV operation failed -- non-critical, continue */
    }
    return jsonResponse(response);
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'rmi headlines failed' },
      502,
    );
  }
}

export async function handleRmiSources(_request: Request, env: Env): Promise<Response> {
  try {
    const res = await fetch(buildUrl(rmiUrl(env), '/api/v1/news/sources'));
    if (!res.ok) return jsonResponse({ error: `rmi ${res.status}` }, 502);
    return jsonResponse(await res.json());
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'rmi sources failed' }, 502);
  }
}

export async function handleRmiSentiment(_request: Request, env: Env): Promise<Response> {
  try {
    const res = await fetch(buildUrl(rmiUrl(env), '/api/v1/news/sentiment'));
    if (!res.ok) return jsonResponse({ error: `rmi ${res.status}` }, 502);
    return jsonResponse(await res.json());
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'rmi sentiment failed' },
      502,
    );
  }
}

export async function handleRmiStats(_request: Request, env: Env): Promise<Response> {
  try {
    const res = await fetch(buildUrl(rmiUrl(env), '/api/v1/news/stats'));
    if (!res.ok) return jsonResponse({ error: `rmi ${res.status}` }, 502);
    return jsonResponse(await res.json());
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'rmi stats failed' }, 502);
  }
}

export async function handleRmiHealth(_request: Request, env: Env): Promise<Response> {
  const start = Date.now();
  try {
    const res = await fetch(buildUrl(rmiUrl(env), '/api/v1/news/sources'));
    const ok = res.ok;
    return jsonResponse({
      healthy: ok,
      backend: rmiUrl(env),
      latencyMs: Date.now() - start,
      status: res.status,
    });
  } catch (err) {
    return jsonResponse(
      {
        healthy: false,
        backend: rmiUrl(env),
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'unknown',
      },
      502,
    );
  }
}

function buildUrl(base: string, path: string, params?: Record<string, string>): string {
  const url = new URL(path, base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}
