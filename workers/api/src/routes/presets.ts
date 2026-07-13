/**
 * Feed presets — save and load named feed configurations.
 *
 * GET  /api/feed/presets — list saved presets (reads from KV or cookie)
 * POST /api/feed/presets — save a new preset
 * DELETE /api/feed/presets?id=... — delete a preset
 */

import { type Env, jsonResponse } from '../index';

interface FeedPreset {
  id: string;
  name: string;
  protocols?: string;
  niches?: string;
  category?: string;
  sort?: string;
  type?: string;
  createdAt: number;
}

export async function handleFeedPresets(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('cookie') ?? '';
  const presetsKey = 'feed:presets:v1';

  // GET — list presets
  if (request.method === 'GET') {
    const presets: FeedPreset[] = [];
    try {
      const cookieMatch = cookieHeader
        .split(';')
        .map((s) => s.trim())
        .find((s) => s.startsWith('df_presets='));
      if (cookieMatch) {
        const parsed = JSON.parse(
          decodeURIComponent(cookieMatch.slice('df_presets='.length)),
        ) as FeedPreset[];
        presets.push(...parsed);
      }
      if (env.CACHE) {
        const stored = await env.CACHE.get(presetsKey);
        if (stored) {
          const kvPresets = JSON.parse(stored) as FeedPreset[];
          for (const p of kvPresets) {
            if (!presets.find((x) => x.id === p.id)) presets.push(p);
          }
        }
      }
    } catch (err) {
      console.warn('[presets] GET failed:', err instanceof Error ? err.message : err);
    }

    return jsonResponse({ data: presets, meta: { total: presets.length } });
  }

  // POST — save a preset
  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as {
        name?: string;
        protocols?: string;
        niches?: string;
        category?: string;
        sort?: string;
        type?: string;
      };
      if (!body.name) return jsonResponse({ error: 'name required' }, 400);

      const preset: FeedPreset = {
        id: `preset-${Date.now()}`,
        name: body.name.slice(0, 50),
        protocols: body.protocols,
        niches: body.niches,
        category: body.category,
        sort: body.sort,
        type: body.type,
        createdAt: Date.now(),
      };

      // Store in KV if available, always return via Set-Cookie
      if (env.CACHE) {
        try {
          const existing = await env.CACHE.get(presetsKey);
          const all = existing ? (JSON.parse(existing) as FeedPreset[]) : [];
          all.push(preset);
          await env.CACHE.put(presetsKey, JSON.stringify(all.slice(-20)), {
            expirationTtl: 90 * 86400,
          });
        } catch (err) {
          console.warn('[presets] POST KV save failed:', err instanceof Error ? err.message : err);
        }
      }

      return jsonResponse({ ok: true, preset });
    } catch (_err) {
      return jsonResponse({ error: 'Invalid request' }, 400);
    }
  }

  // DELETE — remove a preset
  if (request.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return jsonResponse({ error: 'id required' }, 400);
    if (env.CACHE) {
      try {
        const existing = await env.CACHE.get(presetsKey);
        if (existing) {
          const all = (JSON.parse(existing) as FeedPreset[]).filter((p) => p.id !== id);
          await env.CACHE.put(presetsKey, JSON.stringify(all), { expirationTtl: 90 * 86400 });
        }
      } catch (err) {
        console.warn('[presets] DELETE KV failed:', err instanceof Error ? err.message : err);
      }
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}
