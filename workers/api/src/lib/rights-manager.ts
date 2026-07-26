/**
 * @degenfeed/api-worker — Rights Management & Licensing
 *
 * Manages content rights, licensing, usage tracking, monetization rights,
 * and platform permissions. Every piece of content in the library has a
 * license and rights configuration that governs how it can be used,
 * reposted, and monetized.
 *
 * KV key scheme:
 *   rights:license:{contentId}       → LicenseRecord
 *   rights:usage:{contentId}         → UsageRecord[] (who reposted, attribution)
 *   rights:monetization:{contentId}  → MonetizationConfig
 *   rights:permissions:{wallet}      → DefaultPlatformPermissions
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LicenseType = 'all-rights' | 'cc-by' | 'cc-by-sa' | 'cc-by-nc' | 'cc0' | 'custom';

export interface LicenseRecord {
  contentId: string;
  creatorWallet: string;
  license: LicenseType;
  /** Full text for 'custom' licenses */
  customText?: string;
  /** Whether attribution is required */
  requireAttribution: boolean;
  /** Whether commercial use is allowed */
  allowCommercialUse: boolean;
  /** Whether modifications/derivatives are allowed */
  allowDerivatives: boolean;
  /** Share-alike: derivatives must use same license */
  shareAlike: boolean;
  /** Additional terms as human-readable text */
  additionalTerms?: string;
  /** Legal jurisdiction (e.g., "US", "EU", "International") */
  jurisdiction?: string;
  createdAt: number;
  updatedAt: number;
}

export type UsageAction = 'repost' | 'embed' | 'quote' | 'derivative' | 'crosspost';

export interface UsageRecord {
  /** Unique usage event ID */
  id: string;
  /** The content that was reposted/used */
  contentId: string;
  /** Who used the content (wallet or protocol handle) */
  usedBy: string;
  /** What they did */
  action: UsageAction;
  /** Where they did it (protocol or platform) */
  protocol: string;
  /** Link to the usage (post URL, embed URL, etc.) */
  url: string;
  /** Whether proper attribution was given */
  attributionGiven: boolean;
  /** Timestamp of usage */
  usedAt: number;
  /** Verified by DegenFeed crawler */
  verified: boolean;
}

export type MonetizationType = 'token-gate' | 'pay-per-view' | 'free-with-tipping';

export interface MonetizationConfig {
  contentId: string;
  creatorWallet: string;
  type: MonetizationType;
  enabled: boolean;
  /** Token gate: require holding X tokens */
  tokenAddress?: string;
  tokenChain?: string;
  minTokens?: string;
  /** Pay-per-view: price to access */
  price?: string;
  priceToken?: string; // e.g., "USDC", "ETH", "SOL"
  /** Free with tipping: suggested tip amounts */
  suggestedTips?: string[];
  /** Revenue split with platform (basis points, e.g., 500 = 5%) */
  platformFeeBps?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlatformPermissions {
  wallet: string;
  /** Default allowed protocols for this creator's content */
  defaultAllowedProtocols: string[];
  /** Whether content can be cross-posted by other users */
  defaultCanBeCrossPosted: boolean;
  /** Whether attribution is required by default */
  defaultRequireAttribution: boolean;
  /** Per-content overrides (contentId → partial permissions) */
  contentOverrides: Record<
    string,
    {
      allowedProtocols?: string[];
      canBeCrossPosted?: boolean;
      requireAttribution?: boolean;
    }
  >;
  updatedAt: number;
}

// ─── KV Key Helpers ─────────────────────────────────────────────────────────

// biome-ignore lint/style/noNonNullAssertion: KV namespace is always bound in production via wrangler.toml
function kv(env: Env): KVNamespace {
  return env.CONTENT_LIBRARY || env.CACHE!;
}

function licenseKey(contentId: string): string {
  return `rights:license:${contentId}`;
}

function usageKey(contentId: string): string {
  return `rights:usage:${contentId}`;
}

function usageIndexKey(contentId: string): string {
  return `rights:usage:idx:${contentId}`;
}

function monetizationKey(contentId: string): string {
  return `rights:monetization:${contentId}`;
}

function permissionsKey(wallet: string): string {
  return `rights:permissions:${wallet.toLowerCase()}`;
}

// ─── License Operations ─────────────────────────────────────────────────────

/**
 * The Creative Commons and license metadata for reference.
 */
export const LICENSE_METADATA: Record<
  LicenseType,
  {
    label: string;
    description: string;
    url: string;
    requireAttribution: boolean;
    allowCommercialUse: boolean;
    allowDerivatives: boolean;
    shareAlike: boolean;
  }
> = {
  'all-rights': {
    label: 'All Rights Reserved',
    description: 'Full copyright — no use without explicit permission',
    url: 'https://en.wikipedia.org/wiki/All_rights_reserved',
    requireAttribution: true,
    allowCommercialUse: false,
    allowDerivatives: false,
    shareAlike: false,
  },
  'cc-by': {
    label: 'Creative Commons Attribution (CC-BY)',
    description: 'Free to share and adapt with attribution',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    requireAttribution: true,
    allowCommercialUse: true,
    allowDerivatives: true,
    shareAlike: false,
  },
  'cc-by-sa': {
    label: 'Creative Commons Attribution-ShareAlike (CC-BY-SA)',
    description: 'Free to share and adapt with attribution — derivatives must use same license',
    url: 'https://creativecommons.org/licenses/by-sa/4.0/',
    requireAttribution: true,
    allowCommercialUse: true,
    allowDerivatives: true,
    shareAlike: true,
  },
  'cc-by-nc': {
    label: 'Creative Commons Attribution-NonCommercial (CC-BY-NC)',
    description: 'Free to share and adapt with attribution — non-commercial only',
    url: 'https://creativecommons.org/licenses/by-nc/4.0/',
    requireAttribution: true,
    allowCommercialUse: false,
    allowDerivatives: true,
    shareAlike: false,
  },
  cc0: {
    label: 'Creative Commons Zero (CC0)',
    description: 'Public domain — no rights reserved',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    requireAttribution: false,
    allowCommercialUse: true,
    allowDerivatives: true,
    shareAlike: false,
  },
  custom: {
    label: 'Custom License',
    description: 'Custom terms defined by the creator',
    url: '',
    requireAttribution: true,
    allowCommercialUse: false,
    allowDerivatives: false,
    shareAlike: false,
  },
};

/**
 * Set the license for a piece of content.
 * Validates the license type and fills in default attributes from the metadata.
 */
export async function setLicense(
  env: Env,
  wallet: string,
  contentId: string,
  license: LicenseType,
  options?: {
    customText?: string;
    additionalTerms?: string;
    jurisdiction?: string;
  },
): Promise<LicenseRecord> {
  const meta = LICENSE_METADATA[license];
  const record: LicenseRecord = {
    contentId,
    creatorWallet: wallet.toLowerCase(),
    license,
    customText: options?.customText,
    requireAttribution: meta.requireAttribution,
    allowCommercialUse: meta.allowCommercialUse,
    allowDerivatives: meta.allowDerivatives,
    shareAlike: meta.shareAlike,
    additionalTerms: options?.additionalTerms,
    jurisdiction: options?.jurisdiction,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const store = kv(env);
  await store.put(licenseKey(contentId), JSON.stringify(record));
  return record;
}

/**
 * Get the license for a piece of content.
 */
export async function getLicense(env: Env, contentId: string): Promise<LicenseRecord | null> {
  const store = kv(env);
  try {
    const raw = await store.get(licenseKey(contentId));
    return raw ? (JSON.parse(raw) as LicenseRecord) : null;
  } catch {
    return null;
  }
}

/**
 * Update the license for a piece of content.
 */
export async function updateLicense(
  env: Env,
  _wallet: string,
  contentId: string,
  updates: Partial<LicenseRecord>,
): Promise<LicenseRecord | null> {
  const existing = await getLicense(env, contentId);
  if (!existing) return null;

  // If license type changed, re-derive defaults
  if (updates.license && updates.license !== existing.license) {
    const meta = LICENSE_METADATA[updates.license];
    Object.assign(updates, {
      requireAttribution: meta.requireAttribution,
      allowCommercialUse: meta.allowCommercialUse,
      allowDerivatives: meta.allowDerivatives,
      shareAlike: meta.shareAlike,
    });
  }

  const updated: LicenseRecord = {
    ...existing,
    ...updates,
    contentId: existing.contentId,
    creatorWallet: existing.creatorWallet,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  const store = kv(env);
  await store.put(licenseKey(contentId), JSON.stringify(updated));
  return updated;
}

// ─── Usage Tracking ─────────────────────────────────────────────────────────

/**
 * Record a usage event (repost, embed, quote, derivative, crosspost).
 */
export async function recordUsage(
  env: Env,
  contentId: string,
  usedBy: string,
  action: UsageAction,
  protocol: string,
  url: string,
  attributionGiven: boolean,
): Promise<UsageRecord> {
  const store = kv(env);
  const id = `usage-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const record: UsageRecord = {
    id,
    contentId,
    usedBy,
    action,
    protocol,
    url,
    attributionGiven,
    usedAt: Date.now(),
    verified: false,
  };

  // Append to usage list
  const key = usageKey(contentId);
  const raw = await store.get(key);
  const usageList: UsageRecord[] = raw ? JSON.parse(raw) : [];
  usageList.push(record);

  // Keep last 500 usage events
  const trimmed = usageList.slice(-500);
  await store.put(key, JSON.stringify(trimmed));

  // Update index
  const idxKey = usageIndexKey(contentId);
  const idxRaw = await store.get(idxKey);
  const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
  idx.push(id);
  await store.put(idxKey, JSON.stringify(idx.slice(-500)));

  return record;
}

/**
 * Get usage history for a piece of content.
 */
export async function getUsage(env: Env, contentId: string, limit = 50): Promise<UsageRecord[]> {
  const store = kv(env);
  try {
    const raw = await store.get(usageKey(contentId));
    if (!raw) return [];
    const usage: UsageRecord[] = JSON.parse(raw);
    return usage.slice(-limit).reverse();
  } catch {
    return [];
  }
}

/**
 * Verify a usage event (mark as verified by crawler).
 */
export async function verifyUsage(env: Env, contentId: string, usageId: string): Promise<boolean> {
  const store = kv(env);
  try {
    const raw = await store.get(usageKey(contentId));
    if (!raw) return false;
    const usage: UsageRecord[] = JSON.parse(raw);
    const found = usage.find((u) => u.id === usageId);
    if (found) {
      found.verified = true;
      await store.put(usageKey(contentId), JSON.stringify(usage));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Monetization ───────────────────────────────────────────────────────────

/**
 * Set monetization configuration for a piece of content.
 */
export async function setMonetization(
  env: Env,
  wallet: string,
  contentId: string,
  config: Omit<MonetizationConfig, 'contentId' | 'creatorWallet' | 'createdAt' | 'updatedAt'>,
): Promise<MonetizationConfig> {
  const store = kv(env);
  const record: MonetizationConfig = {
    contentId,
    creatorWallet: wallet.toLowerCase(),
    ...config,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await store.put(monetizationKey(contentId), JSON.stringify(record));
  return record;
}

/**
 * Get monetization configuration for a piece of content.
 */
export async function getMonetization(
  env: Env,
  contentId: string,
): Promise<MonetizationConfig | null> {
  const store = kv(env);
  try {
    const raw = await store.get(monetizationKey(contentId));
    return raw ? (JSON.parse(raw) as MonetizationConfig) : null;
  } catch {
    return null;
  }
}

/**
 * Update monetization configuration.
 */
export async function updateMonetization(
  env: Env,
  _wallet: string,
  contentId: string,
  updates: Partial<MonetizationConfig>,
): Promise<MonetizationConfig | null> {
  const existing = await getMonetization(env, contentId);
  if (!existing) return null;

  const updated: MonetizationConfig = {
    ...existing,
    ...updates,
    contentId: existing.contentId,
    creatorWallet: existing.creatorWallet,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
  };

  const store = kv(env);
  await store.put(monetizationKey(contentId), JSON.stringify(updated));
  return updated;
}

// ─── Platform Permissions ───────────────────────────────────────────────────

/**
 * Set default platform permissions for a creator wallet.
 */
export async function setPlatformPermissions(
  env: Env,
  wallet: string,
  permissions: Omit<PlatformPermissions, 'wallet' | 'updatedAt' | 'contentOverrides'>,
): Promise<PlatformPermissions> {
  const store = kv(env);
  const record: PlatformPermissions = {
    wallet: wallet.toLowerCase(),
    ...permissions,
    contentOverrides: {},
    updatedAt: Date.now(),
  };

  await store.put(permissionsKey(wallet), JSON.stringify(record));
  return record;
}

/**
 * Get platform permissions for a creator wallet.
 */
export async function getPlatformPermissions(
  env: Env,
  wallet: string,
): Promise<PlatformPermissions | null> {
  const store = kv(env);
  try {
    const raw = await store.get(permissionsKey(wallet));
    return raw ? (JSON.parse(raw) as PlatformPermissions) : null;
  } catch {
    return null;
  }
}

/**
 * Set a content-level override for platform permissions.
 */
export async function setContentPermissionOverride(
  env: Env,
  wallet: string,
  contentId: string,
  override: {
    allowedProtocols?: string[];
    canBeCrossPosted?: boolean;
    requireAttribution?: boolean;
  },
): Promise<PlatformPermissions | null> {
  const permissions = await getPlatformPermissions(env, wallet);
  if (!permissions) return null;

  permissions.contentOverrides[contentId] = override;
  permissions.updatedAt = Date.now();

  const store = kv(env);
  await store.put(permissionsKey(wallet), JSON.stringify(permissions));
  return permissions;
}

/**
 * Check if content with a given license can be used in a certain way.
 * Returns { allowed: boolean, reason?: string }.
 */
export function checkUsageRights(
  licenseRecord: LicenseRecord,
  action: 'repost' | 'modify' | 'commercial' | 'crosspost',
): { allowed: boolean; reason?: string } {
  switch (action) {
    case 'repost':
      // Reposting (sharing as-is) is allowed for all except all-rights without permission
      if (licenseRecord.license === 'all-rights') {
        return { allowed: false, reason: 'All Rights Reserved — explicit permission required' };
      }
      return { allowed: true };

    case 'modify':
      if (!licenseRecord.allowDerivatives) {
        return { allowed: false, reason: 'License does not allow modifications/derivatives' };
      }
      return { allowed: true };

    case 'commercial':
      if (!licenseRecord.allowCommercialUse) {
        return { allowed: false, reason: 'License does not allow commercial use' };
      }
      return { allowed: true };

    case 'crosspost':
      // Crossposting requires attribution for most licenses
      if (licenseRecord.requireAttribution) {
        return { allowed: true, reason: 'Attribution required' };
      }
      return { allowed: true };

    default:
      return { allowed: false, reason: 'Unknown action' };
  }
}

/**
 * Build a human-readable attribution string.
 */
export function buildAttribution(
  creatorName: string,
  contentTitle: string,
  licenseUrl: string,
  contentUrl: string,
): string {
  return `"${contentTitle}" by ${creatorName} is licensed under ${licenseUrl}. View original: ${contentUrl}`;
}
