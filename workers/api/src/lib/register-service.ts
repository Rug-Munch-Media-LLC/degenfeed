/**
 * @degenfeed/api-worker — Concierge Registration Service
 *
 * Shared business logic for the register-all system:
 *   - Pricing & charge calculations per plan
 *   - Recovery package generation
 *   - Store results in IDENTITIES KV
 *   - RSS feed URL generation
 *   - ENS placeholder (records intent)
 *
 * Plans:
 *   free      — GtS + ATProto + Nostr + RSS only (self-serve Farcaster/Lens via redirect)
 *   standard  — Farcaster ($5 gas) + Lens ($2 gas) + $3 service — user pays $10 total
 *   complete  — standard + custom Lens handle (up to 8 chars, $10 gas) + ENS ($10) — user pays $20 (bundle saves $7)
 *   premium   — everything covered by $10/mo subscription
 */

import { identityKey } from '@degenfeed/utils';
import type { CrossProtocolIdentity } from '@degenfeed/utils';
import type { Env } from '../index';
import { log } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export interface RegistrationPlan {
  id: 'free' | 'standard' | 'complete';
  label: string;
  oneTimePriceUsd: number;
  description: string;
}

export const REGISTRATION_PLANS: RegistrationPlan[] = [
  { id: 'free', label: 'Free', oneTimePriceUsd: 0, description: 'GtS + Bluesky PDS + Nostr + RSS' },
  {
    id: 'standard',
    label: 'Standard',
    oneTimePriceUsd: 8,
    description: 'Everything + Farcaster + Lens',
  },
  {
    id: 'complete',
    label: 'Complete',
    oneTimePriceUsd: 15,
    description: 'Standard + custom Lens handle + ENS domain',
  },
];

export interface ChargeBreakdown {
  total: string;
  totalCents: number;
  breakdown: { item: string; cost: string; covered: boolean }[];
  serviceFeeCents: number;
}

export interface AccountResult {
  ok: boolean;
  identifier?: string;
  handle?: string;
  username?: string;
  error?: string;
  redirectUrl?: string;
  recoveryMethod?: string;
}

export interface RegistrationResults {
  activitypub: AccountResult;
  atproto: AccountResult;
  nostr: AccountResult;
  rss: AccountResult;
  farcaster: AccountResult;
  lens: AccountResult;
  ens?: AccountResult;
}

export interface RecoveryPackage {
  message: string;
  accounts: {
    protocol: string;
    identifier?: string;
    recoveryMethod: string;
  }[];
  exportDate: string;
  dataExportUrl: string;
}

// ─── Plan helpers ─────────────────────────────────────────────────────────

export function isPlanPaid(plan: string): boolean {
  return plan === 'standard' || plan === 'complete';
}

export function shouldRegisterFarcaster(plan: string, isPremium: boolean): boolean {
  return isPremium || plan === 'standard' || plan === 'complete';
}

export function shouldRegisterLens(plan: string, isPremium: boolean): boolean {
  return isPremium || plan === 'standard' || plan === 'complete';
}

// ─── Pricing ──────────────────────────────────────────────────────────────

/**
 * Calculate charges for a given plan and premium status.
 * Returns a transparent breakdown shown to the user before they confirm.
 */
export function calculateCharges(
  plan: string,
  isPremium: boolean,
): ChargeBreakdown {
  if (isPremium) {
    return {
      total: '$0 (covered by Premium subscription)',
      totalCents: 0,
      breakdown: [
        { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: true },
        { item: 'Lens Profile ($2 gas)', cost: '$2', covered: true },
        { item: 'GoToSocial account', cost: '$0', covered: true },
        { item: 'AT Protocol PDS', cost: '$0', covered: true },
        { item: 'Nostr keypair', cost: '$0', covered: true },
        { item: 'RSS feed', cost: '$0', covered: true },
      ],
      serviceFeeCents: 0,
    };
  }

  switch (plan) {
    case 'standard':
      return {
        total: '$10',
        totalCents: 800,
        breakdown: [
          { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: false },
          { item: 'Lens Profile ($2 gas)', cost: '$2', covered: false },
          { item: 'Service fee', cost: '$1', covered: false },
          { item: 'GoToSocial + PDS + Nostr + RSS', cost: '$0', covered: true },
        ],
        serviceFeeCents: 100,
      };
    case 'complete':
      return {
        total: '$20',
        totalCents: 1500,
        breakdown: [
          { item: 'Farcaster ID ($5 gas)', cost: '$5', covered: false },
          { item: 'Lens + custom handle ($10 gas)', cost: '$10', covered: false },
          { item: 'ENS domain ($10)', cost: '$10', covered: false },
          { item: 'Bundle discount', cost: '-$10', covered: false },
          { item: 'GoToSocial + PDS + Nostr + RSS', cost: '$0', covered: true },
        ],
        serviceFeeCents: 100,
      };
    case 'free':
    default:
      return {
        total: '$0',
        totalCents: 0,
        breakdown: [
          { item: 'GoToSocial account', cost: '$0', covered: true },
          { item: 'AT Protocol PDS', cost: '$0', covered: true },
          { item: 'Nostr keypair', cost: '$0', covered: true },
          { item: 'RSS feed', cost: '$0', covered: true },
        ],
        serviceFeeCents: 0,
      };
  }
}

// ─── RSS ──────────────────────────────────────────────────────────────────

export function generateRssFeedUrl(walletAddress: string): string {
  return `https://app.degenfeed.xyz/feed/${walletAddress.toLowerCase()}`;
}

export function createRssFeed(walletAddress: string): AccountResult {
  const feedUrl = generateRssFeedUrl(walletAddress);
  return {
    ok: true,
    identifier: feedUrl,
  };
}

// ─── ENS placeholder ──────────────────────────────────────────────────────

export function recordEnsIntent(ensName: string): AccountResult {
  return {
    ok: true,
    identifier: `${ensName}.eth`,
    handle: ensName,
  };
}

// ─── KV persistence ───────────────────────────────────────────────────────

/**
 * Store all registration results in the IDENTITIES KV.
 * Merges with any existing identity record for the wallet.
 */
export async function storeAllIdentities(
  env: Env,
  walletAddress: string,
  results: RegistrationResults,
): Promise<void> {
  if (!env.IDENTITIES) {
    log('warn', 'IDENTITIES KV not bound — skipping identity storage');
    return;
  }

  const key = identityKey(walletAddress);
  let existing: CrossProtocolIdentity | null = null;
  try {
    const raw = await env.IDENTITIES.get(key);
    if (raw) existing = JSON.parse(raw) as CrossProtocolIdentity;
  } catch {
    // No existing record — create fresh
  }

  const now = Date.now();
  const updated: CrossProtocolIdentity = {
    ...(existing || { walletAddress, linkedAt: now, lastVerified: now }),
    lastVerified: now,
  } as CrossProtocolIdentity;

  // Use unknown intermediate to set dynamic properties
  const updatable = updated as unknown as Record<string, unknown>;

  // ActivityPub (GoToSocial / Mastodon)
  if (results.activitypub?.ok && results.activitypub.identifier) {
    updatable['mastodon'] = {
      handle: results.activitypub.identifier,
      instance: 'social.degenfeed.xyz',
      verified: true,
      autoCreated: true,
    };
  }

  // AT Protocol (Bluesky PDS)
  if (results.atproto?.ok && results.atproto.identifier) {
    updatable['atproto'] = {
      did: results.atproto.identifier,
      handle: results.atproto.handle || '',
      pdsUrl: 'https://pds.degenfeed.xyz',
      verified: true,
      autoCreated: true,
    };
  }

  // Nostr
  if (results.nostr?.ok && results.nostr.identifier) {
    updatable['nostr'] = {
      npub: results.nostr.identifier,
      relays: [],
      verified: true,
      autoCreated: true,
    };
  }

  // RSS
  if (results.rss?.ok && results.rss.identifier) {
    updatable['rss'] = {
      url: results.rss.identifier,
      verified: true,
      autoCreated: true,
    };
  }

  // Farcaster
  if (results.farcaster?.ok && results.farcaster.identifier) {
    updatable['farcaster'] = {
      fid: Number(results.farcaster.identifier.replace('fid:', '')),
      username: results.farcaster.username || results.farcaster.handle || '',
      custodyAddress: walletAddress,
      verified: true,
    };
  }

  // Lens
  if (results.lens?.ok && results.lens.identifier) {
    updatable['lens'] = {
      profileId: results.lens.identifier,
      handle: results.lens.handle || '',
      verified: true,
    };
  }

  try {
    await env.IDENTITIES.put(key, JSON.stringify(updated));
    log('info', 'Registration identities stored', {
      wallet: walletAddress.slice(0, 8),
      protocols: Object.keys(results).filter((k) => results[k as keyof RegistrationResults]?.ok),
    });
  } catch (err) {
    log('error', 'Failed to store registration identities', {
      wallet: walletAddress.slice(0, 8),
      error: String(err),
    });
    throw new Error('Failed to store registration identities');
  }
}

// ─── Recovery package ─────────────────────────────────────────────────────

/**
 * Generate a human-readable recovery package.
 * Each account shows how to recover it — these are shown to the user
 * once, on the success screen, and can be re-requested from /api/register/export.
 */
export function generateRecoveryPackage(results: RegistrationResults): RecoveryPackage {
  const accounts: RecoveryPackage['accounts'] = [];

  if (results.activitypub?.ok) {
    accounts.push({
      protocol: 'GoToSocial (Fediverse)',
      identifier: results.activitypub.handle || results.activitypub.identifier,
      recoveryMethod: 'Password + OAuth token (saved to your account)',
    });
  }

  if (results.atproto?.ok) {
    accounts.push({
      protocol: 'AT Protocol (Bluesky)',
      identifier: results.atproto.handle || results.atproto.identifier,
      recoveryMethod: 'Password + recovery key (save this)',
    });
  }

  if (results.nostr?.ok) {
    accounts.push({
      protocol: 'Nostr',
      identifier: results.nostr.identifier,
      recoveryMethod: 'Private key (nsec) — SAVE THIS. We cannot recover it.',
    });
  }

  if (results.farcaster?.ok) {
    accounts.push({
      protocol: 'Farcaster',
      identifier: results.farcaster.username
        ? `@${results.farcaster.username}`
        : results.farcaster.identifier,
      recoveryMethod: 'Recovery address = your wallet. You control this.',
    });
  }

  if (results.lens?.ok) {
    accounts.push({
      protocol: 'Lens Protocol',
      identifier: results.lens.handle
        ? `@${results.lens.handle}`
        : results.lens.identifier,
      recoveryMethod: 'Profile NFT in your wallet. You own it.',
    });
  }

  if (results.rss?.ok) {
    accounts.push({
      protocol: 'RSS Feed',
      identifier: results.rss.identifier,
      recoveryMethod: 'Public URL — no recovery needed',
    });
  }

  if (results.ens?.ok) {
    accounts.push({
      protocol: 'ENS',
      identifier: results.ens.identifier,
      recoveryMethod: 'Registration pending — confirm in wallet',
    });
  }

  return {
    message:
      'Save these recovery details. You own these accounts — we cannot recover them for you.',
    accounts,
    exportDate: new Date().toISOString(),
    dataExportUrl: '/api/account/export',
  };
}

// ─── Wallet-based username derivation ─────────────────────────────────────

export function deriveUsername(walletAddress: string): string {
  return walletAddress.slice(2, 12).toLowerCase();
}

export function derivePdsHandle(walletAddress: string): string {
  const short = deriveUsername(walletAddress);
  return `${short}.pds.degenfeed.xyz`;
}

export function deriveGtsHandle(walletAddress: string): string {
  return deriveUsername(walletAddress);
}
