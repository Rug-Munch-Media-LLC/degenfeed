/**
 * @degenfeed/api-worker — Cross-platform registration route
 *
 * POST /api/register-platform — Register the authenticated user on a social platform
 * GET  /api/register-platform/status — Get all registered platforms for current user
 * GET  /api/register-platform/bluesky-pool — Get Bluesky invite pool stats (admin)
 */

import { getPlatformAccounts, registerOnPlatform } from '@degenfeed/crossplatform-register';
import { getInvitePoolStats } from '@degenfeed/crossplatform-register/bluesky-invite-pool';
import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { type Env, jsonResponse, log, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── POST /api/register-platform ──────────────────────────────────────

const PREMIUM_PLATFORMS = new Set(['farcaster', 'lens', 'bluesky']);
const FREE_PLATFORMS = new Set(['mastodon', 'nostr']);
const VALID_PLATFORMS = new Set([...PREMIUM_PLATFORMS, ...FREE_PLATFORMS]);

export async function handleRegisterPlatform(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: {
    platform?: string;
    username?: string;
  };
  try {
    body = (await request.json()) as {
      platform?: string;
      username?: string;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const platform = body.platform;
  const desiredUsername = body.username;

  if (!platform || !desiredUsername) {
    return jsonResponse({ error: 'Missing platform or username' }, 400);
  }

  if (!VALID_PLATFORMS.has(platform)) {
    return jsonResponse(
      {
        error: `Unsupported platform: ${platform}. Supported: ${[...VALID_PLATFORMS].join(', ')}`,
      },
      400,
    );
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_\-.]{2,30}$/.test(desiredUsername)) {
    return jsonResponse(
      {
        error:
          'Username must be 2-30 characters and contain only letters, numbers, underscores, hyphens, and dots',
      },
      400,
    );
  }

  // Check premium subscription — only required for premium platforms
  if (PREMIUM_PLATFORMS.has(platform)) {
    const tier = await checkPremiumStatus(walletAddress, env);
    if (!tier) {
      return jsonResponse(
        {
          error:
            'Premium subscription required. Upgrade at /premium to unlock cross-platform registration.',
          upgrade: true,
        },
        402,
      );
    }
  }

  const result = await registerOnPlatform(platform, desiredUsername, walletAddress, {
    storage: env.PLATFORM_ACCOUNTS,
    walletAddress,
    baseRpcUrl: env.BASE_RPC_URL,
    premiumWalletPrivateKey: env.PREMIUM_WALLET_KEY,
    polygonRpcUrl: env.POLYGON_RPC_URL,
    blueskyInvitePool: env.BLUESKY_INVITE_POOL,
    mastodonInstanceUrl: env.MASTODON_INSTANCE_URL || 'https://social.degenfeed.xyz',
  });

  // Auto-link identity on successful registration
  if (result.status === 'created' && result.accountInfo) {
    const identityPayload = buildIdentityLinkPayload(platform, result.accountInfo);
    if (identityPayload) {
      try {
        const identKey = identityKey(walletAddress);
        let existing: CrossProtocolIdentity | null = null;
        const raw = await env.IDENTITIES?.get(identKey);
        if (raw) existing = JSON.parse(raw) as CrossProtocolIdentity;

        const now = Date.now();
        const updated: CrossProtocolIdentity = {
          ...(existing || { walletAddress, linkedAt: now, lastVerified: now }),
          [platform]: { ...identityPayload, verified: platform === 'farcaster' }, // Farcaster registration is on-chain verified
          lastVerified: now,
        };

        await env.IDENTITIES?.put(identKey, JSON.stringify(updated));
        log('info', 'Identity auto-linked after registration', {
          platform,
          wallet: walletAddress.slice(0, 8),
        });
      } catch (linkErr) {
        log('warn', 'Failed to auto-link identity after registration', {
          platform,
          error: linkErr instanceof Error ? linkErr.message : String(linkErr),
        });
        // Non-fatal — registration succeeded even if linking fails
      }
    }
  }

  log('info', 'Platform registration attempt', {
    platform,
    wallet: walletAddress.slice(0, 8),
    status: result.status,
    username: result.username,
  });

  const statusCode = result.status === 'created' ? 201 : result.status === 'failed' ? 400 : 202;
  return jsonResponse({ data: result }, statusCode);
}

// ─── GET /api/register-platform/status ────────────────────────────────

export async function handleRegisterPlatformStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  const accounts = await getPlatformAccounts(walletAddress, env.PLATFORM_ACCOUNTS);

  const tier = await checkPremiumStatus(walletAddress, env);
  const platformStatus = {
    farcaster: { registered: false, username: null as string | null },
    lens: { registered: false, username: null as string | null },
    bluesky: { registered: false, username: null as string | null },
    mastodon: { registered: false, username: null as string | null },
    nostr: { registered: false, username: null as string | null },
  };

  for (const acct of accounts) {
    if (acct.platform in platformStatus) {
      platformStatus[acct.platform as keyof typeof platformStatus] = {
        registered: true,
        username: acct.username || null,
      };
    }
  }

  const connectedCount = accounts.length;

  return noCacheJsonResponse({
    data: {
      accounts,
      platformStatus,
      connectedCount,
      totalPlatforms: 5,
      isPremium: !!tier,
      tier,
    },
  });
}

// ─── GET /api/register-platform/bluesky-pool (admin) ─────────────────

export async function handleBlueskyPoolStats(_request: Request, env: Env): Promise<Response> {
  const stats = await getInvitePoolStats(env.BLUESKY_INVITE_POOL);
  return jsonResponse({ data: stats });
}

// ─── Identity link payload builder ────────────────────────────────────

function buildIdentityLinkPayload(
  platform: string,
  accountInfo: Record<string, string>,
): Record<string, unknown> | null {
  switch (platform) {
    case 'farcaster': {
      const fid = Number(accountInfo.fid);
      if (!fid || !accountInfo.username) return null;
      return {
        fid,
        username: accountInfo.username,
        custodyAddress: accountInfo.recoveryAddress || '',
      };
    }
    case 'lens': {
      if (!accountInfo.profileId && !accountInfo.handle) return null;
      return { profileId: accountInfo.profileId || '', handle: accountInfo.handle || '' };
    }
    case 'bluesky': {
      if (!accountInfo.did && !accountInfo.handle) return null;
      return { did: accountInfo.did || '', handle: accountInfo.handle || '' };
    }
    case 'mastodon': {
      if (!accountInfo.username && !accountInfo.accountId) return null;
      return {
        handle: accountInfo.username || accountInfo.accountId || '',
        instance: accountInfo.instance || 'social.degenfeed.xyz',
      };
    }
    case 'nostr': {
      if (!accountInfo.npub) return null;
      return { npub: accountInfo.npub, relays: [] };
    }
    default:
      return null;
  }
}

// ─── Premium check helper ──────────────────────────────────────────────

async function checkPremiumStatus(walletAddress: string, env: Env): Promise<string | null> {
  // Check SUBSCRIPTIONS KV first
  if (env.SUBSCRIPTIONS) {
    try {
      const identityId = `solana:${walletAddress}`;
      const raw = await env.SUBSCRIPTIONS.get(identityId);
      if (raw) {
        const record = JSON.parse(raw) as { tier: string; expiresAt: number };
        if (record.expiresAt > Date.now()) {
          return record.tier;
        }
      }

      // Also check ethereum-prefixed identity
      const ethIdentityId = `ethereum:${walletAddress}`;
      const ethRaw = await env.SUBSCRIPTIONS.get(ethIdentityId);
      if (ethRaw) {
        const record = JSON.parse(ethRaw) as { tier: string; expiresAt: number };
        if (record.expiresAt > Date.now()) {
          return record.tier;
        }
      }
    } catch {
      // Fall through
    }
  }

  return null;
}
