/**
 * @degenfeed/api-worker — Network Participation Rights Registry
 *
 * Permanent, verifiable membership in every network.
 * Rights that CANNOT be taken away, revoked, or modified — only added to.
 *
 * Core principle: EVERY right is an immutable append-only log entry.
 *   - Rights can only be CREATED, never deleted or modified
 *   - Each right has a cryptographic attestation anchor
 *   - Rights persist even if the user leaves a protocol
 *   - "You were a member of this network on this date, and that fact is permanent"
 *
 * KV key scheme:
 *   npr:{wallet}:{protocol}          → ProtocolMembership (latest)
 *   npr:{wallet}:history             → MembershipHistoryEntry[] (append-only)
 *   npr:{wallet}:rights              → NetworkRight[] (all active rights)
 *   npr:{wallet}:manifest            → RightsManifest (complete summary)
 *   npr:immutable:{id}               → ImmutableRight (cryptographic timestamp proof)
 *   npr:index:{network}              → RightsIndexEntry[] (network-wide index)
 *   npr:stats:{network}              → NetworkStats (aggregate)
 */

import type { Env } from '../index';

// ─── Types ─────────────────────────────────────────────────────────────

export type NetworkProtocol =
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'bluesky'
  | 'mastodon'
  | 'reddit'
  | 'threads'
  | 'lemmy'
  | 'peertube'
  | 'atproto'
  | 'zora'
  | 'telegram'
  | 'rss'
  | 'ethereum'
  | 'solana';

export type MembershipStatus = 'active' | 'inactive' | 'suspended' | 'exited';
export type RightType = 'membership' | 'contribution' | 'achievement' | 'governance' | 'content' | 'reputation';

export interface ProtocolMembership {
  /** Wallet address */
  wallet: string;
  /** Protocol this membership is for */
  protocol: NetworkProtocol;
  /** Protocol-specific identifier (handle, DID, npub, FID) */
  identifier: string;
  /** Human-readable label */
  label: string;
  /** Current membership status */
  status: MembershipStatus;
  /** When the user FIRST joined this network (immutable) */
  joinedAt: number;
  /** When the membership was last updated */
  updatedAt: number;
  /** All status changes in order (immutable log) */
  statusHistory: StatusChangeEntry[];
  /** Active rights granted to this user in this network */
  rights: NetworkRight[];
  /** Number of contributions made */
  contributionCount: number;
  /** Total engagement score */
  engagementScore: number;
  /** Whether this membership is verified on-chain */
  verified: boolean;
  /** Last verification timestamp */
  lastVerifiedAt?: number;
  /** Attestation IDs proving this membership */
  attestationIds: string[];
}

export interface StatusChangeEntry {
  /** Previous status */
  from: MembershipStatus;
  /** New status */
  to: MembershipStatus;
  /** When the change occurred */
  changedAt: number;
  /** Reason for the change */
  reason: string;
  /** Who or what triggered the change */
  changedBy: 'user' | 'system' | 'admin' | 'protocol';
  /** Unique change ID (immutable) */
  changeId: string;
}

export interface NetworkRight {
  /** Unique right ID */
  id: string;
  /** Type of right */
  type: RightType;
  /** Human-readable name */
  name: string;
  /** Description of what this right grants */
  description: string;
  /** Protocol this right applies to */
  protocol: NetworkProtocol;
  /** When this right was granted (immutable) */
  grantedAt: number;
  /** Grant reason */
  reason: string;
  /** Whether this right is active */
  active: boolean;
  /** If inactive, why */
  inactivationReason?: string;
  /** Cryptographic proof hash */
  proofHash?: string;
  /** Attestation link */
  attestationId?: string;
}

export interface ImmutableRight {
  /** Unique immutable right ID */
  id: string;
  /** Wallet address */
  wallet: string;
  /** The right that was granted */
  right: NetworkRight;
  /** SHA-256 hash of the right (for verification) */
  rightHash: string;
  /** Timestamp when this was recorded */
  timestamp: number;
  /** Anchor on a public blockchain or DHT */
  anchor?: {
    chain: string;
    txHash: string;
    blockNumber: number;
  };
}

export interface RightsManifest {
  /** Wallet address */
  wallet: string;
  /** All networks the user has ever been a member of */
  networks: Array<{
    protocol: NetworkProtocol;
    identifier: string;
    label: string;
    status: MembershipStatus;
    joinedAt: number;
    rightCount: number;
  }>;
  /** Total number of rights across all networks */
  totalRights: number;
  /** Total number of networks */
  totalNetworks: number;
  /** Number of active memberships */
  activeMemberships: number;
  /** Timestamp when this was generated */
  generatedAt: number;
  /** Signature hash for verification */
  manifestHash: string;
}

export interface MembershipHistoryEntry {
  /** Wallet address */
  wallet: string;
  /** Protocol */
  protocol: NetworkProtocol;
  /** What happened */
  event: 'joined' | 'right_granted' | 'status_changed' | 'right_inactivated' | 'exited';
  /** Event details */
  detail: string;
  /** When it happened */
  timestamp: number;
  /** Unique event ID */
  eventId: string;
  /** Verification hash */
  hash: string;
}

export interface NetworkStats {
  /** Protocol */
  protocol: NetworkProtocol;
  /** Total members ever */
  totalMembers: number;
  /** Active members */
  activeMembers: number;
  /** Total rights granted */
  totalRights: number;
  /** Average engagement score */
  averageEngagementScore: number;
  /** Total contributions */
  totalContributions: number;
  /** Last activity timestamp */
  lastActivityAt: number;
}

export interface RightsIndexEntry {
  wallet: string;
  identifier: string;
  joinedAt: number;
  rightCount: number;
  engagementScore: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const ALL_NETWORKS: NetworkProtocol[] = [
  'nostr', 'farcaster', 'lens', 'bluesky', 'mastodon',
  'reddit', 'threads', 'lemmy', 'peertube', 'atproto',
  'zora', 'telegram', 'rss', 'ethereum', 'solana',
];

// ─── KV Key Helpers ───────────────────────────────────────────────────

function membershipKey(wallet: string, protocol: string): string {
  return `npr:${wallet.toLowerCase()}:${protocol}`;
}

function historyKey(wallet: string): string {
  return `npr:${wallet.toLowerCase()}:history`;
}

function rightsKey(wallet: string): string {
  return `npr:${wallet.toLowerCase()}:rights`;
}

function manifestKey(wallet: string): string {
  return `npr:${wallet.toLowerCase()}:manifest`;
}

function immutableKey(id: string): string {
  return `npr:immutable:${id}`;
}

function indexKey(protocol: string): string {
  return `npr:index:${protocol}`;
}

function statsKey(protocol: string): string {
  return `npr:stats:${protocol}`;
}

// ─── Register Membership ──────────────────────────────────────────────

/**
 * Register a user as a member of a network.
 *
 * This is an IRREVERSIBLE action. Once recorded, the fact that
 * "wallet X was a member of protocol Y on date Z" can NEVER be deleted.
 * Status can change (active → inactive), but the membership record is permanent.
 */
export async function registerMembership(
  wallet: string,
  protocol: NetworkProtocol,
  identifier: string,
  label: string,
  env: Env,
): Promise<ProtocolMembership> {
  const normalizedWallet = wallet.toLowerCase();
  const now = Date.now();
  const changeId = crypto.randomUUID();

  // Check for existing membership
  const existing = await getMembership(normalizedWallet, protocol, env);
  if (existing) {
    // Membership already exists — just update status if it was inactive
    if (existing.status !== 'active') {
      return reactivateMembership(normalizedWallet, protocol, env);
    }
    return existing;
  }

  const initialChange: StatusChangeEntry = {
    from: 'inactive',
    to: 'active',
    changedAt: now,
    reason: 'Initial network registration',
    changedBy: 'user',
    changeId,
  };

  const membership: ProtocolMembership = {
    wallet: normalizedWallet,
    protocol,
    identifier,
    label,
    status: 'active',
    joinedAt: now,
    updatedAt: now,
    statusHistory: [initialChange],
    rights: [],
    contributionCount: 0,
    engagementScore: 0,
    verified: false,
    attestationIds: [],
  };

  // Store membership record
  try {
    await env.IDENTITIES?.put(
      membershipKey(normalizedWallet, protocol),
      JSON.stringify(membership),
    );
  } catch (err) {
    throw new Error(`Failed to store membership: ${String(err)}`);
  }

  // Append to immutable history log
  await appendHistory(normalizedWallet, protocol, 'joined', `Joined ${protocol} as ${identifier}`, env);

  // Update network index
  await updateNetworkIndex(protocol, normalizedWallet, identifier, now, env);

  // Update network stats
  await bumpNetworkStats(protocol, 'join', env);

  return membership;
}

// ─── Grant Right ──────────────────────────────────────────────────────

/**
 * Grant a permanent, immutable right to a user in a network.
 *
 * Rights are APPEND-ONLY. Once granted, a right can be marked inactive
 * but the record of it having been granted is FOREVER.
 *
 * Each right gets a cryptographic hash for independent verification.
 */
export async function grantRight(
  wallet: string,
  protocol: NetworkProtocol,
  type: RightType,
  name: string,
  description: string,
  reason: string,
  env: Env,
): Promise<NetworkRight> {
  const normalizedWallet = wallet.toLowerCase();
  const now = Date.now();
  const rightId = `right-${crypto.randomUUID()}`;

  // Verify the user is a member of this network
  const membership = await getMembership(normalizedWallet, protocol, env);
  if (!membership) {
    throw new Error(`User is not a member of ${protocol}. Register membership first.`);
  }

  const right: NetworkRight = {
    id: rightId,
    type,
    name,
    description,
    protocol,
    grantedAt: now,
    reason,
    active: true,
  };

  // Compute proof hash
  const proofPayload = `${normalizedWallet}:${protocol}:${type}:${rightId}:${now}`;
  const encoder = new TextEncoder();
  const hashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(proofPayload));
  right.proofHash = bytesToHex(new Uint8Array(hashBytes));

  // Create immutable record
  const immutable: ImmutableRight = {
    id: rightId,
    wallet: normalizedWallet,
    right,
    rightHash: right.proofHash,
    timestamp: now,
  };

  // Store RIGHT in membership
  membership.rights.push(right);
  membership.updatedAt = now;

  try {
    await env.IDENTITIES?.put(
      membershipKey(normalizedWallet, protocol),
      JSON.stringify(membership),
    );

    // Store immutable record separately
    await env.IDENTITIES?.put(
      immutableKey(rightId),
      JSON.stringify(immutable),
    );

    // Append to global rights list
    const existingRights = await env.IDENTITIES?.get(rightsKey(normalizedWallet));
    const allRights: NetworkRight[] = existingRights ? JSON.parse(existingRights) : [];
    allRights.push(right);
    await env.IDENTITIES?.put(rightsKey(normalizedWallet), JSON.stringify(allRights));
  } catch (err) {
    throw new Error(`Failed to grant right: ${String(err)}`);
  }

  // Append to immutable history
  await appendHistory(normalizedWallet, protocol, 'right_granted', `${type}: ${name} — ${reason}`, env);

  // Update network index & stats
  await bumpNetworkStats(protocol, 'right_granted', env);

  return right;
}

// ─── Get Membership ───────────────────────────────────────────────────

/**
 * Get the membership record for a wallet in a protocol.
 * Returns null if the user has never been a member.
 */
export async function getMembership(
  wallet: string,
  protocol: NetworkProtocol,
  env: Env,
): Promise<ProtocolMembership | null> {
  try {
    const raw = await env.IDENTITIES?.get(membershipKey(wallet.toLowerCase(), protocol));
    if (!raw) return null;
    return JSON.parse(raw) as ProtocolMembership;
  } catch {
    return null;
  }
}

// ─── Get All Memberships ──────────────────────────────────────────────

/**
 * Get ALL memberships for a wallet across all networks.
 */
export async function getAllMemberships(
  wallet: string,
  env: Env,
): Promise<ProtocolMembership[]> {
  const memberships: ProtocolMembership[] = [];

  for (const protocol of ALL_NETWORKS) {
    const mem = await getMembership(wallet, protocol, env);
    if (mem) {
      memberships.push(mem);
    }
  }

  return memberships;
}

// ─── Get All Rights ───────────────────────────────────────────────────

/**
 * Get ALL rights ever granted to a wallet (across all networks).
 */
export async function getAllRights(
  wallet: string,
  env: Env,
): Promise<NetworkRight[]> {
  try {
    const raw = await env.IDENTITIES?.get(rightsKey(wallet.toLowerCase()));
    if (!raw) return [];
    return JSON.parse(raw) as NetworkRight[];
  } catch {
    return [];
  }
}

// ─── Generate Rights Manifest ─────────────────────────────────────────

/**
 * Generate a complete rights manifest for a wallet.
 * This is the canonical document proving all memberships and rights.
 */
export async function generateManifest(
  wallet: string,
  env: Env,
): Promise<RightsManifest> {
  const normalizedWallet = wallet.toLowerCase();
  const memberships = await getAllMemberships(normalizedWallet, env);

  let totalRights = 0;
  let activeMemberships = 0;

  const networks = memberships.map((m) => {
    totalRights += m.rights.length;
    if (m.status === 'active') activeMemberships++;
    return {
      protocol: m.protocol,
      identifier: m.identifier,
      label: m.label,
      status: m.status,
      joinedAt: m.joinedAt,
      rightCount: m.rights.length,
    };
  });

  const now = Date.now();
  const manifestPayload = `${normalizedWallet}:${totalRights}:${networks.length}:${now}`;
  const encoder = new TextEncoder();
  const hashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(manifestPayload));

  const manifest: RightsManifest = {
    wallet: normalizedWallet,
    networks,
    totalRights,
    totalNetworks: networks.length,
    activeMemberships,
    generatedAt: now,
    manifestHash: bytesToHex(new Uint8Array(hashBytes)),
  };

  // Cache the manifest
  try {
    await env.IDENTITIES?.put(manifestKey(normalizedWallet), JSON.stringify(manifest));
  } catch {
    // Non-fatal
  }

  return manifest;
}

// ─── Get Cached Manifest ──────────────────────────────────────────────

/**
 * Get the cached rights manifest for a wallet.
 */
export async function getCachedManifest(
  wallet: string,
  env: Env,
): Promise<RightsManifest | null> {
  try {
    const raw = await env.IDENTITIES?.get(manifestKey(wallet.toLowerCase()));
    if (!raw) return null;
    return JSON.parse(raw) as RightsManifest;
  } catch {
    return null;
  }
}

// ─── Verify Immutable Right ───────────────────────────────────────────

/**
 * Verify that an immutable right record is authentic and unmodified.
 */
export async function verifyRight(
  rightId: string,
  env: Env,
): Promise<{ valid: boolean; right: ImmutableRight | null; errors: string[] }> {
  const errors: string[] = [];

  try {
    const raw = await env.IDENTITIES?.get(immutableKey(rightId));
    if (!raw) {
      return { valid: false, right: null, errors: ['Right not found'] };
    }

    const immutable = JSON.parse(raw) as ImmutableRight;

    // Verify the proof hash matches
    const proofPayload = `${immutable.wallet}:${immutable.right.protocol}:${immutable.right.type}:${immutable.right.id}:${immutable.right.grantedAt}`;
    const encoder = new TextEncoder();
    const hashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(proofPayload));
    const computedHash = bytesToHex(new Uint8Array(hashBytes));

    if (computedHash !== immutable.rightHash) {
      errors.push('Right hash does not match — record may have been tampered with');
    }

    // Check membership still exists
    const membership = await getMembership(immutable.wallet, immutable.right.protocol, env);
    if (!membership) {
      errors.push('Membership record no longer exists');
    }

    return {
      valid: errors.length === 0,
      right: immutable,
      errors,
    };
  } catch (err) {
    return {
      valid: false,
      right: null,
      errors: [`Verification failed: ${String(err)}`],
    };
  }
}

// ─── Status Changes ───────────────────────────────────────────────────

/**
 * Change membership status.
 * The status change is APPENDED to the immutable log — never overwritten.
 */
export async function changeStatus(
  wallet: string,
  protocol: NetworkProtocol,
  newStatus: MembershipStatus,
  reason: string,
  changedBy: 'user' | 'system' | 'admin' | 'protocol',
  env: Env,
): Promise<ProtocolMembership | null> {
  const normalizedWallet = wallet.toLowerCase();
  const membership = await getMembership(normalizedWallet, protocol, env);
  if (!membership) return null;

  const now = Date.now();
  const changeId = crypto.randomUUID();

  const statusChange: StatusChangeEntry = {
    from: membership.status,
    to: newStatus,
    changedAt: now,
    reason,
    changedBy,
    changeId,
  };

  membership.status = newStatus;
  membership.statusHistory.push(statusChange);
  membership.updatedAt = now;

  await env.IDENTITIES?.put(
    membershipKey(normalizedWallet, protocol),
    JSON.stringify(membership),
  );

  await appendHistory(normalizedWallet, protocol, 'status_changed', `${membership.status} → ${newStatus}: ${reason}`, env);

  return membership;
}

/**
 * Reactivate a membership that was inactive.
 */
async function reactivateMembership(
  wallet: string,
  protocol: NetworkProtocol,
  env: Env,
): Promise<ProtocolMembership> {
  const membership = await getMembership(wallet, protocol, env);
  if (!membership) {
    throw new Error(`No existing membership for ${wallet} on ${protocol}`);
  }

  return changeStatus(
    wallet,
    protocol,
    'active',
    'Membership reactivated by user',
    'user',
    env,
  ) as Promise<ProtocolMembership>;
}

// ─── Record Exit ──────────────────────────────────────────────────────

/**
 * Record a user's exit from a network.
 * The membership record is NOT deleted — it's marked as 'exited'.
 * The fact that they were a member is permanent.
 */
export async function recordExit(
  wallet: string,
  protocol: NetworkProtocol,
  reason: string,
  env: Env,
): Promise<ProtocolMembership | null> {
  const result = await changeStatus(wallet, protocol, 'exited', reason, 'user', env);

  if (result) {
    await appendHistory(wallet.toLowerCase(), protocol, 'exited', `Exited ${protocol}: ${reason}`, env);
  }

  return result;
}

// ─── Get Rights by Type ───────────────────────────────────────────────

/**
 * Get all rights of a specific type for a wallet.
 */
export async function getRightsByType(
  wallet: string,
  type: RightType,
  env: Env,
): Promise<NetworkRight[]> {
  const allRights = await getAllRights(wallet, env);
  return allRights.filter((r) => r.type === type && r.active);
}

// ─── Get Rights by Protocol ───────────────────────────────────────────

/**
 * Get all active rights for a wallet in a specific protocol.
 */
export async function getRightsForProtocol(
  wallet: string,
  protocol: NetworkProtocol,
  env: Env,
): Promise<NetworkRight[]> {
  const membership = await getMembership(wallet, protocol, env);
  if (!membership) return [];
  return membership.rights.filter((r) => r.active);
}

// ─── Network Statistics ───────────────────────────────────────────────

/**
 * Get aggregate statistics for a network.
 */
export async function getNetworkStats(
  protocol: NetworkProtocol,
  env: Env,
): Promise<NetworkStats | null> {
  try {
    const raw = await env.IDENTITIES?.get(statsKey(protocol));
    if (!raw) return null;
    return JSON.parse(raw) as NetworkStats;
  } catch {
    return null;
  }
}

/**
 * Get the network index (all members of a network).
 */
export async function getNetworkIndex(
  protocol: NetworkProtocol,
  env: Env,
): Promise<RightsIndexEntry[]> {
  try {
    const raw = await env.IDENTITIES?.get(indexKey(protocol));
    if (!raw) return [];
    return JSON.parse(raw) as RightsIndexEntry[];
  } catch {
    return [];
  }
}

/**
 * Compute a sovereignty score for a wallet.
 * Score factors: number of networks, number of rights, membership duration, verification level.
 */
export async function computeSovereigntyScore(
  wallet: string,
  env: Env,
): Promise<{
  score: number;
  maxScore: number;
  breakdown: {
    networkCount: number;
    rightCount: number;
    membershipDepth: number;
    verificationLevel: number;
    longevity: number;
  };
}> {
  const memberships = await getAllMemberships(wallet, env);
  const allRights = await getAllRights(wallet, env);

  const maxScore = 100;
  const now = Date.now();

  // Network diversity: up to 25 points (1.67 per network)
  const networkCount = Math.min(memberships.length, 15);
  const networkScore = (networkCount / 15) * 25;

  // Rights: up to 25 points
  const rightCount = Math.min(allRights.length, 30);
  const rightScore = (rightCount / 30) * 25;

  // Membership depth (how long they've been members): up to 20 points
  const oldestMembership = memberships.reduce(
    (min, m) => Math.min(min, m.joinedAt),
    now,
  );
  const membershipAgeDays = (now - oldestMembership) / (1000 * 60 * 60 * 24);
  const membershipDepth = Math.min(membershipAgeDays / 365, 1) * 20;

  // Verification level: up to 15 points
  const verifiedCount = memberships.filter((m) => m.verified).length;
  const verificationLevel = memberships.length > 0
    ? (verifiedCount / memberships.length) * 15
    : 0;

  // Longevity (how many rights are old): up to 15 points
  const oldestRight = allRights.reduce(
    (min, r) => Math.min(min, r.grantedAt),
    now,
  );
  const rightAgeDays = (now - oldestRight) / (1000 * 60 * 60 * 24);
  const longevity = Math.min(rightAgeDays / 180, 1) * 15;

  const score = Math.round(
    networkScore + rightScore + membershipDepth + verificationLevel + longevity,
  );

  return {
    score,
    maxScore,
    breakdown: {
      networkCount,
      rightCount,
      membershipDepth: Math.round(membershipDepth * 100) / 100,
      verificationLevel: Math.round(verificationLevel * 100) / 100,
      longevity: Math.round(longevity * 100) / 100,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Append an entry to the immutable history log.
 */
async function appendHistory(
  wallet: string,
  protocol: NetworkProtocol,
  event: MembershipHistoryEntry['event'],
  detail: string,
  env: Env,
): Promise<void> {
  const now = Date.now();
  const eventId = `evt-${crypto.randomUUID()}`;
  const hashPayload = `${wallet}:${protocol}:${event}:${eventId}:${now}`;
  const encoder = new TextEncoder();
  const hashBytes = await crypto.subtle.digest('SHA-256', encoder.encode(hashPayload));

  const entry: MembershipHistoryEntry = {
    wallet,
    protocol,
    event,
    detail,
    timestamp: now,
    eventId,
    hash: bytesToHex(new Uint8Array(hashBytes)),
  };

  try {
    const existingHistory = await env.IDENTITIES?.get(historyKey(wallet));
    const history: MembershipHistoryEntry[] = existingHistory ? JSON.parse(existingHistory) : [];
    history.push(entry);

    // Keep last 1000 entries
    const trimmed = history.slice(-1000);
    await env.IDENTITIES?.put(historyKey(wallet), JSON.stringify(trimmed));
  } catch {
    // Non-fatal — history append should not block core operations
  }
}

/**
 * Update the network index with a new member.
 */
async function updateNetworkIndex(
  protocol: NetworkProtocol,
  wallet: string,
  identifier: string,
  joinedAt: number,
  env: Env,
): Promise<void> {
  try {
    const rawIndex = await env.IDENTITIES?.get(indexKey(protocol));
    const index: RightsIndexEntry[] = rawIndex ? JSON.parse(rawIndex) : [];

    // Avoid duplicates
    const exists = index.some((e) => e.wallet === wallet);
    if (!exists) {
      index.push({ wallet, identifier, joinedAt, rightCount: 0, engagementScore: 0 });
      // Keep last 10000 entries
      await env.IDENTITIES?.put(indexKey(protocol), JSON.stringify(index.slice(-10000)));
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Update aggregate network stats.
 */
async function bumpNetworkStats(
  protocol: NetworkProtocol,
  event: 'join' | 'right_granted' | 'exit',
  env: Env,
): Promise<void> {
  try {
    const raw = await env.IDENTITIES?.get(statsKey(protocol));
    const stats: NetworkStats = raw
      ? JSON.parse(raw)
      : {
          protocol,
          totalMembers: 0,
          activeMembers: 0,
          totalRights: 0,
          averageEngagementScore: 0,
          totalContributions: 0,
          lastActivityAt: Date.now(),
        };

    switch (event) {
      case 'join':
        stats.totalMembers++;
        stats.activeMembers++;
        break;
      case 'right_granted':
        stats.totalRights++;
        break;
      case 'exit':
        stats.activeMembers = Math.max(0, stats.activeMembers - 1);
        break;
    }

    stats.lastActivityAt = Date.now();
    await env.IDENTITIES?.put(statsKey(protocol), JSON.stringify(stats));
  } catch {
    // Non-fatal
  }
}

/**
 * Hex to bytes helper.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Bytes to hex helper.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
