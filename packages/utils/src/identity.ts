/**
 * @degenfeed/identity
 *
 * Cross-protocol identity resolution.
 *
 * Maps handles and keys between protocols:
 *   - NIP-05 ↔ FID ↔ Lens handle ↔ Bluesky DID
 *   - Links known cross-protocol identities into a single UnifiedIdentity
 *
 * The identity graph is built from:
 *   1. The user's explicit linking (stored in @degenfeed/storage identities)
 *   2. Public attestations (NIP-05 files that reference other handles)
 *   3. Known bridge mappings (e.g. Nostr ↔ Farcaster bridge bots)
 *
 * This is a pure resolver — it never stores keys, only public identifiers.
 */

import type { Protocol, UnifiedIdentity } from '@degenfeed/types';
import type { CrossProtocolIdentity, ProtocolId } from '@degenfeed/utils';
import { PROTOCOL_ID_REGISTRY } from '@degenfeed/utils';

export type { CrossProtocolIdentity, Protocol, ProtocolId, UnifiedIdentity };

// ─── Identity mapping types ────────────────────────────────────────────

export interface IdentityLink {
  /** The protocol+id that asserts the link */
  sourceProtocol: Protocol;
  sourceId: string;
  /** The target protocol+id */
  targetProtocol: Protocol;
  targetId: string;
  /** How the link was verified */
  verificationMethod: 'user' | 'nip05' | 'bridge' | 'external';
  /** When the link was discovered */
  discoveredAt: number;
}

export interface IdentityResolution {
  /** The primary identity (canonical view) */
  identity: UnifiedIdentity;
  /** All linked protocols/ids */
  links: IdentityLink[];
  /** Confidence score 0-1 */
  confidence: number;
}

// ─── Cross-protocol handle resolvers ───────────────────────────────────

export interface HandleResolution {
  protocol: Protocol;
  id: string;
  handle: string;
  walletAddress?: string;
}

/**
 * Resolve a handle from any protocol to its canonical id.
 *
 * Supported resolutions:
 *   - NIP-05 (user@domain) → Nostr pubkey
 *   - NIP-05 in Nostr profile → FID (via NIP-05 metadata)
 *   - FID → Farcaster username
 *   - Lens handle → Lens profile ID
 *   - Bluesky handle/DID → Bluesky DID
 *   - Nostr npub → pubkey hex
 */
export async function resolveHandle(
  handle: string,
  fetchFn: typeof fetch = fetch,
): Promise<HandleResolution | null> {
  // NIP-05: user@domain -> Nostr pubkey
  if (handle.includes('@') && !handle.startsWith('@')) {
    return resolveNip05(handle, fetchFn);
  }

  // Nostr npub
  if (handle.startsWith('npub1')) {
    // We use dynamic import to avoid hard dependency
    try {
      const { npubDecode: decode } = await import('@degenfeed/nostr-sdk');
      const pk = decode(handle);
      return { protocol: 'nostr', id: pk, handle };
    } catch {
      return null;
    }
  }

  // Farcaster FID or username (try both)
  if (/^\d+$/.test(handle)) {
    return resolveFarcasterFid(Number.parseInt(handle, 10), fetchFn);
  }
  if (handle.startsWith('@')) {
    return resolveFarcasterUsername(handle.slice(1), fetchFn);
  }

  // Bluesky DID
  if (handle.startsWith('did:')) {
    // Look up the DID document
    try {
      const docRes = await fetchFn(`https://plc.directory/${encodeURIComponent(handle)}/data`);
      if (docRes.ok) {
        return { protocol: 'bluesky', id: handle, handle };
      }
    } catch {
      // fall through
    }
  }

  // Bluesky handle (domain-like, but not a fediverse handle)
  if (handle.includes('.') && !handle.startsWith('@') && !handle.includes('@')) {
    return resolveBlueskyHandle(handle, fetchFn);
  }

  // Fediverse: Mastodon / Threads / any ActivityPub instance via WebFinger
  // Handles `user@instance.com` that didn't resolve as NIP-05 (non-Nostr)
  if (handle.includes('@') && !handle.startsWith('@')) {
    const fediverse = await resolveFediverseHandle(handle, fetchFn);
    if (fediverse) return fediverse;
  }

  // Lens handle (no @, just name)
  return resolveLensHandle(handle, fetchFn);
}

async function resolveNip05(
  nip05: string,
  fetchFn: typeof fetch,
): Promise<HandleResolution | null> {
  try {
    const { resolveNip05 } = await import('@degenfeed/nostr-sdk');
    const result = await resolveNip05(nip05, fetchFn);
    if (!result) return null;
    return { protocol: 'nostr', id: result.pubkey, handle: nip05 };
  } catch {
    return null;
  }
}

async function resolveFarcasterFid(
  fid: number,
  fetchFn: typeof fetch,
): Promise<HandleResolution | null> {
  try {
    const res = await fetchFn(
      `https://hub.farcaster.standardcrypto.vc:2281/v1/userDataByFid?fid=${fid}`,
    );
    if (!res.ok) return null;
    return { protocol: 'farcaster', id: String(fid), handle: `@${fid}` };
  } catch {
    return null;
  }
}

async function resolveFarcasterUsername(
  username: string,
  fetchFn: typeof fetch,
): Promise<HandleResolution | null> {
  try {
    const res = await fetchFn(
      `https://hub.farcaster.standardcrypto.vc:2281/v1/userDataByUsername?username=${encodeURIComponent(username)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { fid: number };
    return { protocol: 'farcaster', id: String(json.fid), handle: `@${username}` };
  } catch {
    return null;
  }
}

async function resolveLensHandle(
  handle: string,
  fetchFn: typeof fetch,
): Promise<HandleResolution | null> {
  try {
    const res = await fetchFn('https://api.lens.xyz/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `query { profile(request: { handle: "${handle}" }) { id handle } }`,
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data: { profile: { id: string; handle: string } | null } };
    if (!json.data?.profile) return null;
    return {
      protocol: 'lens',
      id: json.data.profile.id,
      handle: `lens/${json.data.profile.handle}`,
    };
  } catch {
    return null;
  }
}

async function resolveBlueskyHandle(
  handle: string,
  fetchFn: typeof fetch,
): Promise<HandleResolution | null> {
  try {
    const res = await fetchFn(
      `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { did: string };
    return { protocol: 'bluesky', id: json.did, handle: `@${handle}` };
  } catch {
    return null;
  }
}

// ─── GotoSocial handle resolution ──────────────────────────────────────

/**
 * Resolve a fediverse handle (user@instance.com) to its canonical ActivityPub ID.
 * Fetches the WebFinger endpoint for the domain.
 */
export async function resolveFediverseHandle(
  handle: string,
  fetchFn: typeof fetch = fetch,
): Promise<HandleResolution | null> {
  // Format: user@instance.com
  const atIndex = handle.indexOf('@');
  if (atIndex <= 0 || atIndex === handle.length - 1) return null;
  const domain = handle.slice(atIndex + 1);

  try {
    const webfingerUrl = `https://${domain}/.well-known/webfinger?resource=acct:${encodeURIComponent(handle)}`;
    const res = await fetchFn(webfingerUrl);
    if (!res.ok) return null;
    const json = (await res.json()) as { links?: { rel: string; href: string; type?: string }[] };
    if (!json.links) return null;
    const selfLink = json.links.find((l) => l.rel === 'self');
    if (!selfLink) return null;
    // Detect Threads vs Mastodon by domain
    const isThreads = domain === 'threads.net' || domain.endsWith('.threads.net');
    return { protocol: isThreads ? 'threads' : 'mastodon', id: selfLink.href, handle };
  } catch {
    return null;
  }
}

// ─── Unified cross-protocol profile ───────────────────────────────────

export interface ProtocolHandle {
  protocol: string;
  handle: string;
  icon: string;
  color: string;
  verified: boolean;
  followerCount?: number;
}

export interface UnifiedProfile {
  walletAddress: string;
  displayName: string;
  handles: ProtocolHandle[];
  totalFollowerCount: number;
  networkCount: number;
  linkedAt: number;
  lastVerified: number;
  primaryProtocol: string;
  dfUri: string;
}

export function buildUnifiedProfile(
  identity: CrossProtocolIdentity,
  followerCounts?: Partial<Record<ProtocolId, number>>,
): UnifiedProfile {
  const handles: ProtocolHandle[] = [];

  for (const [protocol, info] of Object.entries(PROTOCOL_ID_REGISTRY)) {
    const ident = (identity as unknown as Record<string, unknown>)[protocol];
    if (!ident || typeof ident !== 'object') continue;

    const p = ident as Record<string, unknown>;
    const handle =
      (p.handle as string) ||
      (p.username as string) ||
      (p.npub as string) ||
      (p.did as string) ||
      (p.id as string) ||
      '';

    if (!handle) continue;

    handles.push({
      protocol,
      handle,
      icon: info.icon,
      color: info.color,
      verified: (p.verified as boolean) || false,
      followerCount: followerCounts?.[protocol as ProtocolId],
    });
  }

  const primary = handles[0];
  const totalFollowerCount = handles.reduce((sum, h) => sum + (h.followerCount || 0), 0);

  return {
    walletAddress: identity.walletAddress,
    displayName: handles.map((h) => h.handle).join(' / '),
    handles,
    totalFollowerCount,
    networkCount: handles.length,
    linkedAt: identity.linkedAt,
    lastVerified: identity.lastVerified,
    primaryProtocol: primary?.protocol ?? 'nostr',
    dfUri: `df://profile/${identity.walletAddress}`,
  };
}

export function formatCrossProtocolFollowers(count: number, networks: number): string {
  if (count === 0) return 'No followers yet';
  const formatted =
    count >= 1_000_000
      ? `${(count / 1_000_000).toFixed(1)}M`
      : count >= 1_000
        ? `${(count / 1_000).toFixed(1)}K`
        : String(count);
  return `${formatted} followers${networks > 1 ? ` across ${networks} networks` : ''}`;
}

/**


/**
 * Merge multiple protocol identities into a single UnifiedIdentity.
 * Later entries override earlier ones for display fields.
 */
export function mergeIdentities(identities: Partial<UnifiedIdentity>[]): UnifiedIdentity {
  const merged: UnifiedIdentity = {
    id: '',
    primary: { protocol: 'nostr', id: '' },
    handles: { nostr: null, farcaster: null, lens: null, bluesky: null },
    displayName: '',
    bio: '',
    avatarUrl: '',
    verified: [],
    followerCount: 0,
    followingCount: 0,
    links: [],
    keys: {},
  };

  for (const ident of identities) {
    if (ident.id) merged.id = ident.id;
    if (ident.primary) merged.primary = ident.primary;
    if (ident.handles) {
      for (const p of ['nostr', 'farcaster', 'lens', 'bluesky', 'rss'] as Protocol[]) {
        if (ident.handles[p]) merged.handles[p] = ident.handles[p];
      }
    }
    if (ident.displayName) merged.displayName = ident.displayName;
    if (ident.bio) merged.bio = ident.bio;
    if (ident.avatarUrl) merged.avatarUrl = ident.avatarUrl;
    if (ident.verified) merged.verified = [...merged.verified, ...ident.verified];
    if (ident.followerCount) merged.followerCount = ident.followerCount;
    if (ident.followingCount) merged.followingCount = ident.followingCount;
    if (ident.links) merged.links = [...merged.links, ...ident.links];
    if (ident.keys) merged.keys = { ...merged.keys, ...ident.keys };
  }

  return merged;
}
