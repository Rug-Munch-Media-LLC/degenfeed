/**
 * /api/translate — Protocol content translation endpoint.
 *
 * POST /api/translate
 * Body: { content: string, fromProtocol: string, toProtocol: string }
 * Returns: { translated, truncated, originalLength, translatedLength, maxLength, ... }
 *
 * Applies protocol-specific formatting rules so cross-protocol posts
 * feel native, not copy-pasted. Caches identical translation requests
 * via KV (1h TTL) to avoid redundant work.
 */

import { translateContent } from '@degenfeed/utils';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';
import { requireSession } from '../session';

// ─── Supported protocol keys for translation ────────────────────────

const TRANSLATABLE_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'mastodon',
  'bluesky',
  'lemmy',
]);

// ─── Request shape ──────────────────────────────────────────────────

interface TranslateRequest {
  content?: string;
  fromProtocol?: string;
  toProtocol?: string;
}

// ─── Handler ────────────────────────────────────────────────────────

export async function handleTranslate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed — use POST' }, 405);
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: TranslateRequest;
  try {
    body = (await request.json()) as TranslateRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const content = sanitizeString(body.content, 10000);
  const fromProtocol = sanitizeString(body.fromProtocol, 32).toLowerCase();
  const toProtocol = sanitizeString(body.toProtocol, 32).toLowerCase();

  if (!content) {
    return jsonResponse({ error: 'Missing required field: content' }, 400);
  }
  if (!fromProtocol || !toProtocol) {
    return jsonResponse({ error: 'Missing required fields: fromProtocol, toProtocol' }, 400);
  }

  if (!TRANSLATABLE_PROTOCOLS.has(fromProtocol)) {
    return jsonResponse(
      {
        error: `Unsupported source protocol: ${fromProtocol}`,
        supported: Array.from(TRANSLATABLE_PROTOCOLS),
      },
      400,
    );
  }
  if (!TRANSLATABLE_PROTOCOLS.has(toProtocol)) {
    return jsonResponse(
      {
        error: `Unsupported target protocol: ${toProtocol}`,
        supported: Array.from(TRANSLATABLE_PROTOCOLS),
      },
      400,
    );
  }

  if (fromProtocol === toProtocol) {
    return jsonResponse(
      {
        error: 'Source and target protocol are the same',
        translated: content,
        note: 'No translation needed',
      },
      200,
    );
  }

  if (hasSuspiciousPayload(content)) {
    return jsonResponse({ error: 'Content contains suspicious patterns' }, 400);
  }

  // ─── Check cache ───────────────────────────────────────────
  const cacheKey = `translate:${fromProtocol}:${toProtocol}:${hashContent(content)}`;
  if (env.CACHE) {
    try {
      const cached = await env.CACHE.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        return jsonResponse(parsed);
      }
    } catch {
      /* cache miss — translate fresh */
    }
  }

  // ─── Translate ─────────────────────────────────────────────
  const result = translateContent(content, fromProtocol, toProtocol);

  // ─── Store in cache (1h TTL) ───────────────────────────────
  if (env.CACHE) {
    try {
      await env.CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 3600,
      });
    } catch {
      /* non-critical — cache is best-effort */
    }
  }

  return noCacheJsonResponse(result, 200);
}

// ─── Simple content hash for cache keys ─────────────────────────────

function hashContent(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
