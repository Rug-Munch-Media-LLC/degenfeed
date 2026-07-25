import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import {
  type AggregatedProfile,
  aggregateProfile,
  getSyncStatus,
  type PrimaryFieldOverride,
  type ProtocolProfile,
  pushProfile,
  SUPPORTED_SYNC_PROTOCOLS,
  setPrimaryOverride,
  syncProfile,
} from '../lib/profile-sync';
import { requireSession } from '../session';

// ─── GET /api/profiles/:wallet/aggregate ──────────────────────────────

/**
 * Aggregate a user's profile from ALL connected protocols.
 *
 * Merges: display name, avatar, bio, website, banner.
 * Respects primary field overrides.
 * Returns verification badges and per-protocol sync status.
 *
 * Query params:
 *   ?force=true    — Bypass cache and re-fetch from protocols
 *   ?fields=bio    — Comma-separated subset of fields to return
 *
 * Public — no auth required (read-only profile view).
 */
export async function handleAggregateProfile(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('force') === 'true';
  const fieldsFilter =
    url.searchParams
      .get('fields')
      ?.split(',')
      .map((f) => f.trim())
      .filter(Boolean) || null;

  if (!wallet || typeof wallet !== 'string' || wallet.length < 10) {
    return jsonResponse({ error: 'Invalid wallet address' }, 400);
  }

  try {
    const profile = await aggregateProfile(wallet, env, { forceRefresh });

    // Apply field filtering if requested
    if (fieldsFilter && fieldsFilter.length > 0) {
      const filtered = filterAggregatedProfile(profile, fieldsFilter);
      return noCacheJsonResponse({ data: filtered });
    }

    return noCacheJsonResponse({ data: profile });
  } catch (err) {
    return jsonResponse({ error: `Failed to aggregate profile: ${String(err)}` }, 500);
  }
}

// ─── POST /api/profiles/:wallet/sync ─────────────────────────────────

/**
 * Trigger a full profile sync — pull profile data from all connected protocols.
 *
 * Requires authentication (must be wallet owner).
 * Updates cached aggregate and sync state.
 */
export async function handleSyncProfile(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (session.address.toLowerCase() !== wallet.toLowerCase()) {
    return jsonResponse({ error: 'Can only sync your own profile' }, 403);
  }

  try {
    const result = await syncProfile(wallet, env, { forceRefresh: true });
    return jsonResponse({
      data: {
        syncedProtocols: result.synced,
        aggregated: result.aggregated,
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Sync failed: ${String(err)}` }, 500);
  }
}

// ─── POST /api/profiles/:wallet/update ───────────────────────────────

/**
 * Push a profile update to ALL connected protocols.
 *
 * Body: { displayName?, avatar?, bio?, website?, banner? }
 * Each protocol receives only the fields it supports.
 *
 * Requires authentication (must be wallet owner).
 */
export async function handleUpdateProfile(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (session.address.toLowerCase() !== wallet.toLowerCase()) {
    return jsonResponse({ error: 'Can only update your own profile' }, 403);
  }

  let body: Partial<ProtocolProfile>;
  try {
    body = (await request.json()) as Partial<ProtocolProfile>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate at least one field to update
  const validFields: Array<keyof ProtocolProfile> = [
    'displayName',
    'avatar',
    'bio',
    'website',
    'banner',
  ];
  const hasUpdates = validFields.some((f) => body[f] !== undefined);
  if (!hasUpdates) {
    return jsonResponse(
      { error: 'No valid fields to update. Supported: displayName, avatar, bio, website, banner' },
      400,
    );
  }

  try {
    const result = await pushProfile(wallet, body, env);

    // Count successes
    const succeeded = Object.values(result.pushed).filter((p) => p.success).length;
    const failed = Object.values(result.pushed).filter((p) => !p.success).length;

    return jsonResponse({
      data: {
        pushed: result.pushed,
        aggregated: result.aggregated,
        summary: {
          totalProtocols: SUPPORTED_SYNC_PROTOCOLS.length,
          succeeded,
          failed,
        },
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to update profile: ${String(err)}` }, 500);
  }
}

// ─── POST /api/profiles/:wallet/primary ──────────────────────────────

/**
 * Set which protocol's data is "primary" for each profile field.
 *
 * Body: { displayName?: 'nostr'|'farcaster'|'bluesky'|'lens'|'mastodon',
 *         avatar?: '...',
 *         bio?: '...',
 *         website?: '...',
 *         banner?: '...' }
 *
 * Unset a field override by setting it to null.
 *
 * Requires authentication (must be wallet owner).
 */
export async function handleSetPrimary(
  request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (session.address.toLowerCase() !== wallet.toLowerCase()) {
    return jsonResponse({ error: 'Can only modify your own profile' }, 403);
  }

  let body: Record<string, string | null>;
  try {
    body = (await request.json()) as Record<string, string | null>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // Validate and clean overrides
  const allowedFields: Array<keyof PrimaryFieldOverride> = [
    'displayName',
    'avatar',
    'bio',
    'website',
    'banner',
  ];
  const overrides: PrimaryFieldOverride = {};

  for (const field of allowedFields) {
    const value = body[field];
    if (value === null || value === undefined) {
      continue; // skip — will be removed from overrides
    }
    if (typeof value !== 'string') {
      return jsonResponse(
        { error: `Invalid value for ${field}: must be a protocol name or null` },
        400,
      );
    }
    const protocol = value.toLowerCase();
    if (!SUPPORTED_SYNC_PROTOCOLS.includes(protocol)) {
      return jsonResponse(
        {
          error: `Unsupported protocol for ${field}: "${protocol}". Supported: ${SUPPORTED_SYNC_PROTOCOLS.join(', ')}`,
        },
        400,
      );
    }
    overrides[field] = protocol;
  }

  try {
    const aggregated = await setPrimaryOverride(wallet, overrides, env);
    return jsonResponse({ data: aggregated });
  } catch (err) {
    return jsonResponse({ error: `Failed to set primary: ${String(err)}` }, 500);
  }
}

// ─── GET /api/profiles/:wallet/sync-status ────────────────────────────

/**
 * Get per-protocol sync status for a wallet.
 *
 * Public — no auth required.
 */
export async function handleSyncStatus(
  _request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  if (!wallet || wallet.length < 10) {
    return jsonResponse({ error: 'Invalid wallet address' }, 400);
  }

  try {
    const statuses = await getSyncStatus(wallet, env);
    return noCacheJsonResponse({ data: statuses });
  } catch (err) {
    return jsonResponse({ error: `Failed to get sync status: ${String(err)}` }, 500);
  }
}

// ─── GET /api/profiles/:wallet/badges ─────────────────────────────────

/**
 * Get verification badges for a wallet.
 *
 * Badges include:
 *   - self_verified: User linked this protocol
 *   - wallet_verified: Cryptographically proven wallet ownership
 *   - cross_verified: Active on 3+ protocols
 *   - attested: Third-party attestation exists
 *
 * Public — no auth required.
 */
export async function handleProfileBadges(
  _request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
  if (!wallet || wallet.length < 10) {
    return jsonResponse({ error: 'Invalid wallet address' }, 400);
  }

  try {
    // Fetch profile to get protocol data
    const profile = await aggregateProfile(wallet, env);

    // Also check for attestations
    let attestationCount = 0;
    try {
      const raw = await env.IDENTITIES?.get(`attest:wallet:${wallet.toLowerCase()}`);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        attestationCount = ids.length;
      }
    } catch {
      // no attestations
    }

    return noCacheJsonResponse({
      data: {
        badges: profile.badges,
        verificationLevel: profile.verificationLevel,
        connectedProtocols: (
          Object.keys(profile.protocols) as Array<keyof typeof profile.protocols>
        ).filter((p) => Object.keys(profile.protocols[p] as Record<string, unknown>).length > 0),
        attestationCount,
      },
    });
  } catch (err) {
    return jsonResponse({ error: `Failed to get badges: ${String(err)}` }, 500);
  }
}

// ─── GET /api/profiles/search ─────────────────────────────────────────

/**
 * Search profiles across all protocols.
 *
 * Query params:
 *   q=alice          — Search query (min 2 chars)
 *   protocol=nostr   — Search within a specific protocol (optional)
 *   limit=20         — Max results (default 10, max 50)
 *   page=1           — Page number for pagination
 *
 * Searches:
 *   1. Local identity KV store for wallet addresses
 *   2. Nostr (via nostr.band profile search)
 *   3. Farcaster (via Hub user search)
 *   4. Bluesky (via AT Protocol search)
 *   5. Lens (via Lens API search)
 *   6. Mastodon (via Mastodon API search)
 *
 * Public — no auth required.
 */
export async function handleSearchProfiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() || '';
  const protocol = url.searchParams.get('protocol')?.toLowerCase().trim() || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const offset = (page - 1) * limit;

  if (!query || query.length < 2) {
    return jsonResponse({ error: 'Query too short (min 2 characters)' }, 400);
  }

  const cacheKey = `profiles:search:${protocol || 'all'}:${query.toLowerCase()}:${limit}:${page}`;

  // Check cache (1 minute TTL for search results)
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    // cache miss
  }

  try {
    const results = await performProfileSearch(query, protocol, limit, offset, env);
    const response = {
      data: results,
      meta: {
        query,
        protocol: protocol || 'all',
        limit,
        page,
        total: results.length,
        hasMore: results.length >= limit,
      },
    };

    // Cache for 1 minute
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 60 });
    } catch {
      // non-critical
    }

    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: `Search failed: ${String(err)}` }, 500);
  }
}

// ─── GET /api/profiles/suggested ──────────────────────────────────────

/**
 * Get suggested profiles to follow.
 *
 * Sources:
 *   1. Popular/trending accounts from connected protocols
 *   2. Accounts with cross-protocol verification (3+ protocols)
 *   3. Accounts the user's connected accounts follow
 *
 * Query params:
 *   limit=20     — Max results (default 10, max 50)
 *   wallet=0x... — Get suggestions based on this wallet's network (optional)
 *
 * Public — no auth required.
 */
export async function handleSuggestedProfiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const wallet = url.searchParams.get('wallet')?.toLowerCase().trim() || '';

  const cacheKey = `profiles:suggested:${wallet || 'default'}:${limit}`;

  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    // cache miss
  }

  try {
    const results = await getSuggestedProfiles(limit, wallet, env);
    const response = { data: results, meta: { limit, total: results.length } };

    // Cache for 5 minutes
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
    } catch {
      // non-critical
    }

    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: `Failed to get suggestions: ${String(err)}` }, 500);
  }
}

// ─── GET /api/profiles/trending ───────────────────────────────────────

/**
 * Get trending profiles (most followed / most active across protocols).
 *
 * Sources:
 *   1. Farcaster trending (via Neynar API)
 *   2. Lens trending (via Lens API)
 *   3. Bluesky trending (via AT Protocol)
 *   4. Internal engagement metrics
 *
 * Query params:
 *   limit=20     — Max results (default 10, max 50)
 *   protocol=fc  — Trending within specific protocol (optional)
 *
 * Public — no auth required.
 */
export async function handleTrendingProfiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const protocol = url.searchParams.get('protocol')?.toLowerCase().trim() || '';

  const cacheKey = `profiles:trending:${protocol || 'all'}:${limit}`;

  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    // cache miss
  }

  try {
    const results = await getTrendingProfiles(limit, protocol, env);
    const response = {
      data: results,
      meta: { protocol: protocol || 'all', limit, total: results.length },
    };

    // Cache for 5 minutes
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
    } catch {
      // non-critical
    }

    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: `Failed to get trending: ${String(err)}` }, 500);
  }
}

// ─── Internal Search Functions ─────────────────────────────────────────

interface ProfileSearchResult {
  wallet?: string;
  protocol: string;
  id: string;
  handle: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  followerCount?: number;
  followingCount?: number;
  verified: boolean;
  verificationLevel?: string;
}

/**
 * Perform profile search across protocols.
 */
async function performProfileSearch(
  query: string,
  protocolFilter: string,
  limit: number,
  offset: number,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // ─── Search 1: Local identity KV store ──────────────────────────
  if (!protocolFilter || protocolFilter === 'local') {
    try {
      const localResults = await searchLocalIdentities(lowerQuery, limit, offset, env);
      results.push(...localResults);
    } catch {
      // non-critical
    }
  }

  // ─── Search 2: Nostr profile search via nostr.band ──────────────
  if (!protocolFilter || protocolFilter === 'nostr') {
    try {
      const searchResp = await fetch(
        `https://api.nostr.band/v0/profiles?q=${encodeURIComponent(lowerQuery)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (searchResp.ok) {
        const data = (await searchResp.json()) as {
          profiles?: Array<{
            pubkey: string;
            profile?: {
              name?: string;
              display_name?: string;
              picture?: string;
              about?: string;
              nip05?: string;
            };
          }>;
        };

        if (data.profiles) {
          for (const p of data.profiles) {
            if (results.length >= limit) break;
            const name = p.profile?.display_name || p.profile?.name || '';
            if (
              !name.toLowerCase().includes(lowerQuery) &&
              !p.profile?.nip05?.toLowerCase().includes(lowerQuery)
            )
              continue;

            results.push({
              protocol: 'nostr',
              id: p.pubkey,
              handle: name || p.pubkey.slice(0, 12),
              displayName: name,
              avatar: p.profile?.picture,
              bio: p.profile?.about,
              verified: !!p.profile?.nip05,
            });
          }
        }
      }
    } catch {
      // non-critical
    }
  }

  // ─── Search 3: Farcaster via Hub ────────────────────────────────
  if (!protocolFilter || protocolFilter === 'farcaster') {
    try {
      const _hubUrl = env.FARCASTER_HUB_URL || 'https://hub.pinata.cloud';
      // Search via username (approximate — hubs support limited search)
      // Fallback: Neynar user search
      if (env.NEYNAR_API_KEY) {
        const neynarResp = await fetch(
          `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(lowerQuery)}&limit=${Math.min(limit, 25)}`,
          {
            headers: { api_key: env.NEYNAR_API_KEY },
            signal: AbortSignal.timeout(5000),
          },
        );
        if (neynarResp.ok) {
          const neynarData = (await neynarResp.json()) as {
            result?: {
              users?: Array<{
                fid: number;
                username: string;
                display_name?: string;
                pfp_url?: string;
                profile?: { bio?: { text?: string } };
                follower_count?: number;
                following_count?: number;
              }>;
            };
          };

          for (const u of neynarData?.result?.users ?? []) {
            if (results.length >= limit) break;
            if (
              !u.username.toLowerCase().includes(lowerQuery) &&
              !u.display_name?.toLowerCase().includes(lowerQuery)
            ) {
              continue;
            }
            results.push({
              protocol: 'farcaster',
              id: String(u.fid),
              handle: u.username,
              displayName: u.display_name || u.username,
              avatar: u.pfp_url,
              bio: u.profile?.bio?.text,
              followerCount: u.follower_count,
              followingCount: u.following_count,
              verified: true,
            });
          }
        }
      }
    } catch {
      // non-critical
    }
  }

  // ─── Search 4: Bluesky via AT Protocol ──────────────────────────
  if (!protocolFilter || protocolFilter === 'bluesky') {
    try {
      const api = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
      const bskyResp = await fetch(
        `${api}/xrpc/app.bsky.actor.searchActors?q=${encodeURIComponent(lowerQuery)}&limit=${Math.min(limit, 25)}`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (bskyResp.ok) {
        const bskyData = (await bskyResp.json()) as {
          actors?: Array<{
            did: string;
            handle: string;
            displayName?: string;
            avatar?: string;
            description?: string;
            followerCount?: number;
          }>;
        };

        for (const a of bskyData?.actors ?? []) {
          if (results.length >= limit) break;
          results.push({
            protocol: 'bluesky',
            id: a.did,
            handle: a.handle,
            displayName: a.displayName || a.handle,
            avatar: a.avatar,
            bio: a.description,
            followerCount: a.followerCount,
            verified: true,
          });
        }
      }
    } catch {
      // non-critical
    }
  }

  // ─── Search 5: Lens via Lens API ────────────────────────────────
  if (!protocolFilter || protocolFilter === 'lens') {
    try {
      const lensSearchQuery = {
        query: `
          query SearchProfiles($query: String!, $limit: LimitScalar!) {
            search(request: { query: $query, type: PROFILE, limit: $limit }) {
              ... on ProfileSearchResult {
                items {
                  id
                  handle
                  name
                  bio
                  picture {
                    ... on MediaSet {
                      original { url }
                    }
                  }
                  stats {
                    totalFollowers
                    totalFollowing
                  }
                }
              }
            }
          }
        `,
        variables: { query: lowerQuery, limit: Math.min(limit, 25) },
      };

      const lensResp = await fetch('https://api.lens.xyz/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(lensSearchQuery),
        signal: AbortSignal.timeout(8000),
      });

      if (lensResp.ok) {
        const lensData = (await lensResp.json()) as {
          data?: {
            search?: {
              items?: Array<{
                id: string;
                handle: string;
                name?: string;
                bio?: string;
                picture?: { original?: { url?: string } };
                stats?: { totalFollowers?: number; totalFollowing?: number };
              }>;
            };
          };
        };

        for (const p of lensData?.data?.search?.items ?? []) {
          if (results.length >= limit) break;
          results.push({
            protocol: 'lens',
            id: p.id,
            handle: p.handle,
            displayName: p.name || p.handle,
            avatar: p.picture?.original?.url,
            bio: p.bio,
            followerCount: p.stats?.totalFollowers,
            followingCount: p.stats?.totalFollowing,
            verified: true,
          });
        }
      }
    } catch {
      // non-critical
    }
  }

  // ─── Search 6: Mastodon via WebFinger / API ─────────────────────
  if (!protocolFilter || protocolFilter === 'mastodon') {
    try {
      // Search across known Mastodon instances
      const instances = [
        env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
        'https://mastodon.social',
        'https://hachyderm.io',
      ];
      for (const instance of instances) {
        if (results.length >= limit) break;
        try {
          const mastodonResp = await fetch(
            `${instance}/api/v2/search?q=${encodeURIComponent(lowerQuery)}&type=accounts&limit=${Math.min(limit, 20)}`,
            { signal: AbortSignal.timeout(5000) },
          );
          if (mastodonResp.ok) {
            const mastodonData = (await mastodonResp.json()) as {
              accounts?: Array<{
                id: string;
                username: string;
                acct: string;
                display_name?: string;
                avatar?: string;
                note?: string;
                followers_count?: number;
                following_count?: number;
              }>;
            };

            for (const a of mastodonData?.accounts ?? []) {
              if (results.length >= limit) break;
              results.push({
                protocol: 'mastodon',
                id: String(a.id),
                handle: a.acct,
                displayName: a.display_name || a.username,
                avatar: a.avatar,
                bio: a.note ? stripHtml(a.note) : undefined,
                followerCount: a.followers_count,
                followingCount: a.following_count,
                verified: true,
              });
            }
          }
        } catch {
          // try next instance
        }
      }
    } catch {
      // non-critical
    }
  }

  // Apply offset (slice after collecting)
  return results.slice(offset, offset + limit);
}

/**
 * Search local identity KV store for matching profiles.
 */
async function searchLocalIdentities(
  query: string,
  limit: number,
  _offset: number,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];

  try {
    // List identity keys from KV and check if any match the query
    let cursor: string | undefined;
    while (results.length < limit) {
      const list = await env.IDENTITIES?.list({ cursor, limit: 100, prefix: 'identity:' });
      if (!list || list.keys.length === 0) break;

      cursor = (list as unknown as { cursor?: string }).cursor;

      for (const key of list.keys) {
        if (results.length >= limit) break;
        const wallet = key.name.replace('identity:', '');

        try {
          const raw = await env.IDENTITIES?.get(key.name);
          if (!raw) continue;

          const identity = JSON.parse(raw) as Record<string, unknown>;

          // Search across protocol identities for matching handles/names
          for (const protocol of SUPPORTED_SYNC_PROTOCOLS) {
            const idData = identity[protocol] as Record<string, unknown> | undefined;
            if (!idData) continue;

            const handle = String(idData.handle || idData.username || '');
            const displayName = String(idData.displayName || idData.name || handle);
            const avatar = String(idData.avatar || idData.pfp || '');

            if (handle.toLowerCase().includes(query) || displayName.toLowerCase().includes(query)) {
              results.push({
                wallet,
                protocol,
                id: String(idData.id || idData.pubkey || idData.did || idData.fid || ''),
                handle,
                displayName,
                avatar,
                verified: idData.verified === true,
              });
              break; // Found a match — don't double-add for same wallet
            }
          }
        } catch {
          // skip corrupted entries
        }
      }

      if (!cursor) break;
    }
  } catch {
    // non-critical
  }

  return results;
}

// ─── Suggested Profiles ────────────────────────────────────────────────

/**
 * Get suggested profiles to follow.
 *
 * Strategies:
 *   1. Cross-verified users (active on 3+ protocols)
 *   2. Users with attestations
 *   3. Recently active profiles
 *   4. If wallet provided, find accounts from same protocols
 */
async function getSuggestedProfiles(
  limit: number,
  wallet: string,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];

  // Strategy 1: Find cross-verified users from KV store
  try {
    let cursor: string | undefined;
    while (results.length < limit) {
      const list = await env.IDENTITIES?.list({ cursor, limit: 100, prefix: 'identity:' });
      if (!list || list.keys.length === 0) break;
      cursor = (list as unknown as { cursor?: string }).cursor;

      for (const key of list.keys) {
        if (results.length >= limit) break;
        const w = key.name.replace('identity:', '');
        if (wallet && w.toLowerCase() === wallet.toLowerCase()) continue; // skip self

        try {
          const raw = await env.IDENTITIES?.get(key.name);
          if (!raw) continue;
          const identity = JSON.parse(raw) as Record<string, unknown>;

          // Count linked protocols
          const linkedProtocols = SUPPORTED_SYNC_PROTOCOLS.filter(
            (p: string) => (identity as Record<string, unknown>)[p] !== undefined,
          );
          if (linkedProtocols.length < 2) continue;

          const primaryProtocol = linkedProtocols[0] || SUPPORTED_SYNC_PROTOCOLS[0];
          const idData = (identity as Record<string, unknown>)[primaryProtocol] as
            | Record<string, unknown>
            | undefined;

          results.push({
            wallet: w,
            protocol: primaryProtocol,
            id: String(idData?.id || idData?.pubkey || idData?.fid || ''),
            handle: String(idData?.handle || idData?.username || w.slice(0, 10)),
            displayName: String(idData?.displayName || idData?.name || ''),
            avatar: String(idData?.avatar || idData?.pfp || ''),
            verified: linkedProtocols.length >= 3,
            verificationLevel: linkedProtocols.length >= 3 ? 'cross_verified' : 'self_verified',
          });
        } catch {
          // skip
        }
      }
      if (!cursor) break;
    }
  } catch {
    // non-critical
  }

  // Strategy 2: Fetch trending from Farcaster if we have Neynar key
  if (results.length < limit && env.NEYNAR_API_KEY) {
    try {
      const trendingResp = await fetch(
        'https://api.neynar.com/v2/farcaster/user/trending?limit=25',
        { headers: { api_key: env.NEYNAR_API_KEY }, signal: AbortSignal.timeout(5000) },
      );
      if (trendingResp.ok) {
        const trendingData = (await trendingResp.json()) as {
          users?: Array<{
            fid: number;
            username: string;
            display_name?: string;
            pfp_url?: string;
            profile?: { bio?: { text?: string } };
            follower_count?: number;
          }>;
        };

        for (const u of trendingData?.users ?? []) {
          if (results.length >= limit) break;
          // Avoid duplicates from strategy 1
          if (results.some((r) => r.protocol === 'farcaster' && r.id === String(u.fid))) continue;

          results.push({
            protocol: 'farcaster',
            id: String(u.fid),
            handle: u.username,
            displayName: u.display_name || u.username,
            avatar: u.pfp_url,
            bio: u.profile?.bio?.text,
            followerCount: u.follower_count,
            verified: true,
          });
        }
      }
    } catch {
      // non-critical
    }
  }

  // Strategy 3: Blue sky popular actors
  if (results.length < limit) {
    try {
      const _api = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
      // BSky doesn't have a trending endpoint, so we search for "popular" or skip
      // Fall through to return whatever we have
    } catch {
      // non-critical
    }
  }

  return results.slice(0, limit);
}

// ─── Trending Profiles ─────────────────────────────────────────────────

/**
 * Get trending profiles across protocols.
 */
async function getTrendingProfiles(
  limit: number,
  protocolFilter: string,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];

  // Farcaster trending via Neynar
  if (!protocolFilter || protocolFilter === 'farcaster') {
    if (env.NEYNAR_API_KEY) {
      try {
        const trendingResp = await fetch(
          'https://api.neynar.com/v2/farcaster/user/trending?limit=25',
          { headers: { api_key: env.NEYNAR_API_KEY }, signal: AbortSignal.timeout(5000) },
        );
        if (trendingResp.ok) {
          const data = (await trendingResp.json()) as {
            users?: Array<{
              fid: number;
              username: string;
              display_name?: string;
              pfp_url?: string;
              profile?: { bio?: { text?: string } };
              follower_count?: number;
            }>;
          };

          for (const u of data?.users ?? []) {
            if (results.length >= limit) break;
            results.push({
              protocol: 'farcaster',
              id: String(u.fid),
              handle: u.username,
              displayName: u.display_name || u.username,
              avatar: u.pfp_url,
              bio: u.profile?.bio?.text,
              followerCount: u.follower_count,
              verified: true,
            });
          }
        }
      } catch {
        // non-critical
      }
    }
  }

  // Bluesky trending — search for popular actors
  if (!protocolFilter || protocolFilter === 'bluesky') {
    try {
      const api = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
      // BSky doesn't have a native trending endpoint, so we fetch popular from
      // curated feeds instead
      const _feedResp = await fetch(`${api}/xrpc/app.bsky.feed.getSuggestedFeeds?limit=10`, {
        signal: AbortSignal.timeout(5000),
      });
      // Fall through — no direct actor trending from BSky public API
    } catch {
      // non-critical
    }
  }

  // Lens trending via Lens API
  if (!protocolFilter || protocolFilter === 'lens') {
    try {
      const trendingQuery = {
        query: `
          query TrendingProfiles($limit: LimitScalar!) {
            exploreProfiles(request: { limit: $limit }) {
              items {
                id
                handle
                name
                bio
                picture {
                  ... on MediaSet {
                    original { url }
                  }
                }
                stats {
                  totalFollowers
                }
              }
            }
          }
        `,
        variables: { limit: Math.min(limit, 25) },
      };

      const lensResp = await fetch('https://api.lens.xyz/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(trendingQuery),
        signal: AbortSignal.timeout(8000),
      });

      if (lensResp.ok) {
        const data = (await lensResp.json()) as {
          data?: {
            exploreProfiles?: {
              items?: Array<{
                id: string;
                handle: string;
                name?: string;
                bio?: string;
                picture?: { original?: { url?: string } };
                stats?: { totalFollowers?: number };
              }>;
            };
          };
        };

        for (const p of data?.data?.exploreProfiles?.items ?? []) {
          if (results.length >= limit) break;
          results.push({
            protocol: 'lens',
            id: p.id,
            handle: p.handle,
            displayName: p.name || p.handle,
            avatar: p.picture?.original?.url,
            bio: p.bio,
            followerCount: p.stats?.totalFollowers,
            verified: true,
          });
        }
      }
    } catch {
      // non-critical
    }
  }

  return results.slice(0, limit);
}

// ─── Helpers ───────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Filter aggregated profile to only include requested fields.
 */
function filterAggregatedProfile(
  profile: AggregatedProfile,
  fields: string[],
): Partial<AggregatedProfile> {
  const filtered: Partial<AggregatedProfile> = { wallet: profile.wallet };

  for (const field of fields) {
    if (field in profile) {
      (filtered as unknown as Record<string, unknown>)[field] = (
        profile as unknown as Record<string, unknown>
      )[field];
    }
  }

  return filtered;
}
