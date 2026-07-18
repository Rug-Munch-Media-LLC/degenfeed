/**
 * @degenfeed/api-worker — Cross-platform registration route
 *
 * POST /api/register-platform — Register the authenticated user on a social platform
 * GET  /api/register-platform/status — Get all registered platforms for current user
 * GET  /api/register-platform/bluesky-pool — Get Bluesky invite pool stats (admin)
 */

import { registerOnPlatform, getPlatformAccounts } from '@degenfeed/crossplatform-register';
import { getInvitePoolStats } from '@degenfeed/crossplatform-register/bluesky-invite-pool';
import { type Env, jsonResponse, noCacheJsonResponse, log } from '../index';
import { requireSession } from '../session';

// ─── POST /api/register-platform ──────────────────────────────────────

export async function handleRegisterPlatform(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // Check premium subscription
  const tier = await checkPremiumStatus(walletAddress, env);
  if (!tier) {
    return jsonResponse(
      { error: 'Premium subscription required. Upgrade at /premium to unlock cross-platform registration.', upgrade: true },
      402,
    );
  }

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

  const validPlatforms = ['farcaster', 'lens', 'bluesky', 'mastodon', 'nostr'];
  if (!validPlatforms.includes(platform)) {
    return jsonResponse({
      error: `Unsupported platform: ${platform}. Supported: ${validPlatforms.join(', ')}`,
    }, 400);
  }

  // Validate username format
  if (!/^[a-zA-Z0-9_\-.]{2,30}$/.test(desiredUsername)) {
    return jsonResponse({
      error: 'Username must be 2-30 characters and contain only letters, numbers, underscores, hyphens, and dots',
    }, 400);
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

// ─── Premium check helper ──────────────────────────────────────────────

async function checkPremiumStatus(
  walletAddress: string,
  env: Env,
): Promise<string | null> {
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
