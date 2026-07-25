/**
 * /api/features — KV-backed feature flags
 *
 * Stores feature flags in the CACHE KV namespace under the `ff:` prefix.
 * On first access, seeds a set of default flags from code, with the
 * enabled/disabled state driven by the FEATURE_FLAGS_DEFAULT wrangler var
 * (a comma-separated list of keys that default to enabled).
 *
 * GET  /api/features  — returns all feature flags (no auth)
 * POST /api/features  — upsert a single flag (requires ADMIN_API_KEY)
 */

import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { methodNotAllowed } from '../response-helpers';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  rolloutPercent: number;
}

const KV_KEY = 'ff:all';

const FLAG_DEFINITIONS: Omit<FeatureFlag, 'enabled'>[] = [
  {
    key: 'video-grid-layout',
    description: 'New video grid layout in feed',
    rolloutPercent: 0,
  },
  {
    key: 'reply-composer',
    description: 'Inline reply composer in post detail',
    rolloutPercent: 100,
  },
  {
    key: 'dark-mode-only',
    description: 'Force dark mode — light mode not ready',
    rolloutPercent: 100,
  },
  {
    key: 'push-notifications',
    description: 'Web push notifications via VAPID',
    rolloutPercent: 0,
  },
  {
    key: 'newsletter-v2',
    description: 'New newsletter digest format',
    rolloutPercent: 0,
  },
  {
    key: 'farcaster-frames',
    description: 'Farcaster Frame embed rendering',
    rolloutPercent: 100,
  },
];

function defaultEnabledSet(env: Env): Set<string> {
  const raw = env.FEATURE_FLAGS_DEFAULT || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function buildFlags(env: Env): FeatureFlag[] {
  const enabledSet = defaultEnabledSet(env);
  return FLAG_DEFINITIONS.map((def) => ({
    ...def,
    enabled: enabledSet.has(def.key),
  }));
}

async function seedIfEmpty(env: Env): Promise<void> {
  try {
    const existing = await env.CACHE?.get(KV_KEY);
    if (existing) return;
    const flags = buildFlags(env);
    await env.CACHE?.put(KV_KEY, JSON.stringify(flags), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    /* seed failure is non-fatal — flags will be built fresh next request */
  }
}

function toRecord(flags: FeatureFlag[]): Record<string, boolean> {
  const record: Record<string, boolean> = {};
  for (const f of flags) {
    record[f.key] = f.enabled;
  }
  return record;
}

function requireAdmin(request: Request, env: Env): boolean {
  const auth = request.headers.get('authorization');
  if (!auth) return false;
  const token = auth.replace(/^Bearer\s+/i, '');
  return token === env.ADMIN_API_KEY || token === env.NEWSLETTER_API_KEY;
}

export async function handleFeatures(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    try {
      await seedIfEmpty(env);
      const raw = await env.CACHE?.get(KV_KEY);
      if (raw) {
        const flags = JSON.parse(raw) as FeatureFlag[];
        return noCacheJsonResponse({ flags, enabled: toRecord(flags) });
      }
    } catch {
      /* KV operation failed -- non-critical, continue */
    }
    const fallback = buildFlags(env);
    return noCacheJsonResponse({
      flags: fallback,
      enabled: toRecord(fallback),
    });
  }

  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  if (!requireAdmin(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: { key?: string; enabled?: boolean };
  try {
    body = (await request.json()) as { key?: string; enabled?: boolean };
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.key || typeof body.enabled !== 'boolean') {
    return jsonResponse({ error: 'key (string) and enabled (boolean) required' }, 400);
  }

  try {
    const raw = await env.CACHE?.get(KV_KEY);
    let flags: FeatureFlag[] = buildFlags(env);
    if (raw) {
      flags = JSON.parse(raw) as FeatureFlag[];
    }
    const idx = flags.findIndex((f) => f.key === body.key);
    if (idx === -1) {
      return jsonResponse({ error: `Unknown flag: ${body.key}` }, 400);
    }
    flags[idx] = {
      ...flags[idx],
      enabled: body.enabled,
      key: flags[idx]?.key ?? '',
      description: flags[idx]?.description ?? '',
      rolloutPercent: flags[idx]?.rolloutPercent ?? 0,
    };
    await env.CACHE?.put(KV_KEY, JSON.stringify(flags), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    return noCacheJsonResponse({
      ok: true,
      flag: flags[idx],
      flags,
      enabled: toRecord(flags),
    });
  } catch {
    return jsonResponse({ error: 'Failed to update feature flags' }, 500);
  }
}
