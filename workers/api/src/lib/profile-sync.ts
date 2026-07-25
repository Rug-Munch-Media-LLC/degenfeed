/**
 * @degenfeed/api-worker — Profile Sync Engine
 *
 * Two-way sync for unified identities across ALL connected protocols.
 * Pulls profile data from protocols; pushes local updates back.
 * Tracks sync status per protocol. Resolves conflicts.
 *
 * KV key scheme:
 *   profile:sync:{wallet}:{protocol}   → ProtocolSyncState
 *   profile:aggregate:{wallet}          → AggregatedProfile (cached, 5m TTL)
 *   profile:badges:{wallet}             → VerificationBadge[]
 *   profile:primary:{wallet}            → PrimaryFieldOverride (which protocol's data is canonical)
 *   profile:sync:lock:{wallet}          → Sync lock (prevents concurrent sync)
 *   profile:sync:queue:{wallet}         → Pending sync actions
 */

import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import type { Env } from '../index';

// ─── Types ─────────────────────────────────────────────────────────────

export interface ProtocolProfile {
  /** Protocol display name */
  displayName?: string;
  /** Avatar URL */
  avatar?: string;
  /** Bio/description */
  bio?: string;
  /** Website URL */
  website?: string;
  /** Banner/header image URL */
  banner?: string;
  /** Lightning address (Nostr-specific) */
  lightningAddress?: string;
  /** NIP-05 identifier (Nostr-specific) */
  nip05?: string;
  /** Raw protocol data for extensibility */
  raw?: Record<string, unknown>;
}

export interface AggregatedProfile {
  /** Wallet address */
  wallet: string;
  /** Merged display name (from primary protocol or user choice) */
  displayName: string;
  /** Merged avatar URL (from primary protocol or user choice) */
  avatar: string;
  /** Merged bio */
  bio: string;
  /** Merged website */
  website: string;
  /** Merged banner */
  banner?: string;
  /** Lightning address */
  lightningAddress?: string;
  /** NIP-05 */
  nip05?: string;
  /** Per-protocol profile data */
  protocols: Record<string, ProtocolProfile>;
  /** Which protocol is primary for each field */
  primaryOverrides: PrimaryFieldOverride;
  /** Verification badges */
  badges: VerificationBadge[];
  /** Sync status per protocol */
  syncStatus: Record<string, SyncStatus>;
  /** Identity verification level */
  verificationLevel: VerificationLevel;
  /** When the profile was last updated */
  updatedAt: number;
  /** When the profile was aggregated (cache timestamp) */
  aggregatedAt: number;
}

export interface PrimaryFieldOverride {
  displayName?: string; // protocol name
  avatar?: string;
  bio?: string;
  website?: string;
  banner?: string;
}

export type SyncStatus = 'in_sync' | 'needs_update' | 'syncing' | 'error' | 'unsupported';

export interface ProtocolSyncState {
  wallet: string;
  protocol: string;
  lastSyncAt: number;
  lastSyncStatus: SyncStatus;
  lastError?: string;
  retryCount: number;
  profileHash: string; // SHA-256 of the last synced profile for change detection
  syncedFields: string[]; // which fields were last synced
}

export type VerificationLevel =
  | 'none'
  | 'self_verified'
  | 'wallet_verified'
  | 'cross_verified'
  | 'attested';

export interface VerificationBadge {
  type: 'self_verified' | 'wallet_verified' | 'cross_verified' | 'attested';
  label: string;
  description: string;
  earnedAt: number;
  protocols: string[];
  metadata?: Record<string, unknown>;
}

// ─── Profile field support matrix ──────────────────────────────────────

export const PROTOCOL_FIELD_SUPPORT: Record<string, Record<string, boolean>> = {
  nostr: {
    displayName: true,
    avatar: true,
    bio: true,
    website: true,
    banner: true,
    lightningAddress: true,
    nip05: true,
  },
  farcaster: {
    displayName: true,
    avatar: true,
    bio: true,
    website: true,
    banner: false,
    lightningAddress: false,
    nip05: false,
  },
  bluesky: {
    displayName: true,
    avatar: true,
    bio: true,
    website: true,
    banner: true,
    lightningAddress: false,
    nip05: false,
  },
  lens: {
    displayName: true,
    avatar: true,
    bio: true,
    website: true,
    banner: true,
    lightningAddress: false,
    nip05: false,
  },
  mastodon: {
    displayName: true,
    avatar: true,
    bio: true,
    website: true,
    banner: true,
    lightningAddress: false,
    nip05: false,
  },
};

export const SUPPORTED_SYNC_PROTOCOLS = ['nostr', 'farcaster', 'bluesky', 'lens', 'mastodon'];

// ─── Profile Fetching by Protocol ──────────────────────────────────────

/**
 * Fetch a user's profile from Nostr relays (kind 0 metadata event).
 */
async function fetchNostrProfile(
  identity: Record<string, unknown>,
  _env: Env,
): Promise<ProtocolProfile> {
  const npub = (identity.npub as string) || '';
  const pubkey = (identity.pubkey as string) || '';
  if (!npub && !pubkey) return {};

  try {
    const { npubDecode, RelayPool } = await import('@degenfeed/nostr-sdk');
    const hex = npub.startsWith('npub1') ? npubDecode(npub) : pubkey || '';
    if (!hex) return {};

    const relays = (identity.relays as string[]) || [
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
    ];

    const pool = new RelayPool(relays, { eoseTimeout: 4000 });
    const events = await pool.list({ kinds: [0], authors: [hex], limit: 1 }, 4000);
    pool.disconnectAll();

    if (events.length === 0) return {};

    let content: Record<string, string>;
    try {
      content = JSON.parse(events[0]?.content ?? '{}') as Record<string, string>;
    } catch {
      return {};
    }

    return {
      displayName: content.display_name || content.name || '',
      avatar: content.picture || '',
      bio: content.about || '',
      website: content.website || '',
      banner: content.banner || '',
      lightningAddress: content.lud16 || content.lud06 || '',
      nip05: content.nip05 || '',
      raw: events[0] as unknown as Record<string, unknown>,
    };
  } catch {
    return {};
  }
}

/**
 * Fetch a user's profile from Farcaster hubs.
 */
async function fetchFarcasterProfile(
  identity: Record<string, unknown>,
  env: Env,
): Promise<ProtocolProfile> {
  const fid = (identity.fid as number) || 0;
  if (!fid) return {};

  try {
    const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.pinata.cloud';
    const resp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
      headers: { 'user-agent': 'DegenFeed/0.1' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return {};

    const data = (await resp.json()) as {
      messages?: Array<{
        data?: { userDataBody?: { type?: string; value?: string } };
      }>;
    };

    const profile: Record<string, string> = {};
    for (const msg of data.messages ?? []) {
      const body = msg.data?.userDataBody;
      if (!body?.type || !body.value) continue;
      switch (body.type) {
        case 'USER_DATA_TYPE_USERNAME':
          profile.username = body.value;
          break;
        case 'USER_DATA_TYPE_DISPLAY':
          profile.displayName = body.value;
          break;
        case 'USER_DATA_TYPE_PFP':
          profile.pfp = body.value;
          break;
        case 'USER_DATA_TYPE_BIO':
          profile.bio = body.value;
          break;
        case 'USER_DATA_TYPE_URL':
          profile.url = body.value;
          break;
      }
    }

    return {
      displayName: profile.displayName || profile.username || '',
      avatar: profile.pfp || '',
      bio: profile.bio || '',
      website: profile.url || '',
      raw: data as unknown as Record<string, unknown>,
    };
  } catch {
    return {};
  }
}

/**
 * Fetch a user's profile from Bluesky (AT Protocol).
 */
async function fetchBlueskyProfile(
  identity: Record<string, unknown>,
  env: Env,
): Promise<ProtocolProfile> {
  const did = (identity.did as string) || '';
  const handle = (identity.handle as string) || '';
  const identifier = did || handle;
  if (!identifier) return {};

  try {
    const api = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
    const resp = await fetch(
      `${api}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(identifier)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!resp.ok) return {};

    const data = (await resp.json()) as {
      displayName?: string;
      avatar?: string;
      description?: string;
      banner?: string;
      website?: string;
    };

    return {
      displayName: data.displayName || '',
      avatar: data.avatar || '',
      bio: data.description || '',
      banner: data.banner || '',
      // Bluesky website is embedded in the DID doc / profile metadata
      // Not always available via simple getProfile
    };
  } catch {
    return {};
  }
}

/**
 * Fetch a user's profile from Lens Protocol.
 */
async function fetchLensProfile(
  identity: Record<string, unknown>,
  _env: Env,
): Promise<ProtocolProfile> {
  const profileId = (identity.profileId as string) || '';
  const handle = (identity.handle as string) || '';
  if (!profileId && !handle) return {};

  try {
    const lensApi = 'https://api.lens.xyz/graphql';
    const query = {
      query: `
        query Profile($request: ProfileRequest!) {
          profile(request: $request) {
            id
            handle
            name
            bio
            picture {
              ... on MediaSet {
                original { url }
              }
            }
            coverPicture {
              ... on MediaSet {
                original { url }
              }
            }
            metadata {
              attributes {
                value
              }
            }
          }
        }
      `,
      variables: {
        request: handle ? { handle } : { profileId },
      },
    };

    const resp = await fetch(lensApi, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(query),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return {};

    const data = (await resp.json()) as {
      data?: {
        profile?: {
          name?: string;
          bio?: string;
          picture?: { original?: { url?: string } };
          coverPicture?: { original?: { url?: string } };
        };
      };
    };

    const profile = data?.data?.profile;
    if (!profile) return {};

    return {
      displayName: profile.name || handle || '',
      avatar: profile.picture?.original?.url || '',
      bio: profile.bio || '',
      banner: profile.coverPicture?.original?.url || '',
    };
  } catch {
    return {};
  }
}

/**
 * Fetch a user's profile from Mastodon / ActivityPub.
 */
async function fetchMastodonProfile(
  identity: Record<string, unknown>,
  _env: Env,
): Promise<ProtocolProfile> {
  const handle = (identity.handle as string) || '';
  const instance = (identity.instance as string) || 'mastodon.social';
  if (!handle) return {};

  try {
    // Resolve the account via WebFinger (standard Mastodon lookup)
    const webfingerUrl = `https://${instance}/.well-known/webfinger?resource=acct:${encodeURIComponent(handle)}@${instance}`;
    const wfResp = await fetch(webfingerUrl, { signal: AbortSignal.timeout(5000) });
    if (!wfResp.ok) return {};

    const wfData = (await wfResp.json()) as {
      links?: Array<{ rel?: string; href?: string; type?: string }>;
    };

    // Find the Profile URL from WebFinger links
    const selfLink = wfData.links?.find(
      (l) => l.rel === 'self' && l.type === 'application/activity+json',
    );
    if (!selfLink?.href) return {};

    // Fetch the ActivityPub actor document
    const actorResp = await fetch(selfLink.href, {
      headers: { accept: 'application/activity+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!actorResp.ok) return {};

    const actor = (await actorResp.json()) as {
      name?: string;
      icon?: { url?: string };
      summary?: string;
      url?: string;
      image?: { url?: string };
      attachment?: Array<{ type?: string; name?: string; value?: string }>;
    };

    // Extract website from attachments if present
    let website = '';
    if (actor.attachment) {
      const linkField = actor.attachment.find(
        (a) =>
          a.type === 'PropertyValue' &&
          (a.name?.toLowerCase().includes('website') || a.name?.toLowerCase().includes('link')),
      );
      if (linkField?.value) {
        const match = linkField.value.match(/href="([^"]+)"/);
        if (match?.[1]) website = match[1];
      }
    }

    return {
      displayName: actor.name || handle,
      avatar: actor.icon?.url || '',
      bio: actor.summary ? stripHtml(actor.summary) : '',
      website: website || actor.url || '',
      banner: actor.image?.url || '',
    };
  } catch {
    return {};
  }
}

// ─── Profile Fetching Dispatcher ───────────────────────────────────────

const PROFILE_FETCHERS: Record<
  string,
  (identity: Record<string, unknown>, env: Env) => Promise<ProtocolProfile>
> = {
  nostr: fetchNostrProfile,
  farcaster: fetchFarcasterProfile,
  bluesky: fetchBlueskyProfile,
  lens: fetchLensProfile,
  mastodon: fetchMastodonProfile,
};

// ─── Profile Pushing by Protocol ───────────────────────────────────────

/**
 * Push a profile update to a Nostr relay (kind 0 metadata event).
 * Requires the user's Nostr private key (nsec).
 */
async function pushToNostr(
  profile: ProtocolProfile,
  identity: Record<string, unknown>,
  env: Env,
): Promise<boolean> {
  const nsec = (identity.nsec as string) || env.NOSTR_PRIVATE_KEY || '';
  if (!nsec) return false;

  try {
    const relays = (identity.relays as string[]) || ['wss://relay.damus.io', 'wss://nos.lol'];

    const metadata: Record<string, string | undefined> = {
      name: profile.displayName,
      display_name: profile.displayName,
      about: profile.bio,
      picture: profile.avatar,
      website: profile.website,
      banner: profile.banner,
      lud16: profile.lightningAddress,
      nip05: profile.nip05,
    };

    // Clean undefined values
    const cleaned: Record<string, string> = {};
    for (const [key, val] of Object.entries(metadata)) {
      if (val) cleaned[key] = val;
    }

    // Try nostr-sdk if available, otherwise use HTTP fallback
    try {
      const nostrSdk = await import('@degenfeed/nostr-sdk');
      const publish =
        (nostrSdk as unknown as Record<string, unknown>).publishKind0 ??
        (nostrSdk as unknown as Record<string, unknown>).publishMetadata ??
        (nostrSdk as unknown as Record<string, unknown>).publishEvent;

      if (typeof publish === 'function') {
        await publish(nsec, cleaned, relays);
        return true;
      }
    } catch {
      // SDK import failed — fall through to HTTP fallback
    }

    // HTTP relay fallback: POST kind 0 event directly to relays
    const event = {
      kind: 0,
      content: JSON.stringify(cleaned),
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    const results = await Promise.allSettled(
      relays.map((url) =>
        fetch(url.replace('wss://', 'https://'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(['EVENT', event]),
          signal: AbortSignal.timeout(5000),
        }),
      ),
    );
    return results.some((r) => r.status === 'fulfilled' && (r.value as Response).ok);
  } catch {
    return false;
  }
}

/**
 * Push a profile update to Farcaster.
 * Farcaster requires different approaches:
 *   1. Via Neynar API (if NEYNAR_API_KEY configured)
 *   2. Via Hub API (direct hub submission)
 */
async function pushToFarcaster(
  profile: ProtocolProfile,
  identity: Record<string, unknown>,
  env: Env,
): Promise<boolean> {
  const fid = (identity.fid as number) || 0;
  const signerKey = (identity.signerKey as string) || env.FARCASTER_SIGNER_KEY || '';
  if (!fid || !signerKey) return false;
  if (!env.NEYNAR_API_KEY) return false;

  try {
    // Use Neynar API to update user data
    const updatePayload: Record<string, string | undefined> = {
      pfp_url: profile.avatar,
      display_name: profile.displayName,
      bio: profile.bio,
      url: profile.website,
    };

    const cleaned: Record<string, string> = {};
    for (const [key, val] of Object.entries(updatePayload)) {
      if (val) cleaned[key] = val;
    }

    const resp = await fetch('https://api.neynar.com/v2/farcaster/user/profile', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        api_key: env.NEYNAR_API_KEY,
      },
      body: JSON.stringify({
        fid,
        signer_uuid: signerKey,
        ...cleaned,
      }),
      signal: AbortSignal.timeout(10000),
    });

    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Push a profile update to Bluesky.
 */
async function pushToBluesky(
  profile: ProtocolProfile,
  identity: Record<string, unknown>,
  env: Env,
): Promise<boolean> {
  const did = (identity.did as string) || '';
  const accessToken = (identity.accessToken as string) || env.BSKY_ACCESS_TOKEN || '';
  if (!did || !accessToken) return false;

  try {
    // Bluesky's com.atproto.repo.putRecord for the profile
    const resp = await fetch('https://bsky.social/xrpc/com.atproto.repo.putRecord', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: {
          displayName: profile.displayName || '',
          description: profile.bio || '',
          avatar: profile.avatar
            ? { $type: 'blob', ref: { $link: profile.avatar }, mimeType: 'image/jpeg' }
            : undefined,
          banner: profile.banner
            ? { $type: 'blob', ref: { $link: profile.banner }, mimeType: 'image/jpeg' }
            : undefined,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Push a profile update to Lens Protocol.
 * Lens profiles are NFTs — updating requires on-chain tx or dispatcher.
 */
async function pushToLens(
  profile: ProtocolProfile,
  identity: Record<string, unknown>,
  _env: Env,
): Promise<boolean> {
  const profileId = (identity.profileId as string) || '';
  const accessToken = (identity.accessToken as string) || '';
  if (!profileId || !accessToken) return false;

  try {
    // Lens profile metadata can be updated via the Lens API
    // The user must have a dispatcher set up (or we use their access token)
    const lensApi = 'https://api.lens.xyz/graphql';
    const mutation = {
      query: `
        mutation UpdateProfile($request: UpdateProfileRequest!) {
          updateProfile(request: $request)
        }
      `,
      variables: {
        request: {
          profileId,
          name: profile.displayName || undefined,
          bio: profile.bio || undefined,
          picture: profile.avatar || undefined,
          coverPicture: profile.banner || undefined,
          attributes: [],
        },
      },
    };

    const resp = await fetch(lensApi, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-access-token': accessToken,
      },
      body: JSON.stringify(mutation),
      signal: AbortSignal.timeout(10000),
    });

    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Push a profile update to Mastodon.
 */
async function pushToMastodon(
  profile: ProtocolProfile,
  identity: Record<string, unknown>,
  env: Env,
): Promise<boolean> {
  const accessToken = (identity.accessToken as string) || env.GTS_BOT_TOKEN || '';
  const instance = (identity.instance as string) || 'mastodon.social';
  if (!accessToken) return false;

  try {
    const formData = new URLSearchParams();
    if (profile.displayName) formData.set('display_name', profile.displayName);
    if (profile.bio) formData.set('note', profile.bio);
    if (profile.avatar) formData.set('avatar', profile.avatar);
    if (profile.website) formData.set('website', profile.website);

    const resp = await fetch(`https://${instance}/api/v1/accounts/update_credentials`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(10000),
    });

    return resp.ok;
  } catch {
    return false;
  }
}

const PROFILE_PUSHERS: Record<
  string,
  (profile: ProtocolProfile, identity: Record<string, unknown>, env: Env) => Promise<boolean>
> = {
  nostr: pushToNostr,
  farcaster: pushToFarcaster,
  bluesky: pushToBluesky,
  lens: pushToLens,
  mastodon: pushToMastodon,
};

// ─── KV Key Helpers ────────────────────────────────────────────────────

function syncStateKey(wallet: string, protocol: string): string {
  return `profile:sync:${wallet.toLowerCase()}:${protocol}`;
}

function aggregateCacheKey(wallet: string): string {
  return `profile:aggregate:${wallet.toLowerCase()}`;
}

function _badgesKey(wallet: string): string {
  return `profile:badges:${wallet.toLowerCase()}`;
}

function primaryOverrideKey(wallet: string): string {
  return `profile:primary:${wallet.toLowerCase()}`;
}

function syncLockKey(wallet: string): string {
  return `profile:sync:lock:${wallet.toLowerCase()}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** Compute a simple hash of profile content for change detection. */
async function computeProfileHash(profile: ProtocolProfile): Promise<string> {
  const payload = JSON.stringify(profile);
  const encoder = new TextEncoder();
  const hashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
  return bytesToHex(new Uint8Array(hashBytes));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Aggregation ───────────────────────────────────────────────────────

/**
 * Aggregate profile from ALL connected protocols.
 * Returns merged profile with per-protocol breakdown.
 *
 * 1. Load identity record from KV
 * 2. Fetch profile from each protocol in parallel
 * 3. Merge fields using primary overrides
 * 4. Compute verification level and badges
 * 5. Cache result
 */
export async function aggregateProfile(
  wallet: string,
  env: Env,
  options?: { forceRefresh?: boolean },
): Promise<AggregatedProfile> {
  const normalizedWallet = wallet.toLowerCase();

  // Check cache unless forced refresh
  if (!options?.forceRefresh) {
    try {
      const cached = await env.CACHE?.get(aggregateCacheKey(normalizedWallet));
      if (cached) {
        return JSON.parse(cached) as AggregatedProfile;
      }
    } catch {
      // cache miss
    }
  }

  // Load identity record
  let identities: CrossProtocolIdentity | null = null;
  try {
    const raw = await env.IDENTITIES?.get(identityKey(normalizedWallet));
    if (raw) identities = JSON.parse(raw) as CrossProtocolIdentity;
  } catch {
    // no identities found
  }

  // Load primary overrides
  let primaryOverrides: PrimaryFieldOverride = {};
  try {
    const raw = await env.CACHE?.get(primaryOverrideKey(normalizedWallet));
    if (raw) primaryOverrides = JSON.parse(raw) as PrimaryFieldOverride;
  } catch {
    // none set
  }

  // Fetch profiles from all connected protocols in parallel
  const protocolProfiles: Record<string, ProtocolProfile> = {};
  const syncStatuses: Record<string, SyncStatus> = {};

  if (identities) {
    const identityFields = identities as unknown as Record<string, unknown>;
    const fetchTasks: Array<Promise<void>> = [];

    for (const protocol of SUPPORTED_SYNC_PROTOCOLS) {
      const identityData = identityFields[protocol] as Record<string, unknown> | undefined;
      if (!identityData) {
        syncStatuses[protocol] = 'unsupported';
        continue;
      }

      const fetcher = PROFILE_FETCHERS[protocol];
      if (!fetcher) {
        syncStatuses[protocol] = 'unsupported';
        continue;
      }

      fetchTasks.push(
        (async () => {
          try {
            const profile = await fetcher(identityData, env);
            protocolProfiles[protocol] = profile;

            // Check sync state for status
            const stateRaw = await env.CACHE?.get(syncStateKey(normalizedWallet, protocol));
            if (stateRaw) {
              const state = JSON.parse(stateRaw) as ProtocolSyncState;
              syncStatuses[protocol] = state.lastSyncStatus;
            } else {
              syncStatuses[protocol] = 'in_sync';
            }
          } catch {
            protocolProfiles[protocol] = {};
            syncStatuses[protocol] = 'error';
          }
        })(),
      );
    }

    await Promise.all(fetchTasks);
  }

  // Merge fields using primary overrides
  const merged = mergeProfileFields(protocolProfiles, primaryOverrides);

  // Compute badges
  const badges = await computeBadges(normalizedWallet, protocolProfiles, identities, env);

  // Compute verification level
  const verificationLevel = computeVerificationLevel(badges);

  const aggregated: AggregatedProfile = {
    wallet: normalizedWallet,
    ...merged,
    protocols: protocolProfiles,
    primaryOverrides,
    badges,
    verificationLevel,
    syncStatus: syncStatuses,
    updatedAt: Date.now(),
    aggregatedAt: Date.now(),
  };

  // Cache for 5 minutes
  try {
    await env.CACHE?.put(aggregateCacheKey(normalizedWallet), JSON.stringify(aggregated), {
      expirationTtl: 300,
    });
  } catch {
    // non-critical
  }

  return aggregated;
}

/**
 * Merge protocol profiles into a single profile.
 * Uses primary overrides to determine which protocol's fields take precedence.
 */
function mergeProfileFields(
  protocols: Record<string, ProtocolProfile>,
  overrides: PrimaryFieldOverride,
): {
  displayName: string;
  avatar: string;
  bio: string;
  website: string;
  banner?: string;
  lightningAddress?: string;
  nip05?: string;
} {
  const merged: {
    displayName: string;
    avatar: string;
    bio: string;
    website: string;
    banner?: string;
    lightningAddress?: string;
    nip05?: string;
  } = {
    displayName: '',
    avatar: '',
    bio: '',
    website: '',
  };

  // Protocol priority order (lower index = higher priority)
  const protocolOrder = ['farcaster', 'lens', 'nostr', 'bluesky', 'mastodon'];

  // For each field, try primary override first, then first non-empty value in priority order
  const fields: Array<keyof typeof merged> = [
    'displayName',
    'avatar',
    'bio',
    'website',
    'banner',
    'lightningAddress',
    'nip05',
  ];

  for (const field of fields) {
    // Check if there's a primary override
    const overrideProtocol = overrides[field as keyof PrimaryFieldOverride];
    if (overrideProtocol && protocols[overrideProtocol]?.[field as keyof ProtocolProfile]) {
      (merged[field] as string) = String(
        protocols[overrideProtocol][field as keyof ProtocolProfile] || '',
      );
      continue;
    }

    // Otherwise, pick first non-empty value in protocol priority order
    for (const proto of protocolOrder) {
      const val = protocols[proto]?.[field as keyof ProtocolProfile];
      if (val) {
        (merged[field] as string) = String(val);
        break;
      }
    }
  }

  return merged;
}

// ─── Verification Badges ───────────────────────────────────────────────

/**
 * Compute verification badges for a wallet based on linked identities.
 *
 * Badge types:
 *   1. self_verified — User manually linked this protocol
 *   2. wallet_verified — Protocol identity is cryptographically proven
 *      to be owned by this wallet
 *   3. cross_verified — Same identity verified on 3+ protocols
 *   4. attested — Third-party attestation exists
 */
async function computeBadges(
  wallet: string,
  protocols: Record<string, ProtocolProfile>,
  identities: CrossProtocolIdentity | null,
  env: Env,
): Promise<VerificationBadge[]> {
  const badges: VerificationBadge[] = [];
  const now = Date.now();

  // ─── Badge 1: Self-verified per protocol ──────────────────────────
  // Each linked identity is self-verified by default
  if (identities) {
    const identityFields = identities as unknown as Record<string, unknown>;
    const linkedProtocols = SUPPORTED_SYNC_PROTOCOLS.filter((p) => identityFields[p] !== undefined);

    for (const protocol of linkedProtocols) {
      badges.push({
        type: 'self_verified',
        label: `${protocol.charAt(0).toUpperCase() + protocol.slice(1)} Verified`,
        description: `You linked your ${protocol} account to your DegenFeed profile`,
        earnedAt: identities.linkedAt || now,
        protocols: [protocol],
      });
    }
  }

  // ─── Badge 2: Wallet-verified ─────────────────────────────────────
  // A protocol identity is wallet-verified if:
  //   - Farcaster: the verified address matches the user's wallet
  //   - Lens: the profile is owned by the wallet
  //   - ENS: the wallet resolves to the ENS name
  if (identities) {
    const identityFields = identities as unknown as Record<string, unknown>;

    for (const protocol of SUPPORTED_SYNC_PROTOCOLS) {
      const idData = identityFields[protocol] as Record<string, unknown> | undefined;
      if (idData?.verified === true) {
        badges.push({
          type: 'wallet_verified',
          label: `${protocol.charAt(0).toUpperCase() + protocol.slice(1)} Wallet-Verified`,
          description: `Your ${protocol} identity is cryptographically linked to your wallet`,
          earnedAt: now,
          protocols: [protocol],
        });
      }
    }
  }

  // ─── Badge 3: Cross-verified ──────────────────────────────────────
  // Cross-verified = verified on 3+ protocols (excluding DegenFeed self-links)
  // Count unique protocols where we have profile data
  const connectedProtocols = Object.keys(protocols).filter(
    (p) => protocols[p] && Object.keys(protocols[p]).length > 0,
  );

  if (connectedProtocols.length >= 3) {
    badges.push({
      type: 'cross_verified',
      label: 'Verified Across Networks',
      description: `Active on ${connectedProtocols.length} protocols — verified identity across the decentralized web`,
      earnedAt: now,
      protocols: [...connectedProtocols],
    });
  }

  // ─── Badge 4: Attested ────────────────────────────────────────────
  // Check for existing attestation records in KV
  try {
    const attestationsRaw = await env.IDENTITIES?.get(`attest:wallet:${wallet}`);
    if (attestationsRaw) {
      const attestationIds: string[] = JSON.parse(attestationsRaw);
      if (attestationIds.length > 0) {
        badges.push({
          type: 'attested',
          label: 'Identity Attested',
          description: 'Your identity has been cryptographically attested and verified',
          earnedAt: now,
          protocols: [...connectedProtocols],
          metadata: { attestationCount: attestationIds.length },
        });
      }
    }
  } catch {
    // no attestations
  }

  return badges;
}

/**
 * Compute the overall verification level based on badges.
 */
function computeVerificationLevel(badges: VerificationBadge[]): VerificationLevel {
  if (badges.some((b) => b.type === 'attested')) return 'attested';
  if (badges.some((b) => b.type === 'cross_verified')) return 'cross_verified';
  if (badges.some((b) => b.type === 'wallet_verified')) return 'wallet_verified';
  if (badges.some((b) => b.type === 'self_verified')) return 'self_verified';
  return 'none';
}

// ─── Sync Engine ───────────────────────────────────────────────────────

/**
 * Sync profile for a wallet: pull from all protocols and update stored state.
 *
 * Returns sync results per protocol.
 */
export async function syncProfile(
  wallet: string,
  env: Env,
  _options?: { forceRefresh?: boolean },
): Promise<{
  synced: Record<string, { status: SyncStatus; profile: ProtocolProfile; error?: string }>;
  aggregated: AggregatedProfile;
}> {
  const normalizedWallet = wallet.toLowerCase();

  // Acquire sync lock (prevent concurrent syncs for same wallet)
  const lockKey = syncLockKey(normalizedWallet);
  try {
    const lockExists = await env.CACHE?.get(lockKey);
    if (lockExists) {
      // Another sync is in progress — return current aggregate
      const current = await aggregateProfile(normalizedWallet, env);
      return { synced: {}, aggregated: current };
    }
    await env.CACHE?.put(lockKey, '1', { expirationTtl: 60 }); // 60s lock
  } catch {
    // lock failed — proceed anyway
  }

  try {
    const identities = await loadIdentities(normalizedWallet, env);
    const synced: Record<string, { status: SyncStatus; profile: ProtocolProfile; error?: string }> =
      {};

    const syncTasks: Array<Promise<void>> = [];
    const fetchedProfiles: Record<string, ProtocolProfile> = {};

    for (const protocol of SUPPORTED_SYNC_PROTOCOLS) {
      const identityData = identities?.[protocol] as Record<string, unknown> | undefined;
      if (!identityData) {
        synced[protocol] = {
          status: 'unsupported',
          profile: {},
        };
        continue;
      }

      syncTasks.push(
        (async () => {
          try {
            const fetcher = PROFILE_FETCHERS[protocol];
            if (!fetcher) {
              synced[protocol] = { status: 'unsupported', profile: {} };
              return;
            }

            const profile = await fetcher(identityData, env);
            fetchedProfiles[protocol] = profile;

            const hash = await computeProfileHash(profile);

            // Store sync state
            const state: ProtocolSyncState = {
              wallet: normalizedWallet,
              protocol,
              lastSyncAt: Date.now(),
              lastSyncStatus: 'in_sync',
              retryCount: 0,
              profileHash: hash,
              syncedFields: Object.keys(profile).filter((k) =>
                Boolean(profile[k as keyof ProtocolProfile]),
              ),
            };

            await env.CACHE?.put(syncStateKey(normalizedWallet, protocol), JSON.stringify(state));

            synced[protocol] = { status: 'in_sync', profile };
          } catch (err) {
            const errorMessage = String(err);
            synced[protocol] = {
              status: 'error',
              profile: {},
              error: errorMessage,
            };

            // Store error state
            const errorState: ProtocolSyncState = {
              wallet: normalizedWallet,
              protocol,
              lastSyncAt: Date.now(),
              lastSyncStatus: 'error',
              retryCount: 1,
              lastError: errorMessage,
              profileHash: '',
              syncedFields: [],
            };
            await env.CACHE?.put(
              syncStateKey(normalizedWallet, protocol),
              JSON.stringify(errorState),
            );
          }
        })(),
      );
    }

    await Promise.all(syncTasks);

    // Recompute badges after fetch
    let primaryOverrides: PrimaryFieldOverride = {};
    try {
      const raw = await env.CACHE?.get(primaryOverrideKey(normalizedWallet));
      if (raw) primaryOverrides = JSON.parse(raw) as PrimaryFieldOverride;
    } catch {
      // none
    }

    const merged = mergeProfileFields(fetchedProfiles, primaryOverrides);
    const badges = await computeBadges(
      normalizedWallet,
      fetchedProfiles,
      identities as unknown as CrossProtocolIdentity | null,
      env,
    );
    const verificationLevel = computeVerificationLevel(badges);

    const aggregated: AggregatedProfile = {
      wallet: normalizedWallet,
      ...merged,
      protocols: fetchedProfiles,
      primaryOverrides,
      badges,
      verificationLevel,
      syncStatus: Object.fromEntries(Object.entries(synced).map(([p, s]) => [p, s.status])),
      updatedAt: Date.now(),
      aggregatedAt: Date.now(),
    };

    // Cache aggregate
    try {
      await env.CACHE?.put(aggregateCacheKey(normalizedWallet), JSON.stringify(aggregated), {
        expirationTtl: 300,
      });
    } catch {
      // non-critical
    }

    return { synced, aggregated };
  } finally {
    // Release lock
    try {
      await env.CACHE?.delete(lockKey);
    } catch {
      // non-critical
    }
  }
}

/**
 * Push an updated profile to all connected protocols.
 *
 * @param wallet - Wallet address
 * @param updates - Partial profile fields to update
 * @param env - Environment bindings
 * @returns Per-protocol push results
 */
export async function pushProfile(
  wallet: string,
  updates: Partial<ProtocolProfile>,
  env: Env,
): Promise<{
  pushed: Record<string, { success: boolean; error?: string }>;
  aggregated: AggregatedProfile;
}> {
  const normalizedWallet = wallet.toLowerCase();
  const identities = await loadIdentities(normalizedWallet, env);
  const pushed: Record<string, { success: boolean; error?: string }> = {};

  // Get current aggregated profile to merge with updates
  const current = await aggregateProfile(normalizedWallet, env);

  // Merge updates with existing protocols data
  const fullProfile: ProtocolProfile = {
    ...current,
    ...updates,
  };

  const pushTasks: Array<Promise<void>> = [];

  for (const protocol of SUPPORTED_SYNC_PROTOCOLS) {
    const identityData = identities?.[protocol] as Record<string, unknown> | undefined;
    if (!identityData) {
      pushed[protocol] = { success: false, error: 'Identity not linked' };
      continue;
    }

    const pusher = PROFILE_PUSHERS[protocol];
    if (!pusher) {
      pushed[protocol] = { success: false, error: 'Push not supported for this protocol' };
      continue;
    }

    pushTasks.push(
      (async () => {
        try {
          // Only push fields that the protocol supports
          const supportedFields = PROTOCOL_FIELD_SUPPORT[protocol] || {};
          const protocolProfile: ProtocolProfile = {};

          for (const [field, supported] of Object.entries(supportedFields)) {
            if (supported && fullProfile[field as keyof ProtocolProfile]) {
              (protocolProfile[field as keyof ProtocolProfile] as string) = String(
                fullProfile[field as keyof ProtocolProfile],
              );
            }
          }

          // Also include any protocol-specific raw data
          if (current.protocols[protocol]?.raw) {
            protocolProfile.raw = current.protocols[protocol]?.raw;
          }

          const success = await pusher(protocolProfile, identityData, env);

          if (success) {
            pushed[protocol] = { success: true };
            // Update sync state
            const hash = await computeProfileHash(protocolProfile);
            const state: ProtocolSyncState = {
              wallet: normalizedWallet,
              protocol,
              lastSyncAt: Date.now(),
              lastSyncStatus: 'in_sync',
              retryCount: 0,
              profileHash: hash,
              syncedFields: Object.keys(protocolProfile).filter((k) =>
                Boolean(protocolProfile[k as keyof ProtocolProfile]),
              ),
            };
            await env.CACHE?.put(syncStateKey(normalizedWallet, protocol), JSON.stringify(state));
          } else {
            pushed[protocol] = { success: false, error: 'Protocol rejected the update' };
            // Mark as needs_update
            const state: ProtocolSyncState = {
              wallet: normalizedWallet,
              protocol,
              lastSyncAt: Date.now(),
              lastSyncStatus: 'needs_update',
              retryCount: 1,
              lastError: 'Push rejected',
              profileHash: '',
              syncedFields: [],
            };
            await env.CACHE?.put(syncStateKey(normalizedWallet, protocol), JSON.stringify(state));
          }
        } catch (err) {
          pushed[protocol] = { success: false, error: String(err) };
        }
      })(),
    );
  }

  await Promise.all(pushTasks);

  // Recompute aggregated profile after push
  const aggregated = await aggregateProfile(normalizedWallet, env, { forceRefresh: true });
  return { pushed, aggregated };
}

/**
 * Set a primary field override — which protocol's data is canonical for a field.
 */
export async function setPrimaryOverride(
  wallet: string,
  overrides: PrimaryFieldOverride,
  env: Env,
): Promise<AggregatedProfile> {
  const normalizedWallet = wallet.toLowerCase();

  // Load existing overrides
  let existing: PrimaryFieldOverride = {};
  try {
    const raw = await env.CACHE?.get(primaryOverrideKey(normalizedWallet));
    if (raw) existing = JSON.parse(raw) as PrimaryFieldOverride;
  } catch {
    // none
  }

  // Merge new overrides
  const merged: PrimaryFieldOverride = { ...existing, ...overrides };

  // Remove disallowed fields
  const allowedFields: Array<keyof PrimaryFieldOverride> = [
    'displayName',
    'avatar',
    'bio',
    'website',
    'banner',
  ];
  for (const key of Object.keys(merged) as Array<keyof PrimaryFieldOverride>) {
    if (!allowedFields.includes(key) || !merged[key]) {
      delete merged[key];
    }
  }

  await env.CACHE?.put(primaryOverrideKey(normalizedWallet), JSON.stringify(merged));

  // Force recache aggregate
  return aggregateProfile(normalizedWallet, env, { forceRefresh: true });
}

/**
 * Get sync status for all protocols of a wallet.
 */
export async function getSyncStatus(
  wallet: string,
  env: Env,
): Promise<
  Record<
    string,
    { status: SyncStatus; lastSyncAt?: number; lastError?: string; syncedFields?: string[] }
  >
> {
  const normalizedWallet = wallet.toLowerCase();
  const statuses: Record<
    string,
    { status: SyncStatus; lastSyncAt?: number; lastError?: string; syncedFields?: string[] }
  > = {};

  for (const protocol of SUPPORTED_SYNC_PROTOCOLS) {
    try {
      const raw = await env.CACHE?.get(syncStateKey(normalizedWallet, protocol));
      if (raw) {
        const state = JSON.parse(raw) as ProtocolSyncState;
        statuses[protocol] = {
          status: state.lastSyncStatus,
          lastSyncAt: state.lastSyncAt,
          lastError: state.lastError,
          syncedFields: state.syncedFields,
        };
      } else {
        statuses[protocol] = { status: 'unsupported' };
      }
    } catch {
      statuses[protocol] = { status: 'error', lastError: 'Failed to read sync state' };
    }
  }

  return statuses;
}

// ─── Internal Helpers ──────────────────────────────────────────────────

async function loadIdentities(wallet: string, env: Env): Promise<Record<string, unknown> | null> {
  try {
    const raw = await env.IDENTITIES?.get(identityKey(wallet));
    if (raw) {
      const parsed = JSON.parse(raw) as CrossProtocolIdentity;
      return parsed as unknown as Record<string, unknown>;
    }
  } catch {
    // no identities
  }
  return null;
}

// ─── Export for search indexing ────────────────────────────────────────

export { computeBadges, computeVerificationLevel, mergeProfileFields };
