/**
 * @degenfeed/api-worker — Join All Networks
 *
 * One-click account creation on ALL self-hosted protocols.
 * Users sign up once on DegenFeed and get accounts everywhere.
 *
 * Routes:
 *   POST /api/accounts/join-all     — One-click: create accounts on ALL networks
 *   GET  /api/accounts/join-all/status — Check which networks are joined
 *   POST /api/accounts/join-all/retry  — Retry failed network registrations
 *
 * Protocols provisioned:
 *   Bluesky (PDS), Mastodon (GTS), Farcaster (Hubble), Lens, PeerTube,
 *   Lemmy, Pixelfed, WriteFreely, BookWyrm, Mobilizon, Owncast,
 *   Funkwhale, Castopod, Nostr
 *
 * Every account is auto-linked to the user's DegenFeed wallet.
 * One SSO session spans all networks.
 */

import { registerOnPlatform } from '@degenfeed/crossplatform-register';
import { identityKey } from '@degenfeed/utils';
import { log } from '../index';
import { sealForWallet } from '../lib/crypto-seal';
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── All protocols in registration order ─────────────────────────────────

const ALL_PROTOCOLS = [
  'mastodon', // GoToSocial — ActivityPub social
  'bluesky', // AT Protocol PDS
  'nostr', // Nostr relay
  'lemmy', // Lemmy — federated communities
  'peertube', // PeerTube — federated video
  'pixelfed', // Pixelfed — federated images
  'writefreely', // WriteFreely — federated blogging
  'bookwyrm', // BookWyrm — federated book reviews
  'funkwhale', // Funkwhale — federated music
  'mobilizon', // Mobilizon — federated events
  'owncast', // Owncast — live streaming
  'castopod', // Castopod — federated podcasts
  'farcaster', // Farcaster — on-chain social (Premium)
  'lens', // Lens — on-chain social (Premium)
] as const;

const PREMIUM_PROTOCOLS = new Set(['farcaster', 'lens']);

const PROTOCOL_INSTANCES: Record<string, string> = {
  mastodon: 'https://social.degenfeed.xyz',
  bluesky: 'https://pds.degenfeed.xyz',
  lemmy: 'https://community.degenfeed.xyz',
  peertube: 'https://video.degenfeed.xyz',
  pixelfed: 'https://pixelfed.social',
  writefreely: 'https://blog.degenfeed.xyz',
  bookwyrm: 'https://books.degenfeed.xyz',
  funkwhale: 'https://music.degenfeed.xyz',
  mobilizon: 'https://events.degenfeed.xyz',
  owncast: 'https://live.degenfeed.xyz',
  castopod: 'https://podcasts.degenfeed.xyz',
};

// ─── Types ────────────────────────────────────────────────────────────────

interface JoinAllResult {
  protocol: string;
  ok: boolean;
  status: 'created' | 'pending' | 'failed' | 'skipped';
  username?: string;
  identifier?: string;
  error?: string;
  profileUrl?: string;
}

interface JoinAllResponse {
  success: boolean;
  wallet: string;
  results: JoinAllResult[];
  connectedCount: number;
  totalProtocols: number;
  failedCount: number;
  ssoSessionToken?: string;
  recoveryInfo?: {
    warning: string;
    action: string;
  };
}

// ─── POST /api/accounts/join-all — One-Click, All Networks ──────────────

export async function handleJoinAll(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: {
    username?: string;
    retryFailed?: boolean;
  };
  try {
    body = (await request.json()) as { username?: string; retryFailed?: boolean };
  } catch {
    body = {};
  }

  const baseUsername = body.username || `df_${walletAddress.slice(2, 10)}`;
  const retryFailed = body.retryFailed ?? false;

  // Check premium for premium protocols
  const premium = await checkPremiumStatus(walletAddress, env);
  const isPremium = !!premium;

  // Check existing registrations to skip already-registered (unless retrying)
  const existingAccounts = await getExistingAccounts(walletAddress, env.IDENTITIES);
  const existingProtocols = new Set(existingAccounts.map((a) => a.platform));

  // Generate derived usernames deterministically
  const usernames = deriveUsernames(baseUsername, walletAddress);

  const results: JoinAllResult[] = [];
  let connectedCount = 0;
  let failedCount = 0;

  // Register on each protocol sequentially (order matters for dependency)
  for (const protocol of ALL_PROTOCOLS) {
    // Skip premium protocols if not premium
    if (PREMIUM_PROTOCOLS.has(protocol) && !isPremium) {
      results.push({
        protocol,
        ok: false,
        status: 'skipped',
        error: 'Premium subscription required. Upgrade at /premium.',
      });
      continue;
    }

    // Skip if already registered (unless retryFailed mode)
    if (existingProtocols.has(protocol) && !retryFailed) {
      results.push({
        protocol,
        ok: true,
        status: 'pending',
        username: usernames[protocol] || baseUsername,
        identifier: existingAccounts.find((a) => a.platform === protocol)?.identifier,
      });
      connectedCount++;
      continue;
    }

    // Skip if previously failed and we're not retrying
    if (!retryFailed && existingAccounts.find((a) => a.platform === protocol && a.failed)) {
      results.push({
        protocol,
        ok: false,
        status: 'failed',
        error: 'Previously failed. Use retryFailed:true to retry.',
      });
      failedCount++;
      continue;
    }

    try {
      const desiredUsername = usernames[protocol] || baseUsername;
      const instanceUrl = PROTOCOL_INSTANCES[protocol] || '';

      const result = await registerOnPlatform(protocol, desiredUsername, walletAddress, {
        storage: env.PLATFORM_ACCOUNTS,
        walletAddress,
        sealSecret: (plaintext: string) =>
          sealForWallet(env, plaintext, walletAddress, 'protocol-key'),
        baseRpcUrl: env.BASE_RPC_URL,
        premiumWalletPrivateKey: env.PREMIUM_WALLET_KEY,
        polygonRpcUrl: env.POLYGON_RPC_URL,
        blueskyInvitePool: env.BLUESKY_INVITE_POOL,
        mastodonInstanceUrl: instanceUrl,
        lemmyInstanceUrl: env.LEMMY_INSTANCE_URL || instanceUrl,
        peertubeInstanceUrl: env.PEERTUBE_INSTANCE_URL || instanceUrl,
        pixelfedInstanceUrl: env.PIXELFED_INSTANCE_URL || instanceUrl,
        bookwyrmInstanceUrl: env.BOOKWYRM_INSTANCE_URL || instanceUrl,
        funkwhaleInstanceUrl: env.FUNKWHALE_INSTANCE_URL || instanceUrl,
        mobilizonInstanceUrl: env.MOBILIZON_INSTANCE_URL || instanceUrl,
        writefreelyInstanceUrl: env.WRITEFREELY_INSTANCE_URL || instanceUrl,
        owncastInstanceUrl: env.OWNCAST_INSTANCE_URL || instanceUrl,
        owncastAdminKey: env.OWNCAST_ADMIN_KEY || '',
        castopodInstanceUrl: env.CASTOPOD_INSTANCE_URL || instanceUrl,
      });

      if (result.status === 'created') {
        results.push({
          protocol,
          ok: true,
          status: 'created',
          username: result.username || desiredUsername,
          identifier: result.accountInfo?.did || result.accountInfo?.fid || result.username,
          profileUrl: result.accountInfo?.profileUrl,
        });
        connectedCount++;
      } else {
        results.push({
          protocol,
          ok: false,
          status: result.status,
          error: result.error || 'Registration pending or failed',
        });
        if (result.status === 'failed') failedCount++;
      }
    } catch (err) {
      results.push({
        protocol,
        ok: false,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      failedCount++;
    }
  }

  // ── Store all identities in the identity KV ─────────────────────────
  await storeAllIdentities(walletAddress, results, env);

  // ── Create SSO session ──────────────────────────────────────────────
  let ssoSessionToken: string | undefined;
  try {
    const { createCrossNetworkSession, signSessionToken } = await import('../lib/sso-bridge');
    const session_ = await createCrossNetworkSession(walletAddress, env);
    ssoSessionToken = await signSessionToken(session_);
  } catch {
    // Non-fatal: SSO session creation may fail without blocking registration
  }

  log('info', 'Join All Networks completed', {
    wallet: walletAddress.slice(0, 8),
    connected: connectedCount,
    failed: failedCount,
    total: ALL_PROTOCOLS.length,
  });

  return jsonResponse(
    {
      success: true,
      wallet: walletAddress,
      results,
      connectedCount,
      totalProtocols: ALL_PROTOCOLS.length,
      failedCount,
      ssoSessionToken,
      recoveryInfo: {
        warning:
          'Save your recovery keys for each protocol. Some platforms (Farcaster, Lens) require wallet signatures.',
        action: 'Visit /api/sso/recovery/generate to create a master recovery code.',
      },
    },
    connectedCount > 0 ? 201 : 200,
  );
}

// ─── GET /api/accounts/join-all/status ──────────────────────────────────

export async function handleJoinAllStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // Get all registered accounts from platform accounts KV
  const accounts: Record<
    string,
    {
      registered: boolean;
      username?: string;
      identifier?: string;
      failed?: boolean;
      error?: string;
    }
  > = {};

  for (const protocol of ALL_PROTOCOLS) {
    accounts[protocol] = { registered: false };
  }

  // Check PLATFORM_ACCOUNTS KV
  try {
    const { getPlatformAccounts } = await import('@degenfeed/crossplatform-register');
    const platformAccounts = await getPlatformAccounts(walletAddress, env.PLATFORM_ACCOUNTS);
    for (const acct of platformAccounts) {
      if (acct.platform in accounts) {
        accounts[acct.platform] = {
          registered: true,
          username: acct.username || undefined,
          identifier: acct.identifier || undefined,
        };
      }
    }
  } catch {
    // KV read failed
  }

  // Check IDENTITIES KV for richer status
  try {
    const identKey = identityKey(walletAddress);
    const raw = await env.IDENTITIES?.get(identKey);
    if (raw) {
      const identity = JSON.parse(raw) as Record<string, unknown>;
      for (const protocol of ALL_PROTOCOLS) {
        const protoData = identity[protocol] as Record<string, unknown> | undefined;
        if (protoData?.verified || protoData?.registered) {
          if (!accounts[protocol]?.registered) {
            accounts[protocol] = {
              registered: true,
              username: (protoData.username as string) || (protoData.handle as string) || undefined,
              identifier: (protoData.did as string) || (protoData.fid as string) || undefined,
            };
          }
        }
      }
    }
  } catch {
    // KV read failed
  }

  const registeredCount = Object.values(accounts).filter((a) => a.registered).length;
  const premium = await checkPremiumStatus(walletAddress, env);

  return noCacheJsonResponse({
    wallet: walletAddress,
    accounts,
    registeredCount,
    totalProtocols: ALL_PROTOCOLS.length,
    isPremium: !!premium,
    premiumTier: premium?.tier || null,
    joinAllUrl: '/api/accounts/join-all',
    retryUrl: '/api/accounts/join-all/retry',
  });
}

// ─── POST /api/accounts/join-all/retry — Retry failed registrations ─────

export async function handleJoinAllRetry(request: Request, env: Env): Promise<Response> {
  // Reuse handleJoinAll with retryFailed: true
  const newRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ retryFailed: true }),
  });
  return handleJoinAll(newRequest, env);
}

// ─── Helpers ─────────────────────────────────────────────────────────────

async function getExistingAccounts(
  walletAddress: string,
  identitiesKV: KVNamespace | undefined,
): Promise<Array<{ platform: string; identifier?: string; failed?: boolean }>> {
  if (!identitiesKV) return [];
  try {
    const identKey = identityKey(walletAddress);
    const raw = await identitiesKV.get(identKey);
    if (!raw) return [];
    const identity = JSON.parse(raw) as Record<string, unknown>;
    const accounts: Array<{ platform: string; identifier?: string; failed?: boolean }> = [];
    for (const protocol of ALL_PROTOCOLS) {
      const data = identity[protocol] as
        | { verified?: boolean; did?: string; fid?: string; username?: string; error?: string }
        | undefined;
      if (data) {
        accounts.push({
          platform: protocol,
          identifier: data.did || data.fid || data.username,
          failed: !!data.error,
        });
      }
    }
    return accounts;
  } catch {
    return [];
  }
}

async function storeAllIdentities(
  walletAddress: string,
  results: JoinAllResult[],
  env: Env,
): Promise<void> {
  try {
    const identKey = identityKey(walletAddress);
    const existingRaw = await env.IDENTITIES?.get(identKey);
    const existing: Record<string, unknown> = existingRaw
      ? (JSON.parse(existingRaw) as Record<string, unknown>)
      : { walletAddress, linkedAt: Date.now(), lastVerified: Date.now() };

    const now = Date.now();
    for (const result of results) {
      if (result.ok && result.status === 'created') {
        existing[result.protocol] = {
          verified: false,
          username: result.username,
          identifier: result.identifier,
          profileUrl: result.profileUrl,
        };
      }
    }
    existing.lastVerified = now;
    await env.IDENTITIES?.put(identKey, JSON.stringify(existing));
  } catch {
    // Non-fatal
  }
}

function deriveUsernames(baseUsername: string, walletAddress: string): Record<string, string> {
  const short = walletAddress.slice(2, 10).toLowerCase();
  return {
    mastodon: baseUsername,
    bluesky: `${baseUsername}.pds.degenfeed.xyz`,
    nostr: `npub_${short}`,
    lemmy: baseUsername,
    peertube: baseUsername,
    pixelfed: baseUsername,
    writefreely: baseUsername,
    bookwyrm: baseUsername,
    funkwhale: baseUsername,
    mobilizon: baseUsername,
    owncast: baseUsername,
    castopod: baseUsername,
    farcaster: baseUsername,
    lens: `${baseUsername}.lens`,
  };
}
