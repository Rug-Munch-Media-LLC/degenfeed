/**
 * @degenfeed/api-worker — Lens Profile, Followers & Data Portability
 *
 * Routes:
 *   GET  /api/lens/profile/:id       — Get Lens profile data
 *   GET  /api/lens/profile/resolve   — Resolve handle → profile data
 *   GET  /api/lens/followers/:id     — Get followers for a profile
 *   GET  /api/lens/following/:id     — Get who a profile follows
 *   POST /api/lens/follow            — Follow a Lens profile
 *   POST /api/lens/unfollow          — Unfollow a Lens profile
 *   GET  /api/lens/export            — Export all Lens data (portable JSON)
 *   GET  /api/lens/export/download   — Download full data export as JSON file
 *
 * All data fetched via free public Lens v2 API or local indexer.
 * No paid API dependency.
 */

import { LENS_API_URL, LensClient } from '@degenfeed/lens-sdk';
import { LensDataExportService } from '@degenfeed/lens-sdk/data-export';
import type { Env } from '../index';
import { jsonResponse, log, noCacheJsonResponse } from '../index';
import { sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_API_URL_ENV = 'https://api-v2.lens.dev/graphql';
const IMAGE_PROXY = 'https://img.degenfeed.xyz/';

// ─── KV key helpers ─────────────────────────────────────────────────────────

function lensProfileCacheKey(profileId: string): string {
  return `lens:profile:${profileId}`;
}

// ─── GET /api/lens/profile/:id — Get Lens profile by ID ──────────────────

export async function handleLensProfileGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const profileId = pathParts[pathParts.length - 1];

  if (!profileId || profileId.length < 2) {
    return jsonResponse({ error: 'Invalid profile ID' }, 400);
  }

  // Check cache first
  const cacheKey = lensProfileCacheKey(profileId);
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) {
      return noCacheJsonResponse(JSON.parse(cached));
    }
  } catch {
    // cache miss
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const profile = await client.getProfile(profileId);

    if (!profile) {
      return jsonResponse({ error: 'Profile not found' }, 404);
    }

    const identity = client.profileToIdentity(profile);
    const result = {
      id: profile.id,
      handle: profile.handle?.localName || null,
      fullHandle: `${profile.handle?.localName || 'unknown'}.lens`,
      displayName: profile.metadata?.displayName || profile.handle?.localName || null,
      bio: profile.metadata?.bio || '',
      avatarUrl: profile.metadata?.picture?.optimized?.uri || '',
      stats: {
        followers: profile.stats?.followers || 0,
        following: profile.stats?.following || 0,
      },
      identity,
      source: 'lens_api',
    };

    // Cache for 5 minutes
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 });
    } catch {
      // non-critical
    }

    return noCacheJsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Failed to fetch Lens profile', detail: String(err) }, 502);
  }
}

// ─── GET /api/lens/profile/resolve — Resolve handle → profile ────────────

export async function handleLensProfileResolve(request: Request, env: Env): Promise<Response> {
  const handle = new URL(request.url).searchParams.get('handle');
  if (!handle) {
    return jsonResponse({ error: 'handle query parameter is required' }, 400);
  }

  const cleanHandle = handle.replace(/\.lens$/i, '');
  const cacheKey = `lens:resolve:${cleanHandle.toLowerCase()}`;

  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) {
      return noCacheJsonResponse(JSON.parse(cached));
    }
  } catch {
    // cache miss
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const profile = await client.getProfileByHandle(cleanHandle);

    if (!profile) {
      return jsonResponse({ error: `Handle @${cleanHandle}.lens not found` }, 404);
    }

    const result = {
      id: profile.id,
      handle: profile.handle?.localName || cleanHandle,
      fullHandle: `${profile.handle?.localName || cleanHandle}.lens`,
      displayName: profile.metadata?.displayName || profile.handle?.localName || cleanHandle,
      bio: profile.metadata?.bio || '',
      avatarUrl: profile.metadata?.picture?.optimized?.uri || '',
      stats: {
        followers: profile.stats?.followers || 0,
        following: profile.stats?.following || 0,
      },
      source: 'lens_api',
    };

    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(result), { expirationTtl: 300 });
    } catch {
      // non-critical
    }

    return noCacheJsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: 'Failed to resolve Lens handle', detail: String(err) }, 502);
  }
}

// ─── GET /api/lens/followers/:id — Get followers for a profile ──────────

export async function handleLensFollowers(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const profileId = pathParts[pathParts.length - 1];
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 50);

  if (!profileId) return jsonResponse({ error: 'Invalid profile ID' }, 400);

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const data = (await client.request(
      `query Followers($request: FollowersRequest!) {
        followers(request: $request) {
          items {
            wallet { address }
            profile {
              id
              handle { localName }
              metadata { displayName picture { ... on ImageSet { optimized { uri } } } }
            }
            followedAt
          }
          pageInfo { next }
        }
      }`,
      { request: { profileId, limit } },
    )) as {
      followers?: {
        items: Array<{
          wallet?: { address?: string };
          profile?: {
            id?: string;
            handle?: { localName?: string };
            metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
          };
          followedAt?: string;
        }>;
        pageInfo?: { next?: string };
      };
    };

    const followers = (data?.followers?.items || []).map((f) => ({
      profileId: f.profile?.id || '',
      handle: f.profile?.handle?.localName || '',
      displayName: f.profile?.metadata?.displayName || f.profile?.handle?.localName || '',
      avatarUrl: f.profile?.metadata?.picture?.optimized?.uri || '',
      wallet: f.wallet?.address || '',
      followedAt: f.followedAt || '',
    }));

    return noCacheJsonResponse({
      data: followers,
      meta: {
        total: followers.length,
        nextCursor: data?.followers?.pageInfo?.next || null,
      },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── GET /api/lens/following/:id — Get who a profile follows ────────────

export async function handleLensFollowing(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const profileId = pathParts[pathParts.length - 1];
  const limit = Math.min(Number(url.searchParams.get('limit')) || 25, 50);

  if (!profileId) return jsonResponse({ error: 'Invalid profile ID' }, 400);

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const data = (await client.request(
      `query Following($request: FollowingRequest!) {
        following(request: $request) {
          items {
            profile {
              id
              handle { localName }
              metadata { displayName picture { ... on ImageSet { optimized { uri } } } }
            }
            followedAt
          }
          pageInfo { next }
        }
      }`,
      { request: { profileId, limit } },
    )) as {
      following?: {
        items: Array<{
          profile?: {
            id?: string;
            handle?: { localName?: string };
            metadata?: { displayName?: string; picture?: { optimized?: { uri?: string } } };
          };
          followedAt?: string;
        }>;
        pageInfo?: { next?: string };
      };
    };

    const following = (data?.following?.items || []).map((f) => ({
      profileId: f.profile?.id || '',
      handle: f.profile?.handle?.localName || '',
      displayName: f.profile?.metadata?.displayName || f.profile?.handle?.localName || '',
      avatarUrl: f.profile?.metadata?.picture?.optimized?.uri || '',
      followedAt: f.followedAt || '',
    }));

    return noCacheJsonResponse({
      data: following,
      meta: {
        total: following.length,
        nextCursor: data?.following?.pageInfo?.next || null,
      },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── POST /api/lens/follow — Follow a Lens profile ──────────────────────

interface FollowBody {
  profileId: string;
}

export async function handleLensFollow(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  // Check linked Lens profile
  let lensAuth: { profileId: string; handle: string } | null = null;
  try {
    const raw = await env.CACHE?.get(`lens:linked:${session.address.toLowerCase()}`);
    if (raw) lensAuth = JSON.parse(raw);
  } catch {
    // no-op
  }

  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: FollowBody;
  try {
    body = (await request.json()) as FollowBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.profileId) {
    return jsonResponse({ error: 'profileId is required' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const result = await client.request(
      `mutation Follow($request: FollowRequest!) {
        follow(request: $request) {
          ... on RelayResult { txHash }
          ... on RelayError { reason }
        }
      }`,
      {
        request: {
          follow: [
            {
              profileId: body.profileId,
            },
          ],
        },
      },
    );

    return jsonResponse({ success: true, result });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── POST /api/lens/unfollow — Unfollow a Lens profile ──────────────────

interface UnfollowBody {
  profileId: string;
}

export async function handleLensUnfollow(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let lensAuth: { profileId: string; handle: string } | null = null;
  try {
    const raw = await env.CACHE?.get(`lens:linked:${session.address.toLowerCase()}`);
    if (raw) lensAuth = JSON.parse(raw);
  } catch {
    // no-op
  }

  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: UnfollowBody;
  try {
    body = (await request.json()) as UnfollowBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.profileId) {
    return jsonResponse({ error: 'profileId is required' }, 400);
  }

  try {
    const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
    const result = await client.request(
      `mutation Unfollow($request: UnfollowRequest!) {
        unfollow(request: $request) {
          ... on RelayResult { txHash }
          ... on RelayError { reason }
        }
      }`,
      { request: { profileId: body.profileId } },
    );

    return jsonResponse({ success: true, result });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 502);
  }
}

// ─── GET /api/lens/export — Export all Lens profile data ─────────────────

export async function handleLensExport(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // Get linked profile
  let lensAuth: { profileId: string; handle: string } | null = null;
  try {
    const raw = await env.CACHE?.get(`lens:linked:${walletAddress.toLowerCase()}`);
    if (raw) lensAuth = JSON.parse(raw);
  } catch {
    // no-op
  }

  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  try {
    const exportService = new LensDataExportService(env.LENS_API_URL || LENS_API_URL);
    const exportData = await exportService.exportAll(
      lensAuth.profileId,
      env as unknown as { CACHE?: KVNamespace },
      walletAddress,
    );

    return jsonResponse(exportData);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Export failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}

// ─── GET /api/lens/export/download — Download full data export as JSON ──

export async function handleLensExportDownload(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let lensAuth: { profileId: string; handle: string } | null = null;
  try {
    const raw = await env.CACHE?.get(`lens:linked:${walletAddress.toLowerCase()}`);
    if (raw) lensAuth = JSON.parse(raw);
  } catch {
    // no-op
  }

  if (!lensAuth) {
    return jsonResponse({ error: 'No Lens profile linked' }, 401);
  }

  try {
    const exportService = new LensDataExportService(env.LENS_API_URL || LENS_API_URL);
    const jsonStr = await exportService.exportJson(
      lensAuth.profileId,
      env as unknown as { CACHE?: KVNamespace },
      walletAddress,
    );

    const filename = `lens-${lensAuth.handle}-export-${Date.now()}.json`;

    return new Response(jsonStr, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        error: 'Export failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
}
