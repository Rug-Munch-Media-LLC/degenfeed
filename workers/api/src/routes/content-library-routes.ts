/**
 * @degenfeed/api-worker — Content Library API Routes
 *
 * CRUD operations for the unified content library.
 *
 * GET    /api/content/library                      — List all content (filterable)
 * GET    /api/content/library/:contentId            — Get content detail with all protocol copies
 * PUT    /api/content/library/:contentId            — Update content (edit, add protocols)
 * DELETE /api/content/library/:contentId            — Delete content (optionally from protocols)
 * POST   /api/content/library/:contentId/sync       — Sync engagement metrics from all protocols
 *
 * POST   /api/content/library/:contentId/license    — Set content license
 * GET    /api/content/library/:contentId/license    — Get content license
 *
 * POST   /api/content/library/:contentId/monetization  — Set monetization config
 * GET    /api/content/library/:contentId/monetization  — Get monetization config
 *
 * GET    /api/content/library/:contentId/usage         — Get usage history
 *
 * POST   /api/content/library/sync-all                 — Sync engagement for ALL content
 */

import { type Env, jsonResponse } from '../index';
import type { ContentType } from '../lib/content-library';
import {
  deleteContent,
  getContent,
  listContent,
  syncEngagement,
  updateContent,
} from '../lib/content-library';
import type { LicenseType, MonetizationType } from '../lib/rights-manager';
import {
  getLicense,
  getMonetization,
  getUsage,
  setLicense,
  setMonetization,
} from '../lib/rights-manager';
import { requireSession } from '../session';
import { methodNotAllowed } from '../response-helpers';
/**
 * GET /api/content/library
 * List all content for the authenticated user.
 */
export async function handleListContentLibrary(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') as ContentType | null;
    const protocol = url.searchParams.get('protocol') || undefined;
    const cursor = url.searchParams.get('cursor') || undefined;
    const limitStr = url.searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const sort =
      (url.searchParams.get('sort') as 'newest' | 'oldest' | 'engagement' | 'updated') || 'newest';

    const result = await listContent(env, session.address, {
      type: type ?? undefined,
      protocol,
      cursor,
      limit,
      sort,
    });

    return jsonResponse({
      items: result.items,
      nextCursor: result.nextCursor,
      total: result.total,
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/library/:contentId
 * Get a single content record with full detail.
 */
export async function handleGetContentLibraryItem(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const record = await getContent(env, session.address, contentId);
    if (!record) return jsonResponse({ error: 'Content not found' }, 404);

    // Get license and monetization info
    const license = await getLicense(env, contentId);
    const monetization = await getMonetization(env, contentId);

    return jsonResponse({ data: { ...record, license, monetization } });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * PUT /api/content/library/:contentId
 * Update content record.
 */
export async function handleUpdateContentLibraryItem(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const body = (await request.json()) as Record<string, unknown>;

    const updated = await updateContent(env, session.address, contentId, {
      title: body.title as string | undefined,
      body: body.body as string | undefined,
      tags: body.tags as string[] | undefined,
      niches: body.niches as string[] | undefined,
    });

    if (!updated) return jsonResponse({ error: 'Content not found' }, 404);

    return jsonResponse({ data: updated });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * DELETE /api/content/library/:contentId
 * Delete content (soft-delete, optionally from protocols too).
 */
export async function handleDeleteContentLibraryItem(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const url = new URL(request.url);
    const removeFromProtocols = url.searchParams.get('removeFromProtocols') === 'true';

    const deleted = await deleteContent(env, session.address, contentId, removeFromProtocols);
    if (!deleted) return jsonResponse({ error: 'Content not found' }, 404);

    return jsonResponse({ ok: true, deletedId: contentId });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/library/:contentId/sync
 * Sync engagement metrics from all protocols.
 */
export async function handleSyncContentEngagement(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const updated = await syncEngagement(env, session.address, contentId);
    if (!updated) return jsonResponse({ error: 'Content not found' }, 404);

    return jsonResponse({ data: updated });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/library/:contentId/license
 * Set license for content.
 */
export async function handleSetContentLicense(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const body = (await request.json()) as {
      license: LicenseType;
      customText?: string;
      additionalTerms?: string;
      jurisdiction?: string;
    };
    if (!body.license) return jsonResponse({ error: 'License type is required' }, 400);

    // Verify content exists
    const record = await getContent(env, session.address, contentId);
    if (!record) return jsonResponse({ error: 'Content not found' }, 404);

    const result = await setLicense(env, session.address, contentId, body.license, {
      customText: body.customText,
      additionalTerms: body.additionalTerms,
      jurisdiction: body.jurisdiction,
    });

    return jsonResponse({ data: result });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/library/:contentId/license
 * Get license for content.
 */
export async function handleGetContentLicense(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const license = await getLicense(env, contentId);
    if (!license) return jsonResponse({ error: 'No license set for this content' }, 404);

    return jsonResponse({ data: license });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/library/:contentId/monetization
 * Set monetization configuration.
 */
export async function handleSetContentMonetization(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const body = (await request.json()) as {
      type: MonetizationType;
      enabled: boolean;
      tokenAddress?: string;
      tokenChain?: string;
      minTokens?: string;
      price?: string;
      priceToken?: string;
      suggestedTips?: string[];
      platformFeeBps?: number;
    };
    if (!body.type) return jsonResponse({ error: 'Monetization type is required' }, 400);

    // Verify content exists
    const record = await getContent(env, session.address, contentId);
    if (!record) return jsonResponse({ error: 'Content not found' }, 404);

    const result = await setMonetization(env, session.address, contentId, {
      type: body.type,
      enabled: body.enabled ?? true,
      tokenAddress: body.tokenAddress,
      tokenChain: body.tokenChain,
      minTokens: body.minTokens,
      price: body.price,
      priceToken: body.priceToken,
      suggestedTips: body.suggestedTips,
      platformFeeBps: body.platformFeeBps,
    });

    return jsonResponse({ data: result });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/library/:contentId/monetization
 * Get monetization configuration.
 */
export async function handleGetContentMonetization(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const monetization = await getMonetization(env, contentId);
    if (!monetization)
      return jsonResponse({ error: 'No monetization config for this content' }, 404);

    return jsonResponse({ data: monetization });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * GET /api/content/library/:contentId/usage
 * Get usage/repost history for content.
 */
export async function handleGetContentUsage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const contentId = extractContentId(request);
    if (!contentId) return jsonResponse({ error: 'Missing content ID' }, 400);

    const usage = await getUsage(env, contentId);
    return jsonResponse({ data: usage });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

/**
 * POST /api/content/library/sync-all
 * Sync engagement for ALL content belonging to the authenticated user.
 */
export async function handleSyncAllContentEngagement(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const result = await listContent(env, session.address, { limit: 100 });
    let synced = 0;

    for (const item of result.items) {
      try {
        await syncEngagement(env, session.address, item.id);
        synced++;
      } catch {
        // Continue with next
      }
    }

    return jsonResponse({ ok: true, synced, total: result.items.length });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractContentId(request: Request): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('library');
  if (idx >= 0 && parts.length > idx + 1) {
    const contentId = parts[idx + 1] ?? null;
    if (!contentId) return null;
    const subResources = ['sync', 'license', 'monetization', 'usage'];
    const subPath = parts[idx + 2] ?? '';
    if (subResources.includes(subPath)) {
      return contentId;
    }
    return contentId;
  }
  return null;
}
