/**
 * @degenfeed/api-worker — Unified Profile Data
 *
 * Data aggregation, search, suggestions, trending.
 */

import { aggregateProfile, SUPPORTED_SYNC_PROTOCOLS } from '../../lib/profile-sync';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import type { ProfileSearchResult } from './types';
import { filterAggregatedProfile, stripHtml } from './utils';

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
  if (!wallet || typeof wallet !== 'string' || wallet.length < 10)
    return jsonResponse({ error: 'Invalid wallet address' }, 400);
  try {
    const profile = await aggregateProfile(wallet, env, { forceRefresh });
    if (fieldsFilter && fieldsFilter.length > 0)
      return noCacheJsonResponse({ data: filterAggregatedProfile(profile, fieldsFilter) });
    return noCacheJsonResponse({ data: profile });
  } catch (err) {
    return jsonResponse({ error: `Failed to aggregate profile: ${String(err)}` }, 500);
  }
}

export async function handleSearchProfiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim() || '';
  const protocol = url.searchParams.get('protocol')?.toLowerCase().trim() || '';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const offset = (page - 1) * limit;
  if (!query || query.length < 2)
    return jsonResponse({ error: 'Query too short (min 2 characters)' }, 400);
  const cacheKey = `profiles:search:${protocol || 'all'}:${query.toLowerCase()}:${limit}:${page}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* miss */
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
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 60 });
    } catch {
      /* non-critical */
    }
    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: `Search failed: ${String(err)}` }, 500);
  }
}

export async function handleSuggestedProfiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const wallet = url.searchParams.get('wallet')?.toLowerCase().trim() || '';
  const cacheKey = `profiles:suggested:${wallet || 'default'}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* miss */
  }
  try {
    const results = await getSuggestedProfiles(limit, wallet, env);
    const response = { data: results, meta: { limit, total: results.length } };
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
    } catch {
      /* non-critical */
    }
    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: `Failed to get suggestions: ${String(err)}` }, 500);
  }
}

export async function handleTrendingProfiles(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const protocol = url.searchParams.get('protocol')?.toLowerCase().trim() || '';
  const cacheKey = `profiles:trending:${protocol || 'all'}:${limit}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* miss */
  }
  try {
    const results = await getTrendingProfiles(limit, protocol, env);
    const response = {
      data: results,
      meta: { protocol: protocol || 'all', limit, total: results.length },
    };
    try {
      await env.CACHE?.put(cacheKey, JSON.stringify(response), { expirationTtl: 300 });
    } catch {
      /* non-critical */
    }
    return jsonResponse(response);
  } catch (err) {
    return jsonResponse({ error: `Failed to get trending: ${String(err)}` }, 500);
  }
}

// ─── Internal: Profile Search ────────────────────────────────────────────

async function performProfileSearch(
  query: string,
  protocolFilter: string,
  limit: number,
  offset: number,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  if (!protocolFilter || protocolFilter === 'local') {
    try {
      results.push(...(await searchLocalIdentities(lowerQuery, limit, offset, env)));
    } catch {
      /* non-critical */
    }
  }

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
        if (data.profiles)
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
    } catch {
      /* non-critical */
    }
  }

  if (!protocolFilter || protocolFilter === 'farcaster') {
    try {
      const hubUrl = 'http://127.0.0.1:2281';
      // Try resolving as a username via Hubble's on-chain proof
      const nameProofResp = await fetch(
        `${hubUrl}/v1/userNameProofByName?name=${encodeURIComponent(lowerQuery)}`,
        { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(5000) },
      );
      if (nameProofResp.ok) {
        const proof = (await nameProofResp.json()) as { fid?: number; name?: string } | null;
        if (proof?.fid) {
          // Fetch user data from Hubble
          const userResp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${proof.fid}`, {
            headers: { accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });
          if (userResp.ok) {
            const userData = (await userResp.json()) as {
              messages?: Array<{ data: { userDataBody: { type: string; value: string } } }>;
            };
            let username = '';
            let displayName = '';
            let pfp = '';
            let bio = '';
            for (const msg of userData.messages ?? []) {
              const b = msg.data?.userDataBody;
              if (!b) continue;
              if (b.type === 'USER_DATA_TYPE_USERNAME') username = b.value;
              else if (b.type === 'USER_DATA_TYPE_DISPLAY') displayName = b.value;
              else if (b.type === 'USER_DATA_TYPE_PFP') pfp = b.value;
              else if (b.type === 'USER_DATA_TYPE_BIO') bio = b.value;
            }
            results.push({
              protocol: 'farcaster',
              id: String(proof.fid),
              handle: username || lowerQuery,
              displayName: displayName || username || `FID ${proof.fid}`,
              avatar: pfp,
              bio,
              followerCount: 0,
              followingCount: 0,
              verified: true,
            });
          }
        }
      }
    } catch {
      /* non-critical */
    }
  }

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
      /* non-critical */
    }
  }

  if (!protocolFilter || protocolFilter === 'lens') {
    try {
      const lensResp = await fetch('https://api.lens.xyz/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query SearchProfiles($query: String!, $limit: LimitScalar!) { search(request: { query: $query, type: PROFILE, limit: $limit }) { ... on ProfileSearchResult { items { id handle name bio picture { ... on MediaSet { original { url } } } stats { totalFollowers totalFollowing } } } } }`,
          variables: { query: lowerQuery, limit: Math.min(limit, 25) },
        }),
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
      /* non-critical */
    }
  }

  if (!protocolFilter || protocolFilter === 'mastodon') {
    try {
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
          /* try next */
        }
      }
    } catch {
      /* non-critical */
    }
  }
  return results.slice(offset, offset + limit);
}

async function searchLocalIdentities(
  query: string,
  limit: number,
  _offset: number,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];
  try {
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
              break;
            }
          }
        } catch {
          /* skip */
        }
      }
      if (!cursor) break;
    }
  } catch {
    /* non-critical */
  }
  return results;
}

async function getSuggestedProfiles(
  limit: number,
  wallet: string,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];
  try {
    let cursor: string | undefined;
    while (results.length < limit) {
      const list = await env.IDENTITIES?.list({ cursor, limit: 100, prefix: 'identity:' });
      if (!list || list.keys.length === 0) break;
      cursor = (list as unknown as { cursor?: string }).cursor;
      for (const key of list.keys) {
        if (results.length >= limit) break;
        const w = key.name.replace('identity:', '');
        if (wallet && w.toLowerCase() === wallet.toLowerCase()) continue;
        try {
          const raw = await env.IDENTITIES?.get(key.name);
          if (!raw) continue;
          const identity = JSON.parse(raw) as Record<string, unknown>;
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
          /* skip */
        }
      }
      if (!cursor) break;
    }
  } catch {
    /* non-critical */
  }

  // Supplement with curated FIDs if search results insufficient
  if (results.length < limit) {
    try {
      const hubUrl = 'http://127.0.0.1:2281';
      const curatedFids = [3, 2, 1, 228, 239, 354, 5650, 602, 615, 3621];
      for (const fid of curatedFids) {
        if (results.length >= limit) break;
        if (results.some((r) => r.protocol === 'farcaster' && r.id === String(fid))) continue;

        const userResp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (!userResp.ok) continue;

        const userData = (await userResp.json()) as {
          messages?: Array<{ data: { userDataBody: { type: string; value: string } } }>;
        };
        let username = '';
        let displayName = '';
        let pfp = '';
        for (const msg of userData.messages ?? []) {
          const b = msg.data?.userDataBody;
          if (!b) continue;
          if (b.type === 'USER_DATA_TYPE_USERNAME') username = b.value;
          else if (b.type === 'USER_DATA_TYPE_DISPLAY') displayName = b.value;
          else if (b.type === 'USER_DATA_TYPE_PFP') pfp = b.value;
        }

        results.push({
          protocol: 'farcaster',
          id: String(fid),
          handle: username || `fid:${fid}`,
          displayName: displayName || username || `FID ${fid}`,
          avatar: pfp,
          followerCount: 0,
          verified: true,
        });
      }
    } catch {
      /* non-critical */
    }
  }
  return results.slice(0, limit);
}

async function getTrendingProfiles(
  limit: number,
  protocolFilter: string,
  env: Env,
): Promise<ProfileSearchResult[]> {
  const results: ProfileSearchResult[] = [];

  if (!protocolFilter || protocolFilter === 'farcaster') {
    try {
      const hubUrl = 'http://127.0.0.1:2281';
      const curatedFids = [3, 2, 1, 228, 239, 354, 5650, 602, 615, 3621, 7771, 8642, 4120];
      for (const fid of curatedFids) {
        if (results.length >= limit) break;

        const userResp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
          headers: { accept: 'application/json' },
          signal: AbortSignal.timeout(3000),
        });
        if (!userResp.ok) continue;

        const userData = (await userResp.json()) as {
          messages?: Array<{ data: { userDataBody: { type: string; value: string } } }>;
        };
        let username = '';
        let displayName = '';
        let pfp = '';
        for (const msg of userData.messages ?? []) {
          const b = msg.data?.userDataBody;
          if (!b) continue;
          if (b.type === 'USER_DATA_TYPE_USERNAME') username = b.value;
          else if (b.type === 'USER_DATA_TYPE_DISPLAY') displayName = b.value;
          else if (b.type === 'USER_DATA_TYPE_PFP') pfp = b.value;
        }

        results.push({
          protocol: 'farcaster',
          id: String(fid),
          handle: username || `fid:${fid}`,
          displayName: displayName || username || `FID ${fid}`,
          avatar: pfp,
          followerCount: 0,
          verified: true,
        });
      }
    } catch {
      /* non-critical */
    }
  }

  if (!protocolFilter || protocolFilter === 'bluesky') {
    try {
      const api = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
      await fetch(`${api}/xrpc/app.bsky.feed.getSuggestedFeeds?limit=10`, {
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* non-critical */
    }
  }

  if (!protocolFilter || protocolFilter === 'lens') {
    try {
      const lensResp = await fetch('https://api.lens.xyz/graphql', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query TrendingProfiles($limit: LimitScalar!) { exploreProfiles(request: { limit: $limit }) { items { id handle name bio picture { ... on MediaSet { original { url } } } stats { totalFollowers } } } }`,
          variables: { limit: Math.min(limit, 25) },
        }),
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
      /* non-critical */
    }
  }
  return results.slice(0, limit);
}
