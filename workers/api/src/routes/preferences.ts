/**
 * /api/preferences — User ranking preferences (KV-backed)
 *
 * Stores per-user ranking preferences in the `user:prefs:<address>` KV
 * namespace so they apply across devices/sessions. Currently supported:
 *
 *   - hideLowQuality: boolean — drop posts with score < 1.0 from feeds
 *   - preferredNiches: string[] — boost posts in these niches
 *   - preferredPlatforms: Protocol[] — boost posts from these platforms
 *   - mutedNiches: string[] — penalize posts in these niches
 *   - recencyWeight: number
 *   - engagementWeight: number
 *   - diversityBoost: boolean
 *
 * Auth: requires a valid session cookie (`__Host-dfid`).
 */

import type { Protocol } from '@degenfeed/types';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { validateBodySize } from '../sanitize';
import { requireSession } from '../session';

interface PreferencesBody {
  hideLowQuality?: boolean;
  hideLowQualityThreshold?: number;
  preferredNiches?: string[];
  preferredPlatforms?: string[];
  mutedNiches?: string[];
  recencyWeight?: number;
  engagementWeight?: number;
  diversityBoost?: boolean;
  allowNonCrypto?: boolean;
}

interface StoredPreferences {
  hideLowQuality: boolean;
  hideLowQualityThreshold: number;
  preferredNiches: string[];
  preferredPlatforms: Protocol[];
  mutedNiches: string[];
  recencyWeight: number;
  engagementWeight: number;
  diversityBoost: boolean;
  allowNonCrypto: boolean;
  updatedAt: number;
}

const DEFAULT_PREFS: StoredPreferences = {
  hideLowQuality: false,
  hideLowQualityThreshold: 1.0,
  preferredNiches: [],
  preferredPlatforms: [],
  mutedNiches: [],
  recencyWeight: 1,
  engagementWeight: 1,
  diversityBoost: true,
  allowNonCrypto: false,
  updatedAt: 0,
};

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizePrefs(body: PreferencesBody): StoredPreferences {
  return {
    hideLowQuality: typeof body.hideLowQuality === 'boolean' ? body.hideLowQuality : false,
    preferredNiches: Array.isArray(body.preferredNiches)
      ? body.preferredNiches.map((n) => String(n).toLowerCase().trim()).filter((n) => n.length > 0)
      : [],
    preferredPlatforms: Array.isArray(body.preferredPlatforms)
      ? body.preferredPlatforms.filter((p): p is Protocol => typeof p === 'string')
      : [],
    mutedNiches: Array.isArray(body.mutedNiches)
      ? body.mutedNiches.map((n) => String(n).toLowerCase().trim()).filter((n) => n.length > 0)
      : [],
    recencyWeight: clamp(body.recencyWeight, 0.1, 5, 1),
    engagementWeight: clamp(body.engagementWeight, 0.1, 5, 1),
    diversityBoost: typeof body.diversityBoost === 'boolean' ? body.diversityBoost : true,
    allowNonCrypto: typeof body.allowNonCrypto === 'boolean' ? body.allowNonCrypto : false,
    hideLowQualityThreshold: clamp(body.hideLowQualityThreshold, 0, 10, 1),
    updatedAt: Date.now(),
  };
}

function prefsKey(address: string): string {
  return `user:prefs:${address.toLowerCase()}`;
}

export async function handlePreferences(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (request.method === 'GET') {
    try {
      const raw = await env.CACHE?.get(prefsKey(session.address));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
        return noCacheJsonResponse({ ...DEFAULT_PREFS, ...parsed });
      }
    } catch {
      /* ignore */
    }
    return noCacheJsonResponse(DEFAULT_PREFS);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const bodySizeCheck = validateBodySize(request, 16 * 1024);
  if (!bodySizeCheck.ok) return jsonResponse({ error: bodySizeCheck.error }, 413);

  let body: PreferencesBody = {};
  try {
    body = (await request.json()) as PreferencesBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const sanitized = sanitizePrefs(body);
  try {
    await env.CACHE?.put(prefsKey(session.address), JSON.stringify(sanitized), {
      expirationTtl: 60 * 60 * 24 * 400,
    });
  } catch {
    return jsonResponse({ error: 'Failed to persist preferences' }, 500);
  }
  return noCacheJsonResponse({ ok: true, preferences: sanitized });
}
