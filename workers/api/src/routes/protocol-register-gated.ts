/**
 * @degenfeed/api-worker — Tier-Gated Protocol Registration Routes
 *
 * Individual protocol registration routes gated by membership tier.
 * Each route checks the user's tier before allowing registration.
 *
 * Routes:
 *   POST /api/gts/register            — Free (ActivityPub)
 *   POST /api/nostr/register          — Pro+
 *   POST /api/bluesky/register        — Creator+
 *   POST /api/lemmy/register          — Creator+
 *   POST /api/farcaster/register      — Enterprise
 *   POST /api/lens/register           — Enterprise
 *   POST /api/zora/mint               — Enterprise
 *
 * Each handler:
 *   1. Validates the session
 *   2. Checks tier access + returns upgrade CTA if locked
 *   3. Delegates to @degenfeed/crossplatform-register for actual creation
 *   4. Auto-links identity in IDENTITIES KV
 */

import {
  getPlatformAccounts,
  registerBookWyrm,
  registerFunkwhale,
  registerMastodon,
  registerMobilizon,
  registerPeerTube,
  registerPixelfed,
  registerWriteFreely,
} from '@degenfeed/crossplatform-register';
import { identityKey } from '@degenfeed/utils';
import { log } from '../index';
import {
  checkProtocolAccess,
  getProtocolUpgradeCta,
  getUserTier,
  PROTOCOL_ACCESS,
  type ProtocolId,
  type Tier,
} from '../lib/membership-tiers';
import {
  jsonResponse,
  methodNotAllowed,
  noCacheJsonResponse,
  serverError,
} from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]{2,30}$/;

const REGISTRATION_ROUTES: Array<{
  path: string;
  protocol: ProtocolId;
  minTier: Tier;
}> = [
  { path: '/api/gts/register', protocol: 'gts', minTier: 'free' },
  { path: '/api/nostr/register', protocol: 'nostr', minTier: 'pro' },
  { path: '/api/bluesky/register', protocol: 'bluesky', minTier: 'creator' },
  { path: '/api/lemmy/register', protocol: 'lemmy', minTier: 'creator' },
  { path: '/api/farcaster/register', protocol: 'farcaster', minTier: 'enterprise' },
  { path: '/api/lens/register', protocol: 'lens', minTier: 'enterprise' },
  { path: '/api/zora/mint', protocol: 'zora', minTier: 'enterprise' },
];

// ─── Route handler registration ────────────────────────────────────────────

import type { Hono } from 'hono';

/**
 * Register all tier-gated protocol routes on the given Hono app.
 */
export function registerGatedProtocolRoutes(app: Hono<{ Bindings: Env }>): void {
  for (const route of REGISTRATION_ROUTES) {
    app.post(route.path, async (c) => {
      try {
        return await handleGatedRegistration(c.req.raw, c.env, route.protocol, route.minTier);
      } catch (err) {
        return serverError(err instanceof Error ? err.message : 'Unknown error');
      }
    });
  }
}

// ─── Core handler ──────────────────────────────────────────────────────────

/**
 * Generic handler for tier-gated protocol registration.
 * All specific protocol routes flow through this handler.
 */
async function handleGatedRegistration(
  request: Request,
  env: Env,
  protocol: ProtocolId,
  minTier: Tier,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  // 1. Validate session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // 2. Check tier access
  const userTier = await getUserTier(walletAddress, env);
  if (!checkProtocolAccess(userTier, protocol)) {
    const upgradeCta = getProtocolUpgradeCta(userTier, protocol);
    const protoDef = PROTOCOL_ACCESS[protocol];
    return jsonResponse(
      {
        error: `${protoDef?.label ?? protocol} requires ${minTier} tier or higher (current: ${userTier}).`,
        upgrade: true,
        upgradeCta,
        requiredTier: minTier,
        currentTier: userTier,
        protocol: {
          id: protocol,
          label: protoDef?.label,
          description: protoDef?.description,
          benefits: protoDef?.benefits,
        },
        upgradeUrl: `/api/membership/upgrade`,
      },
      402,
      { 'X-Tier-Required': minTier, 'X-Current-Tier': userTier },
    );
  }

  // 3. Parse body
  let body: { username?: string };
  try {
    body = (await request.json()) as { username?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const desiredUsername = body.username;
  if (!desiredUsername) {
    return jsonResponse({ error: 'username is required' }, 400);
  }
  if (!USERNAME_REGEX.test(desiredUsername)) {
    return jsonResponse(
      {
        error: 'Username must be 2-30 characters: letters, numbers, underscores, hyphens, dots',
      },
      400,
    );
  }

  // 4. Check for existing registration
  try {
    const accounts = await getPlatformAccounts(walletAddress, env.PLATFORM_ACCOUNTS);
    const existing = accounts.find(
      (a) => a.platform === protocol || a.platform === mapProtocolToPlatform(protocol),
    );
    if (existing && existing.identifier) {
      return jsonResponse(
        {
          error: `Already registered on ${PROTOCOL_ACCESS[protocol]?.label ?? protocol}`,
          protocol,
          username: existing.username,
          identifier: existing.identifier,
          profileUrl: existing.accountInfo?.profileUrl,
        },
        409,
      );
    }
  } catch {
    // KV hiccup — proceed and let registration handle dedup
  }

  // 5. Execute registration
  const result = await registerOnProtocol(protocol, desiredUsername, walletAddress, env);

  // 6. Auto-link identity
  if (result.status === 'created' && result.accountInfo) {
    await autoLinkIdentity(protocol, result.accountInfo, walletAddress, env);
  }

  log('info', 'Tier-gated protocol registration', {
    protocol,
    tier: minTier,
    wallet: walletAddress.slice(0, 8),
    status: result.status,
    username: result.username,
  });

  const statusCode = result.status === 'created' ? 201 : result.status === 'failed' ? 400 : 202;
  return jsonResponse(
    {
      success: result.status === 'created',
      protocol,
      status: result.status,
      username: result.username,
      identifier: result.accountInfo?.did || result.accountInfo?.fid || result.username,
      profileUrl: result.accountInfo?.profileUrl,
      ...(result.error ? { error: result.error } : {}),
    },
    statusCode,
  );
}

// ─── Registration Dispatcher ───────────────────────────────────────────────

async function registerOnProtocol(
  protocol: ProtocolId,
  username: string,
  walletAddress: string,
  env: Env,
) {
  const opts = {
    walletAddress,
    storage: env.PLATFORM_ACCOUNTS,
    sealSecret: undefined,
    baseRpcUrl: env.BASE_RPC_URL,
    premiumWalletPrivateKey: env.PREMIUM_WALLET_KEY,
    polygonRpcUrl: env.POLYGON_RPC_URL,
    blueskyInvitePool: env.BLUESKY_INVITE_POOL,
    mastodonInstanceUrl: env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
    lemmyInstanceUrl: env.LEMMY_INSTANCE_URL || 'https://community.degenfeed.xyz',
    peertubeInstanceUrl: env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz',
    pixelfedInstanceUrl: env.PIXELFED_INSTANCE_URL || 'https://pixelfed.social',
    bookwyrmInstanceUrl: env.BOOKWYRM_INSTANCE_URL || 'https://books.degenfeed.xyz',
    funkwhaleInstanceUrl: env.FUNKWHALE_INSTANCE_URL || 'https://music.degenfeed.xyz',
    mobilizonInstanceUrl: env.MOBILIZON_INSTANCE_URL || 'https://events.degenfeed.xyz',
    writefreelyInstanceUrl: env.WRITEFREELY_INSTANCE_URL || 'https://blog.degenfeed.xyz',
    owncastInstanceUrl: env.OWNCAST_INSTANCE_URL || 'https://live.degenfeed.xyz',
    owncastAdminKey: env.OWNCAST_ADMIN_KEY || '',
    castopodInstanceUrl: env.CASTOPOD_INSTANCE_URL || 'https://podcasts.degenfeed.xyz',
  };

  // ActivityPub (Free) — uses crossplatform-register
  switch (protocol) {
    case 'gts':
    case 'mastodon':
      return registerMastodon(username, walletAddress, opts);
    case 'peertube':
      return registerPeerTube(username, walletAddress, opts);
    case 'pixelfed':
      return registerPixelfed(username, walletAddress, opts);
    case 'writefreely':
      return registerWriteFreely(username, walletAddress, opts);
    case 'bookwyrm':
      return registerBookWyrm(username, walletAddress, opts);
    case 'mobilizon':
      return registerMobilizon(username, walletAddress, opts);
    case 'funkwhale':
      return registerFunkwhale(username, walletAddress, opts);
    default:
      return {
        platform: protocol as never,
        status: 'failed' as const,
        error: `Protocol registration not yet implemented for: ${protocol}`,
      };
  }
}

// ─── Identity Auto-Linking ─────────────────────────────────────────────────

async function autoLinkIdentity(
  protocol: ProtocolId,
  accountInfo: Record<string, string>,
  walletAddress: string,
  env: Env,
): Promise<void> {
  try {
    const key = identityKey(walletAddress);
    let existing: Record<string, unknown> = {};
    const raw = await env.IDENTITIES?.get(key);
    if (raw) {
      existing = JSON.parse(raw) as Record<string, unknown>;
    }

    const now = Date.now();
    const identityPayload = {
      verified: false,
      username: accountInfo.username || accountInfo.handle || '',
      identifier: accountInfo.did || accountInfo.fid || accountInfo.username || '',
      profileUrl: accountInfo.profileUrl || '',
      instance: accountInfo.instance || '',
      protocol,
      linkedAt: now,
    };

    const updated = {
      ...existing,
      walletAddress,
      linkedAt: existing.linkedAt || now,
      lastVerified: now,
      [protocol]: identityPayload,
    };

    await env.IDENTITIES?.put(key, JSON.stringify(updated));
    log('info', 'Identity auto-linked after gated registration', {
      protocol,
      wallet: walletAddress.slice(0, 8),
    });
  } catch (linkErr) {
    log('warn', 'Failed to auto-link identity after gated registration', {
      protocol,
      error: linkErr instanceof Error ? linkErr.message : String(linkErr),
    });
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Map protocol IDs to their crossplatform-register platform name.
 */
function mapProtocolToPlatform(protocol: ProtocolId): string {
  const map: Partial<Record<ProtocolId, string>> = {
    gts: 'mastodon',
    mastodon: 'mastodon',
    peertube: 'peertube',
    pixelfed: 'pixelfed',
    writefreely: 'writefreely',
    bookwyrm: 'bookwyrm',
    mobilizon: 'mobilizon',
    funkwhale: 'funkwhale',
    owncast: 'owncast',
    castopod: 'castopod',
    nostr: 'nostr',
    bluesky: 'bluesky',
    lemmy: 'lemmy',
    farcaster: 'farcaster',
    lens: 'lens',
    zora: 'zora',
  };
  return map[protocol] ?? protocol;
}
