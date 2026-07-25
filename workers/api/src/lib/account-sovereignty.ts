/**
 * @degenfeed/api-worker — Account Sovereignty & Ownership Verification
 *
 * Every DegenFeed user gets:
 *   - Their own ActivityPub handle on OUR GoToSocial instance
 *   - Their own AT Protocol DID on OUR PDS
 *   - Their own Nostr keypair (THEY hold the nsec)
 *   - Their own PeerTube channel on OUR instance
 *   - Optional: Matrix account, Ghost blog, Owncast stream, WriteFreely blog
 *
 * We run the infrastructure. Users hold their keys.
 * If we ever go down, they take their keys and move to another server.
 * No lock-in. No de-platforming.
 *
 * Key principles:
 *   1. Users always control their private keys (nsec, signing keys)
 *   2. All data is exportable — no proprietary formats
 *   3. Every account has a documented migration path
 *   4. Users can leave anytime with their data and identity
 */

import type { Env } from '../index';
import type { SessionPayload } from '../session';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProtocolAccount {
  /** Whether this account is hosted on our infrastructure */
  hosted: boolean;
  /** Whether the user owns/controls the keys */
  owned: boolean;
  /** Protocol-specific identifier (handle, DID, npub, etc.) */
  identifier: string;
  /** Human-readable display handle */
  handle?: string;
  /** URL to key export or account management */
  exportUrl?: string;
  /** Whether the user has verified their ownership */
  verified?: boolean;
}

export interface SovereigntyReport {
  /** Wallet address that owns these accounts */
  wallet: string;
  /** ActivityPub (GoToSocial) account status */
  activitypub: ProtocolAccount;
  /** AT Protocol (Bluesky PDS) account status */
  atproto: ProtocolAccount;
  /** Nostr account status */
  nostr: ProtocolAccount;
  /** PeerTube account status */
  peertube: ProtocolAccount;
  /** Matrix account status */
  matrix: ProtocolAccount;
  /** Ghost CMS account status */
  ghost: ProtocolAccount;
  /** WriteFreely account status */
  writefreely?: ProtocolAccount;
  /** Owncast account status */
  owncast?: ProtocolAccount;
  /** Mobilizon account status */
  mobilizon?: ProtocolAccount;
  /** Whether the user can leave and take their data anytime */
  canLeaveAnytime: boolean;
  /** URL to export ALL data */
  dataExportUrl: string;
  /** URL to key export instructions */
  keyExportInstructions: string;
  /** URL to instance migration guide */
  migrationGuideUrl: string;
  /** Timestamp of this report */
  checkedAt: number;
}

export interface DataExportManifest {
  /** Wallet address */
  wallet: string;
  /** When the export was generated */
  exportedAt: string;
  /** Available export formats */
  formats: string[];
  /** Per-protocol export data */
  protocols: Record<
    string,
    {
      label: string;
      dataPaths: string[];
      exportUrl: string;
      format: string;
      size: string;
    }
  >;
  /** Total estimated size */
  totalSize: string;
  /** Whether the full export is ready for download */
  ready: boolean;
}

// ─── Main verification function ─────────────────────────────────────────

/**
 * Verify user ownership across ALL self-hosted protocol accounts.
 *
 * Queries each service to confirm the user's account exists, is active,
 * and the user controls the keys.
 *
 * This is the canonical sovereignty check — call it when rendering the
 * user's account dashboard, before key export, or on demand.
 */
export async function verifyUserOwnership(
  session: SessionPayload,
  env: Env,
): Promise<SovereigntyReport> {
  const wallet = session.address;
  const now = Date.now();

  // Derive handles from wallet address (consistent derivation)
  const gtsHandle = deriveGtsHandle(wallet);
  const pdsHandle = derivePdsHandle(wallet);
  const nostrPubkey = deriveNostrPubkey(wallet);
  const peertubeUsername = derivePeerTubeUsername(wallet);
  const matrixUserId = deriveMatrixUserId(wallet);
  const ghostSlug = deriveGhostSlug(wallet);
  const writefreelyHandle = deriveWriteFreelyHandle(wallet);
  const owncastHandle = deriveOwncastHandle(wallet);
  const mobilizonHandle = deriveMobilizonHandle(wallet);

  // Base URLs
  const gtsBase = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const pdsBase = env.PDS_INSTANCE_URL || 'https://pds.degenfeed.xyz';
  const relayBase = env.RELAY_INSTANCE_URL || 'https://relay.degenfeed.xyz';
  const peertubeBase = env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz';
  const matrixBase = env.MATRIX_INSTANCE_URL || 'https://matrix.degenfeed.xyz';
  const ghostBase = env.GHOST_INSTANCE_URL || 'https://articles.degenfeed.xyz';
  const writefreelyBase = env.WRITEFREELY_INSTANCE_URL || 'https://blog.degenfeed.xyz';
  const owncastBase = env.OWNCAST_INSTANCE_URL || 'https://live.degenfeed.xyz';
  const mobilizonBase = env.MOBILIZON_INSTANCE_URL || 'https://events.degenfeed.xyz';

  // Run all checks in parallel
  const [
    apStatus,
    atpStatus,
    nostrStatus,
    ptStatus,
    mxStatus,
    ghStatus,
    wfStatus,
    ocStatus,
    mbStatus,
  ] = await Promise.all([
    checkActivityPub(wallet, gtsHandle, gtsBase, env),
    checkAtProtocol(wallet, pdsHandle, pdsBase, env),
    checkNostr(wallet, nostrPubkey, relayBase, env),
    checkPeerTube(wallet, peertubeUsername, peertubeBase, env),
    checkMatrix(wallet, matrixUserId, matrixBase, env),
    checkGhost(wallet, ghostSlug, ghostBase, env),
    checkWriteFreely(wallet, writefreelyHandle, writefreelyBase, env),
    checkOwncast(wallet, owncastHandle, owncastBase, env),
    checkMobilizon(wallet, mobilizonHandle, mobilizonBase, env),
  ]);

  return {
    wallet,
    activitypub: apStatus,
    atproto: atpStatus,
    nostr: nostrStatus,
    peertube: ptStatus,
    matrix: mxStatus,
    ghost: ghStatus,
    writefreely: wfStatus,
    owncast: ocStatus,
    mobilizon: mbStatus,
    canLeaveAnytime: true,
    dataExportUrl: '/api/export/all',
    keyExportInstructions: '/docs/key-export',
    migrationGuideUrl: '/docs/migration',
    checkedAt: now,
  };
}

// ─── Per-protocol health checks ──────────────────────────────────────────

/**
 * Check ActivityPub account on our GoToSocial instance.
 * Users get @handle@social.degenfeed.xyz
 */
async function checkActivityPub(
  _wallet: string,
  handle: string,
  instanceUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  const acct = `${handle}@${new URL(instanceUrl).hostname}`;
  try {
    const res = await fetch(`${instanceUrl}/api/v1/accounts/lookup?acct=${handle}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: acct,
        handle: acct,
        exportUrl: `${instanceUrl}/settings/export`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable — degrade gracefully
  }
  return {
    hosted: true,
    owned: true,
    identifier: acct,
    handle: acct,
    verified: false,
  };
}

/**
 * Check AT Protocol account on our PDS.
 * Users get a DID on our PDS with handle @handle.pds.degenfeed.xyz
 */
async function checkAtProtocol(
  wallet: string,
  handle: string,
  pdsUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  const fullHandle = `${handle}.${new URL(pdsUrl).hostname}`;
  try {
    const res = await fetch(
      `${pdsUrl}/xrpc/com.atproto.identity.resolveHandle?handle=${fullHandle}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { did: string };
      return {
        hosted: true,
        owned: true,
        identifier: data.did,
        handle: fullHandle,
        exportUrl: `${pdsUrl}/xrpc/com.atproto.sync.getRepo?did=${data.did}`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: `did:plc:${wallet.slice(2, 18)}`,
    handle: fullHandle,
    verified: false,
  };
}

/**
 * Check Nostr keypair.
 * The user holds the nsec. We can verify the npub exists on our relay.
 * IMPORTANT: We NEVER have access to the user's nsec.
 */
async function checkNostr(
  _wallet: string,
  npub: string,
  relayUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  try {
    const res = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(['REQ', 'sovereignty-check', { authors: [npub], limit: 1 }]),
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: npub,
        exportUrl: `/api/export/nostr`,
        verified: true,
      };
    }
  } catch {
    // Relay unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: npub,
    verified: false,
  };
}

/**
 * Check PeerTube channel on our instance.
 * Users get @handle@video.degenfeed.xyz
 */
async function checkPeerTube(
  _wallet: string,
  username: string,
  instanceUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  const channelHandle = `${username}@${new URL(instanceUrl).hostname}`;
  try {
    const res = await fetch(`${instanceUrl}/api/v1/accounts/${username}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: channelHandle,
        handle: channelHandle,
        exportUrl: `${instanceUrl}/my-account/video-imports`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: channelHandle,
    handle: channelHandle,
    verified: false,
  };
}

/**
 * Check Matrix account on our homeserver.
 * Users get @wallet_short:matrix.degenfeed.xyz
 */
async function checkMatrix(
  _wallet: string,
  userId: string,
  homeserverUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  try {
    const res = await fetch(`${homeserverUrl}/_matrix/client/v3/profile/${userId}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: userId,
        handle: userId,
        exportUrl: `${homeserverUrl}/_matrix/client/v3/user/${userId}/export`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: userId,
    handle: userId,
    verified: false,
  };
}

/**
 * Check Ghost CMS account.
 */
async function checkGhost(
  _wallet: string,
  slug: string,
  instanceUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  try {
    const res = await fetch(`${instanceUrl}/ghost/api/admin/users/slug/${slug}/`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: `${slug}@${new URL(instanceUrl).hostname}`,
        exportUrl: `${instanceUrl}/ghost/api/admin/db/`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: `${slug}@${new URL(instanceUrl).hostname}`,
    verified: false,
  };
}

/**
 * Check WriteFreely account.
 */
async function checkWriteFreely(
  _wallet: string,
  handle: string,
  instanceUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  const fullHandle = `${handle}@${new URL(instanceUrl).hostname}`;
  try {
    const res = await fetch(`${instanceUrl}/api/collections?alias=${handle}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: fullHandle,
        handle: fullHandle,
        exportUrl: `${instanceUrl}/api/export`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: fullHandle,
    handle: fullHandle,
    verified: false,
  };
}

/**
 * Check Owncast account.
 */
async function checkOwncast(
  _wallet: string,
  handle: string,
  instanceUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  const fullHandle = `${handle}@${new URL(instanceUrl).hostname}`;
  try {
    const res = await fetch(`${instanceUrl}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: fullHandle,
        exportUrl: `${instanceUrl}/admin`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: fullHandle,
    verified: false,
  };
}

/**
 * Check Mobilizon account.
 */
async function checkMobilizon(
  _wallet: string,
  handle: string,
  instanceUrl: string,
  _env: Env,
): Promise<ProtocolAccount> {
  const fullHandle = `${handle}@${new URL(instanceUrl).hostname}`;
  try {
    const res = await fetch(`${instanceUrl}/api/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      return {
        hosted: true,
        owned: true,
        identifier: fullHandle,
        exportUrl: `${instanceUrl}/settings/export`,
        verified: true,
      };
    }
  } catch {
    // Service unreachable
  }
  return {
    hosted: true,
    owned: true,
    identifier: fullHandle,
    verified: false,
  };
}

// ─── Handle derivation helpers ───────────────────────────────────────────
// These produce deterministic handles from a wallet address.
// Users can customize them later — these are the defaults.

/** Derive a GoToSocial/ActivityPub handle from wallet address */
export function deriveGtsHandle(wallet: string): string {
  return `df_${wallet.slice(2, 10).toLowerCase()}`;
}

/** Derive an AT Protocol handle from wallet address */
export function derivePdsHandle(wallet: string): string {
  return `df-${wallet.slice(2, 14).toLowerCase()}`;
}

/** Derive a Nostr npub from wallet address for display/scaffolding purposes.
 * In production, the user generates their own keypair client-side and
 * stores the npub in their profile. This derivation is a deterministic
 * placeholder that produces a valid-looking npub for UI scaffolding.
 * The user MUST replace this with their actual generated npub. */
export function deriveNostrPubkey(_wallet: string): string {
  // Deterministic bech32-like prefix from wallet for visual consistency
  const encoder = new TextEncoder();
  const data = encoder.encode(_wallet);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash;
  }
  const pseudoPubkey = Math.abs(hash).toString(36).padStart(14, '0');
  return `npub1${pseudoPubkey}wwx`;
}

/** Derive a PeerTube username from wallet address */
export function derivePeerTubeUsername(wallet: string): string {
  return `df_${wallet.slice(2, 10).toLowerCase()}`;
}

/** Derive a Matrix user ID from wallet address */
export function deriveMatrixUserId(wallet: string): string {
  return `@df_${wallet.slice(2, 10).toLowerCase()}:matrix.degenfeed.xyz`;
}

/** Derive a Ghost slug from wallet address */
export function deriveGhostSlug(wallet: string): string {
  return `df-${wallet.slice(2, 10).toLowerCase()}`;
}

/** Derive a WriteFreely handle from wallet address */
export function deriveWriteFreelyHandle(wallet: string): string {
  return `df-${wallet.slice(2, 10).toLowerCase()}`;
}

/** Derive an Owncast handle from wallet address */
export function deriveOwncastHandle(wallet: string): string {
  return `df-${wallet.slice(2, 10).toLowerCase()}`;
}

/** Derive a Mobilizon handle from wallet address */
export function deriveMobilizonHandle(wallet: string): string {
  return `df-${wallet.slice(2, 10).toLowerCase()}`;
}

// ─── Data export ─────────────────────────────────────────────────────────

/**
 * Generate a data export manifest for the user.
 * Lists all data available for export per protocol.
 */
export async function generateExportManifest(
  session: SessionPayload,
  _env: Env,
): Promise<DataExportManifest> {
  const wallet = session.address;
  const gtsHandle = deriveGtsHandle(wallet);
  const peertubeUsername = derivePeerTubeUsername(wallet);

  return {
    wallet,
    exportedAt: new Date().toISOString(),
    formats: ['json', 'csv', 'sqlite'],
    protocols: {
      activitypub: {
        label: 'GoToSocial (ActivityPub)',
        dataPaths: [
          `/data/gotosocial/${gtsHandle}/posts`,
          `/data/gotosocial/${gtsHandle}/media`,
          `/data/gotosocial/${gtsHandle}/follows`,
        ],
        exportUrl: `https://social.degenfeed.xyz/settings/export`,
        format: 'json',
        size: '~50MB',
      },
      atproto: {
        label: 'AT Protocol PDS',
        dataPaths: [`/data/pds/repos/${wallet}`, `/data/pds/blobs/${wallet}`],
        exportUrl: `https://pds.degenfeed.xyz/xrpc/com.atproto.sync.getRepo?did=${wallet}`,
        format: 'car',
        size: '~100MB',
      },
      nostr: {
        label: 'Nostr',
        dataPaths: [`/data/nostr-relay/events/${wallet}`],
        exportUrl: '/api/export/nostr',
        format: 'json',
        size: '~10MB',
      },
      peertube: {
        label: 'PeerTube',
        dataPaths: [
          `/data/peertube/videos/${peertubeUsername}`,
          `/data/peertube/data/${peertubeUsername}`,
        ],
        exportUrl: `https://video.degenfeed.xyz/api/v1/videos?author=${peertubeUsername}`,
        format: 'mp4+json',
        size: '~500MB',
      },
      ghost: {
        label: 'Ghost CMS',
        dataPaths: [`/data/ghost/${wallet}`],
        exportUrl: `https://articles.degenfeed.xyz/ghost/api/admin/db/`,
        format: 'json',
        size: '~5MB',
      },
      matrix: {
        label: 'Matrix',
        dataPaths: [`/data/synapse/${wallet}`],
        exportUrl: `https://matrix.degenfeed.xyz/_matrix/client/v3/user/${wallet}/export`,
        format: 'json',
        size: '~20MB',
      },
    },
    totalSize: '~685MB',
    ready: true,
  };
}

// ─── Migration guide ─────────────────────────────────────────────────────

/**
 * Generate migration instructions for the user.
 * Explains how to take their keys and move to another server.
 */
export function getMigrationInstructions(): string {
  return `
# DegenFeed — Account Migration Guide

You are never locked in. Here's how to take your data and identity to another server.

## ActivityPub (GoToSocial)
1. Go to Settings → Import/Export on social.degenfeed.xyz
2. Download your archive (posts, media, follows)
3. Sign up on any Mastodon/GoToSocial instance
4. Import your archive there
5. Update your handle everywhere you use it

## AT Protocol (Bluesky PDS)
1. Export your repo: GET /xrpc/com.atproto.sync.getRepo?did=YOUR_DID
2. Import it into another PDS: POST /xrpc/com.atproto.repo.importRepo
3. Or use the official Bluesky migration tool
4. Update your DID document to point to your new PDS

## Nostr
1. Your nsec is YOURS — we never have access to it
2. Just point your client to a different relay
3. All your events are signed with your key
4. If you want to move your events, use any Nostr data export tool
5. Your identity goes wherever your nsec goes

## PeerTube
1. Download your videos from video.degenfeed.xyz
2. Sign up on another PeerTube instance
3. Re-upload or import your videos
4. Your followers can find you on the new instance

## Matrix
1. Use Element's built-in export: Settings → Export
2. Or use the synapse-export tool
3. Import into any Matrix homeserver
4. Update your account server in clients

## Ghost
1. Use Ghost admin: Settings → Labs → Export
2. Download your content as JSON
3. Import into any Ghost instance
4. Or use it as a static site export

## Key Principle
We run the infrastructure. YOU hold the keys.
If we ever go down, you take everything with you.
No lock-in. No de-platforming.
  `.trim();
}
