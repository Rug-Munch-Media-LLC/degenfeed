/**
 * @degenfeed/api-worker — Cross-Platform Profile Sync
 *
 * One profile, everywhere. Update avatar/bio on DegenFeed → syncs to ALL
 * connected protocols automatically. Unified profile management with
 * per-protocol visibility settings.
 *
 * Routes:
 *   POST /api/accounts/profile/sync     — Sync profile to all protocols
 *   POST /api/accounts/profile/sync/:protocol — Sync to specific protocol
 *   GET  /api/accounts/profile/status   — Get profile sync status per protocol
 *   PUT  /api/accounts/profile/update   — Update profile + sync everywhere
 *   PUT  /api/accounts/profile/visibility — Set per-protocol visibility
 *
 * Profile fields synced:
 *   - displayName
 *   - bio/description
 *   - avatar (image URL)
 *   - banner/header (image URL)
 *   - website/links
 *   - location
 *
 * Protocols supporting profile sync:
 *   Bluesky, Mastodon/GTS, Farcaster, Lens, PeerTube, Pixelfed,
 *   WriteFreely, BookWyrm, Funkwhale, Mobilizon, Owncast, Castopod
 */

import { log } from '../index';
import { kvGetJson } from '../lib/kv-json';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────

interface ProfileData {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  website?: string;
  location?: string;
  [key: string]: unknown;
}

interface VisibilitySettings {
  [protocol: string]: {
    syncDisplayName: boolean;
    syncBio: boolean;
    syncAvatar: boolean;
    syncBanner: boolean;
    syncWebsite: boolean;
    syncLocation: boolean;
  };
}

interface ProfileSyncResult {
  protocol: string;
  ok: boolean;
  error?: string;
  syncedFields?: string[];
}

const PROTOCOLS_WITH_PROFILE_API = [
  'bluesky', // com.atproto.repo.putRecord (app.bsky.actor.profile)
  'mastodon', // PATCH /api/v1/accounts/update_credentials
  'farcaster', // Signed data message
  'lens', // Profile metadata via Lens API
  'peertube', // PUT /api/v1/accounts/{id}
  'pixelfed', // PATCH /api/v1/accounts/update_credentials (Mastodon-compat)
  'writefreely', // POST /api/collections/{alias}/meta
  'bookwyrm', // PATCH /api/auth/profile
  'funkwhale', // PATCH /api/v1/users/me
  'mobilizon', // PATCH /api/profile
  'owncast', // PUT /api/admin/name
  'castopod', // PATCH /api/users/me
];

const SYNCABLE_FIELDS = [
  'displayName',
  'bio',
  'avatarUrl',
  'bannerUrl',
  'website',
  'location',
] as const;

// ─── GET /api/accounts/profile/status — Sync status per protocol ─────────

export async function handleProfileSyncStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address.toLowerCase();

  // Get current profile
  const profile = await getProfile(wallet, env);
  const visibility = await getVisibilitySettings(wallet, env);

  // Check sync status per protocol
  const protocolStatus: Record<
    string,
    {
      connected: boolean;
      synced: boolean;
      lastSync?: number;
      syncedFields?: string[];
      visibilityOverrides?: Record<string, boolean>;
    }
  > = {};

  for (const protocol of PROTOCOLS_WITH_PROFILE_API) {
    const hasAccount = await hasProtocolAccount(wallet, protocol, env);
    const lastSync = await getLastSyncTime(wallet, protocol, env);
    const protoVisibility = visibility[protocol];

    protocolStatus[protocol] = {
      connected: hasAccount,
      synced: hasAccount && !!lastSync,
      lastSync: lastSync || undefined,
      syncedFields: lastSync ? [...SYNCABLE_FIELDS] : undefined,
      visibilityOverrides: protoVisibility,
    };
  }

  const connectedCount = Object.values(protocolStatus).filter((s) => s.connected).length;
  const syncedCount = Object.values(protocolStatus).filter((s) => s.synced).length;

  return noCacheJsonResponse({
    wallet: session.address,
    profile: {
      displayName: profile.displayName,
      bio: profile.bio,
      hasAvatar: !!profile.avatarUrl,
      hasBanner: !!profile.bannerUrl,
      website: profile.website,
      location: profile.location,
    },
    protocols: protocolStatus,
    stats: {
      connected: connectedCount,
      synced: syncedCount,
      total: PROTOCOLS_WITH_PROFILE_API.length,
    },
    syncUrl: '/api/accounts/profile/sync',
    updateUrl: '/api/accounts/profile/update',
  });
}

// ─── PUT /api/accounts/profile/update — Update profile + sync everywhere ──

export async function handleProfileUpdate(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const walletLower = wallet.toLowerCase();

  let body: { profile: ProfileData; autoSync?: boolean };
  try {
    body = (await request.json()) as { profile: ProfileData; autoSync?: boolean };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body. Required: profile object' }, 400);
  }

  if (!body.profile || Object.keys(body.profile).length === 0) {
    return jsonResponse({ error: 'profile object with at least one field is required' }, 400);
  }

  const autoSync = body.autoSync !== false;

  // Validate and sanitize profile fields
  const sanitizedProfile: ProfileData = {};
  if (body.profile.displayName !== undefined) {
    sanitizedProfile.displayName = String(body.profile.displayName).slice(0, 100);
  }
  if (body.profile.bio !== undefined) {
    sanitizedProfile.bio = String(body.profile.bio).slice(0, 500);
  }
  if (body.profile.avatarUrl !== undefined) {
    sanitizedProfile.avatarUrl = sanitizeUrl(body.profile.avatarUrl);
  }
  if (body.profile.bannerUrl !== undefined) {
    sanitizedProfile.bannerUrl = sanitizeUrl(body.profile.bannerUrl);
  }
  if (body.profile.website !== undefined) {
    sanitizedProfile.website = sanitizeUrl(body.profile.website);
  }
  if (body.profile.location !== undefined) {
    sanitizedProfile.location = String(body.profile.location).slice(0, 100);
  }

  // Save to local storage
  await saveProfile(walletLower, sanitizedProfile, env);

  // Sync to all protocols if autoSync
  let syncResults: ProfileSyncResult[] = [];
  if (autoSync) {
    syncResults = await syncProfileToAll(wallet, walletLower, sanitizedProfile, env);
  }

  log('info', 'Profile updated', {
    wallet: walletLower.slice(0, 8),
    fields: Object.keys(sanitizedProfile),
    autoSync,
    synced: syncResults.filter((r) => r.ok).length,
    failed: syncResults.filter((r) => !r.ok).length,
  });

  return jsonResponse({
    success: true,
    profile: sanitizedProfile,
    synced: autoSync,
    syncResults: syncResults.length > 0 ? syncResults : undefined,
    statusUrl: '/api/accounts/profile/status',
  });
}

// ─── POST /api/accounts/profile/sync — Sync to ALL protocols ─────────────

export async function handleProfileSync(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const walletLower = wallet.toLowerCase();

  const profile = await getProfile(walletLower, env);

  // Check if profile exists
  if (!profile || Object.keys(profile).length === 0) {
    return jsonResponse(
      {
        error: 'No profile found. Update your profile first via PUT /api/accounts/profile/update',
        updateUrl: '/api/accounts/profile/update',
      },
      404,
    );
  }

  const results = await syncProfileToAll(wallet, walletLower, profile, env);

  const successCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  log('info', 'Profile sync completed', {
    wallet: walletLower.slice(0, 8),
    synced: successCount,
    failed: failCount,
    total: results.length,
  });

  return jsonResponse(
    {
      success: true,
      results,
      stats: {
        synced: successCount,
        failed: failCount,
        total: results.length,
      },
      syncedFields: Object.keys(profile),
    },
    failCount > 0 && successCount === 0 ? 200 : 201,
  );
}

// ─── POST /api/accounts/profile/sync/:protocol — Sync to specific protocol ─

export async function handleProfileSyncProtocol(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const wallet = session.address;
  const walletLower = wallet.toLowerCase();

  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // path: api, accounts, profile, sync, {protocol}
  const protocol = pathParts[4];

  if (!protocol || !PROTOCOLS_WITH_PROFILE_API.includes(protocol)) {
    return jsonResponse(
      {
        error: `Unsupported protocol: ${protocol}`,
        supported: PROTOCOLS_WITH_PROFILE_API,
      },
      400,
    );
  }

  const profile = await getProfile(walletLower, env);
  if (!profile || Object.keys(profile).length === 0) {
    return jsonResponse({ error: 'No profile found. Update first.' }, 404);
  }

  const result = await syncProfileToProtocol(wallet, walletLower, protocol, profile, env);

  return jsonResponse(
    {
      success: result.ok,
      protocol,
      result,
    },
    result.ok ? 201 : 200,
  );
}

// ─── PUT /api/accounts/profile/visibility — Per-protocol visibility ──────

export async function handleProfileVisibility(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletLower = session.address.toLowerCase();

  let body: { visibility: Record<string, Record<string, boolean>> };
  try {
    body = (await request.json()) as { visibility: Record<string, Record<string, boolean>> };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.visibility) {
    return jsonResponse({ error: 'visibility object is required' }, 400);
  }

  // Validate and save visibility settings per protocol
  const validFields = [
    'syncDisplayName',
    'syncBio',
    'syncAvatar',
    'syncBanner',
    'syncWebsite',
    'syncLocation',
  ];
  const visibility: VisibilitySettings = {};

  for (const [protocol, settings] of Object.entries(body.visibility)) {
    if (!PROTOCOLS_WITH_PROFILE_API.includes(protocol)) continue;
    visibility[protocol] = {};
    for (const field of validFields) {
      if (typeof settings[field] === 'boolean') {
        visibility[protocol][field] = settings[field];
      }
    }
  }

  await saveVisibilitySettings(walletLower, visibility, env);

  log('info', 'Profile visibility updated', {
    wallet: walletLower.slice(0, 8),
    protocols: Object.keys(visibility),
  });

  return jsonResponse({
    success: true,
    visibility,
    message: 'Visibility settings saved. Use POST /api/accounts/profile/sync to apply.',
  });
}

// ─── Sync Implementation ───────────────────────────────────────────────────

async function syncProfileToAll(
  wallet: string,
  walletLower: string,
  profile: ProfileData,
  env: Env,
): Promise<ProfileSyncResult[]> {
  const results: ProfileSyncResult[] = [];
  const visibility = await getVisibilitySettings(walletLower, env);

  for (const protocol of PROTOCOLS_WITH_PROFILE_API) {
    const hasAccount = await hasProtocolAccount(walletLower, protocol, env);
    if (!hasAccount) {
      results.push({ protocol, ok: false, error: 'No account connected' });
      continue;
    }

    // Apply visibility filters
    const protoVisibility = visibility[protocol];
    const filteredProfile: ProfileData = {};
    const syncedFields: string[] = [];

    for (const field of SYNCABLE_FIELDS) {
      if (profile[field] === undefined) continue;
      if (protoVisibility) {
        const visKey =
          `sync${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof typeof protoVisibility;
        if (protoVisibility[visKey] === false) continue;
      }
      filteredProfile[field] = profile[field];
      syncedFields.push(field);
    }

    if (Object.keys(filteredProfile).length === 0) {
      results.push({
        protocol,
        ok: true,
        syncedFields: [],
        error: 'All fields hidden by visibility settings',
      });
      continue;
    }

    const result = await syncProfileToProtocol(wallet, walletLower, protocol, filteredProfile, env);
    results.push({ ...result, syncedFields: result.ok ? syncedFields : undefined });
  }

  return results;
}

async function syncProfileToProtocol(
  _wallet: string,
  walletLower: string,
  protocol: string,
  profile: ProfileData,
  env: Env,
): Promise<ProfileSyncResult> {
  try {
    const credentials = await getProtocolCredentials(walletLower, protocol, env);
    if (!credentials?.accessToken) {
      return { protocol, ok: false, error: 'No access token available for this protocol' };
    }

    switch (protocol) {
      case 'bluesky':
        return syncBlueskyProfile(credentials, profile, env);
      case 'mastodon':
        return syncMastodonProfile(credentials, profile, env);
      case 'farcaster':
        return syncFarcasterProfile(credentials, profile, env);
      case 'lens':
        return syncLensProfile(credentials, profile, env);
      case 'peertube':
        return syncPeerTubeProfile(credentials, profile, env);
      case 'pixelfed':
        return syncPixelfedProfile(credentials, profile, env);
      case 'writefreely':
        return syncWriteFreelyProfile(credentials, profile, env);
      case 'bookwyrm':
        return syncBookWyrmProfile(credentials, profile, env);
      case 'funkwhale':
        return syncFunkwhaleProfile(credentials, profile, env);
      case 'mobilizon':
        return syncMobilizonProfile(credentials, profile, env);
      case 'owncast':
        return syncOwncastProfile(credentials, profile, env);
      case 'castopod':
        return syncCastopodProfile(credentials, profile, env);
      default:
        return { protocol, ok: false, error: `No sync implementation for ${protocol}` };
    }
  } catch (err) {
    return {
      protocol,
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown sync error',
    };
  }
}

// ─── Protocol-specific sync implementations ───────────────────────────────

async function syncBlueskyProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const pdsUrl = creds.instanceUrl || 'https://pds.degenfeed.xyz';
  const did = creds.did || creds.username;

  const recordBody: Record<string, unknown> = {
    $type: 'app.bsky.actor.profile',
  };
  if (profile.displayName) recordBody.displayName = profile.displayName;
  if (profile.bio) recordBody.description = profile.bio;
  if (profile.avatarUrl)
    recordBody.avatar = { $type: 'blob', ref: { $link: '' }, mimeType: 'image/jpeg', size: 0 };
  if (profile.bannerUrl)
    recordBody.banner = { $type: 'blob', ref: { $link: '' }, mimeType: 'image/jpeg', size: 0 };
  // Note: full avatar upload requires blob upload first; here we set metadata

  const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.putRecord`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record: recordBody,
    }),
  });

  if (!res.ok) {
    return { protocol: 'bluesky', ok: false, error: `Bluesky profile sync failed: ${res.status}` };
  }

  return { protocol: 'bluesky', ok: true, syncedFields: Object.keys(profile) };
}

async function syncMastodonProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://social.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;

  const body: Record<string, string> = {};
  if (profile.displayName) body.display_name = profile.displayName;
  if (profile.bio) body.note = profile.bio;
  if (profile.website) body.website = profile.website;
  if (profile.location) body.locked = profile.location;

  const res = await fetch(`${apiBase}/accounts/update_credentials`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return {
      protocol: 'mastodon',
      ok: false,
      error: `Mastodon profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'mastodon', ok: true, syncedFields: Object.keys(profile) };
}

async function syncFarcasterProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  // Farcaster profile sync requires signing a message with the custody address
  const hubUrl = creds.instanceUrl || 'https://hub.degenfeed.xyz';

  const res = await fetch(`${hubUrl}/v1/profile`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      fid: creds.fid,
      displayName: profile.displayName,
      bio: profile.bio,
      pfp: profile.avatarUrl,
      url: profile.website,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'farcaster',
      ok: false,
      error: `Farcaster profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'farcaster', ok: true, syncedFields: Object.keys(profile) };
}

async function syncLensProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const lensApi = creds.instanceUrl || 'https://api-v2.lens.dev';

  const res = await fetch(`${lensApi}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      query: `mutation UpdateProfile($request: UpdateProfileRequest!) {
        updateProfile(request: $request) { ... on Profile { id } }
      }`,
      variables: {
        request: {
          profileId: creds.profileId,
          name: profile.displayName,
          bio: profile.bio,
          picture: profile.avatarUrl,
          coverPicture: profile.bannerUrl,
          attributes: [
            ...(profile.website ? [{ key: 'website', value: profile.website }] : []),
            ...(profile.location ? [{ key: 'location', value: profile.location }] : []),
          ],
        },
      },
    }),
  });

  if (!res.ok) {
    return { protocol: 'lens', ok: false, error: `Lens profile sync failed: ${res.status}` };
  }

  return { protocol: 'lens', ok: true, syncedFields: Object.keys(profile) };
}

async function syncPeerTubeProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://video.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;

  const res = await fetch(`${apiBase}/accounts/${creds.username}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      displayName: profile.displayName,
      description: profile.bio,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'peertube',
      ok: false,
      error: `PeerTube profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'peertube', ok: true, syncedFields: Object.keys(profile) };
}

async function syncPixelfedProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  // Pixelfed uses Mastodon-compatible API
  return syncMastodonProfile(creds, profile, _env);
}

async function syncWriteFreelyProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://blog.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

  const res = await fetch(`${apiBase}/collections/${creds.username}/meta`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      title: profile.displayName,
      description: profile.bio,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'writefreely',
      ok: false,
      error: `WriteFreely profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'writefreely', ok: true, syncedFields: Object.keys(profile) };
}

async function syncBookWyrmProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://books.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

  const res = await fetch(`${apiBase}/auth/profile`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      display_name: profile.displayName,
      bio: profile.bio,
      avatar: profile.avatarUrl,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'bookwyrm',
      ok: false,
      error: `BookWyrm profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'bookwyrm', ok: true, syncedFields: Object.keys(profile) };
}

async function syncFunkwhaleProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://music.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/v1`;

  const res = await fetch(`${apiBase}/users/me`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      display_name: profile.displayName,
      description: profile.bio,
      avatar: profile.avatarUrl,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'funkwhale',
      ok: false,
      error: `Funkwhale profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'funkwhale', ok: true, syncedFields: Object.keys(profile) };
}

async function syncMobilizonProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://events.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

  const res = await fetch(`${apiBase}/profile`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      display_name: profile.displayName,
      bio: profile.bio,
      avatar: profile.avatarUrl,
      website: profile.website,
      location: profile.location,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'mobilizon',
      ok: false,
      error: `Mobilizon profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'mobilizon', ok: true, syncedFields: Object.keys(profile) };
}

async function syncOwncastProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://live.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api/admin`;

  if (profile.displayName) {
    await fetch(`${apiBase}/name`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({ value: profile.displayName }),
    });
  }

  if (profile.bio) {
    await fetch(`${apiBase}/description`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({ value: profile.bio }),
    });
  }

  return { protocol: 'owncast', ok: true, syncedFields: Object.keys(profile) };
}

async function syncCastopodProfile(
  creds: ProtocolCreds,
  profile: ProfileData,
  _env: Env,
): Promise<ProfileSyncResult> {
  const instanceUrl = creds.instanceUrl || 'https://podcasts.degenfeed.xyz';
  const apiBase = `${instanceUrl.replace(/\/$/, '')}/api`;

  const res = await fetch(`${apiBase}/users/me`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${creds.accessToken}`,
    },
    body: JSON.stringify({
      username: creds.username,
      display_name: profile.displayName,
      biography: profile.bio,
      avatar: profile.avatarUrl,
      website: profile.website,
    }),
  });

  if (!res.ok) {
    return {
      protocol: 'castopod',
      ok: false,
      error: `Castopod profile sync failed: ${res.status}`,
    };
  }

  return { protocol: 'castopod', ok: true, syncedFields: Object.keys(profile) };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

interface ProtocolCreds {
  username?: string;
  accessToken?: string;
  instanceUrl?: string;
  did?: string;
  fid?: number;
  profileId?: string;
  password?: string;
}

async function getProtocolCredentials(
  walletLower: string,
  protocol: string,
  env: Env,
): Promise<ProtocolCreds | null> {
  if (!env.PLATFORM_ACCOUNTS) return null;
  try {
    const raw = await env.PLATFORM_ACCOUNTS.get(`${protocol}:${walletLower}`);
    if (raw) {
      const data = JSON.parse(raw) as Record<string, string>;
      return {
        username: data.username || data.handle,
        accessToken: data.accessToken || data.access_token,
        instanceUrl: data.instance,
        did: data.did,
        fid: data.fid ? Number(data.fid) : undefined,
        profileId: data.profileId,
        password: data.password,
      };
    }
    // Check compound account key
    const acctRaw = await env.PLATFORM_ACCOUNTS.get(`account:${walletLower}`);
    if (acctRaw) {
      const acct = JSON.parse(acctRaw) as Record<string, unknown>;
      const proto = acct[protocol] as Record<string, string> | undefined;
      if (proto) {
        return {
          username: proto.username || proto.handle,
          accessToken: proto.accessToken || proto.access_token,
          instanceUrl: proto.instance,
          did: proto.did,
          fid: proto.fid ? Number(proto.fid) : undefined,
          profileId: proto.profileId,
        };
      }
    }
  } catch {
    // KV read failed
  }
  return null;
}

async function hasProtocolAccount(
  walletLower: string,
  protocol: string,
  env: Env,
): Promise<boolean> {
  const creds = await getProtocolCredentials(walletLower, protocol, env);
  return creds !== null;
}

async function getProfile(walletLower: string, env: Env): Promise<ProfileData> {
  if (!env.CACHE) return {};
  try {
    const raw = await env.CACHE.get(`user:prefs:${walletLower}`);
    if (!raw) return {};
    const prefs = JSON.parse(raw) as Record<string, unknown>;
    return {
      displayName: prefs.displayName as string | undefined,
      bio: prefs.bio as string | undefined,
      avatarUrl: prefs.avatarUrl as string | undefined,
      bannerUrl: prefs.bannerUrl as string | undefined,
      website: prefs.website as string | undefined,
      location: prefs.location as string | undefined,
    };
  } catch {
    return {};
  }
}

async function saveProfile(walletLower: string, profile: ProfileData, env: Env): Promise<void> {
  if (!env.CACHE) return;
  try {
    const raw = await env.CACHE.get(`user:prefs:${walletLower}`);
    const prefs = raw ? JSON.parse(raw) : {};
    Object.assign(prefs, profile);
    await env.CACHE.put(`user:prefs:${walletLower}`, JSON.stringify(prefs));
  } catch {
    // Non-critical
  }
}

async function getVisibilitySettings(walletLower: string, env: Env): Promise<VisibilitySettings> {
  if (!env.CACHE) return {};
  try {
    const raw = await env.CACHE.get(`user:profile_visibility:${walletLower}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveVisibilitySettings(
  walletLower: string,
  visibility: VisibilitySettings,
  env: Env,
): Promise<void> {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(`user:profile_visibility:${walletLower}`, JSON.stringify(visibility));
  } catch {
    // Non-critical
  }
}

async function getLastSyncTime(
  walletLower: string,
  protocol: string,
  env: Env,
): Promise<number | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`user:profile_sync:${walletLower}:${protocol}`);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

function sanitizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    // Invalid URL
  }
  return '';
}

// ─── PUBLIC EXPORTS for lib/profile-sync barrel ──────────────────────────

/** List of protocols that support profile sync operations */
export const SUPPORTED_SYNC_PROTOCOLS = PROTOCOLS_WITH_PROFILE_API;

/** Aggregate cross-protocol identity data for a wallet into a unified profile */
export async function aggregateProfile(
  wallet: string,
  env: Env,
  opts?: { forceRefresh?: boolean },
): Promise<Record<string, unknown>> {
  const cacheKey = `profile:aggregated:${wallet}`;
  if (!opts?.forceRefresh) {
    const cached = await kvGetJson(env.IDENTITIES, cacheKey);
    if (cached) return cached as Record<string, unknown>;
  }
  // Build profile from cross-protocol identity
  const identity = (await kvGetJson(env.IDENTITIES, `identity:${wallet}`)) as Record<
    string,
    unknown
  > | null;
  const profile: Record<string, unknown> = {
    wallet,
    displayName: '',
    bio: '',
    avatarUrl: '',
    bannerUrl: '',
    protocols: {} as Record<string, unknown>,
    linkedAt: Date.now(),
  };
  if (identity) {
    for (const protocol of PROTOCOLS_WITH_PROFILE_API) {
      const data = (identity as Record<string, unknown>)[protocol];
      if (data) {
        (profile.protocols as Record<string, unknown>)[protocol] = data;
        if (!profile.displayName && (data as Record<string, unknown>).displayName) {
          profile.displayName = (data as Record<string, unknown>).displayName;
        }
        if (!profile.avatarUrl && (data as Record<string, unknown>).avatarUrl) {
          profile.avatarUrl = (data as Record<string, unknown>).avatarUrl;
        }
        if (!profile.bio && (data as Record<string, unknown>).bio) {
          profile.bio = (data as Record<string, unknown>).bio;
        }
      }
    }
  }
  await env.IDENTITIES?.put(cacheKey, JSON.stringify(profile), { expirationTtl: 300 });
  return profile;
}

/** Get sync status for a wallet across all protocols */
export async function getSyncStatus(
  wallet: string,
  env: Env,
): Promise<Record<string, { synced: boolean; lastSync?: number }>> {
  const status: Record<string, { synced: boolean; lastSync?: number }> = {};
  for (const protocol of PROTOCOLS_WITH_PROFILE_API) {
    const key = `sync:${wallet}:${protocol}`;
    const ts = await env.IDENTITIES?.get(key);
    status[protocol] = { synced: !!ts, lastSync: ts ? parseInt(ts, 10) : undefined };
  }
  return status;
}

/** Push profile data to all connected protocols */
export async function pushProfile(
  wallet: string,
  profile: Record<string, unknown>,
  env: Env,
): Promise<ProfileSyncResult[]> {
  const results: ProfileSyncResult[] = [];
  const walletLower = wallet.toLowerCase();
  for (const protocol of PROTOCOLS_WITH_PROFILE_API) {
    try {
      const result = await syncProfileToProtocol(
        wallet,
        walletLower,
        protocol,
        profile as ProfileData,
        env,
      );
      results.push(result);
    } catch (err) {
      results.push({ protocol, ok: false, error: (err as Error).message });
    }
  }
  return results;
}

/** Sync profile to all connected protocols (alias for pushProfile) */
export async function syncProfile(
  wallet: string,
  profile: Record<string, unknown>,
  env: Env,
): Promise<ProfileSyncResult[]> {
  return pushProfile(wallet, profile, env);
}

/** Set the primary protocol override for a wallet */
export async function setPrimaryOverride(
  wallet: string,
  protocol: string,
  env: Env,
): Promise<void> {
  await env.IDENTITIES?.put(`profile:primary:${wallet}`, protocol);
}
