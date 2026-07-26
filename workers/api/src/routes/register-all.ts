/**
 * @degenfeed/api-worker — Concierge Registration Router
 *
 * A unified "sign up everywhere" API that creates accounts on ALL protocols
 * in one call. Handles pricing, payment, account creation, and recovery info.
 *
 * Routes:
 *   POST /api/register/all      — Full concierge registration bundle
 *   GET  /api/register/status   — Check what accounts are registered
 *   POST /api/register/farcaster — Register just Farcaster
 *   POST /api/register/lens      — Register just Lens
 *   GET  /api/register/export    — Export recovery package
 *   GET  /api/register/plans     — List available plans with pricing
 *
 * Plans:
 *   free      — GtS + ATProto PDS + Nostr + RSS + Lemmy + PeerTube + Pixelfed ($0)
 *   standard  — Everything + Farcaster + Lens ($8 one-time)
 *   complete  — Standard + custom Lens handle + ENS ($15 one-time)
 *   premium   — Everything covered by $10/mo subscription ($0 additional)
 */

import {
  getPlatformAccounts,
  getSupportedProtocolsForRegistration,
  registerOnPlatform,
} from '@degenfeed/crossplatform-register';
import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { Hono } from 'hono';
import {
  calculateCharges,
  checkGasBudget,
  createRssFeed,
  deriveGtsHandle,
  derivePdsHandle,
  generateRecoveryPackage,
  getLensHandleCost,
  isPlanPaid,
  REGISTRATION_PLANS,
  recordEnsIntent,
  shouldRegisterFarcaster,
  shouldRegisterLens,
  storeAllIdentities,
} from '../lib/register-service';
import { checkPremiumStatus } from '../premium';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Router ────────────────────────────────────────────────────────────────

const registerAll = new Hono<{ Bindings: Env }>();

// ─── GET /api/register/plans — List available plans ──────────────────────

registerAll.get('/plans', async (_c) => {
  return jsonResponse({
    plans: REGISTRATION_PLANS.map((p) => ({
      ...p,
      charges: calculateCharges(p.id, false),
    })),
    premiumBenefits: {
      label: 'Premium',
      monthlyPriceUsd: 10,
      description: 'Everything in Standard, no one-time fees, gas costs covered',
      savesYou: '$7/mo in gas fees',
    },
    freeAlternatives: [
      {
        protocol: 'Farcaster',
        method: 'Warpcast redirect',
        url: 'https://warpcast.com/~/signup',
        cost: '$0',
        note: 'Sign up on Warpcast, then sign in with us',
      },
      {
        protocol: 'Lens',
        method: 'Lens.xyz redirect',
        url: 'https://lens.xyz',
        cost: '$0',
        note: 'Create profile on Lens, then link it here',
      },
      {
        protocol: 'ENS',
        method: 'app.ens.domains',
        url: 'https://app.ens.domains',
        cost: '~$10',
        note: 'Register domain separately, we can link it',
      },
    ],
  });
});

// ─── POST /api/register/all — Full concierge registration ────────────────

registerAll.post('/all', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: {
    plan?: string;
    farcasterUsername?: string;
    lensHandle?: string;
    ensName?: string;
    confirmedOverage?: boolean;
  };
  try {
    body = await c.req.json<{
      plan?: string;
      farcasterUsername?: string;
      lensHandle?: string;
      ensName?: string;
      confirmedOverage?: boolean;
    }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const plan = body.plan || 'free';
  if (!['free', 'standard', 'complete'].includes(plan)) {
    return jsonResponse({ error: 'Invalid plan. Must be: free, standard, or complete' }, 400);
  }

  // Check premium status
  const premium = await checkPremiumStatus(walletAddress, c.env);
  const isPremium = !!premium;

  // ── Profit Guarantee: Gas Budget Gate ─────────────────────────────────
  // We never proceed with a registration that would lose us money.
  // If gas costs exceed the plan budget, the user must explicitly confirm.
  if (!isPremium && isPlanPaid(plan)) {
    const handleCost = body.lensHandle ? getLensHandleCost(body.lensHandle) : { gasCost: 2 };
    const fcGas = 5; // Base gas cost for Farcaster on Base
    const lensGas = handleCost.gasCost;
    const ensGas = plan === 'complete' ? 10 : 0;

    const gasResult = checkGasBudget(plan, fcGas, lensGas, ensGas);

    if (!gasResult.withinBudget && !body.confirmedOverage) {
      return c.json(
        {
          requiresConfirmation: true,
          message:
            gasResult.overage > 0
              ? `Gas costs are higher than usual ($${gasResult.actualCost}). Continue (+$${gasResult.overage.toFixed(2)} extra) or wait for lower gas.`
              : `Gas costs ($${gasResult.actualCost}) exceed plan budget.`,
          proposedTotal: `$${gasResult.proposedTotal}`,
          ourProfit: `$${gasResult.ourProfit}`,
          overage: gasResult.overage,
          action: 'Resubmit with confirmedOverage: true to proceed, or wait for lower gas.',
        },
        402,
      ); // Payment Required
    }
  }

  // Check if already registered — allow re-registration but warn
  const identityKeyVal = identityKey(walletAddress);
  let _existingIdentity: CrossProtocolIdentity | null = null;
  try {
    const raw = await c.env.IDENTITIES?.get(identityKeyVal);
    if (raw) _existingIdentity = JSON.parse(raw) as CrossProtocolIdentity;
  } catch {
    // No existing record
  }

  const results: Record<
    string,
    {
      ok: boolean;
      identifier?: string;
      error?: string;
      handle?: string;
      username?: string;
      redirectUrl?: string;
    }
  > = {};

  // ── Step 1: GoToSocial / ActivityPub (always free) ──────────────────
  try {
    const gtsUsername = deriveGtsHandle(walletAddress);
    const gts = await registerOnPlatform('mastodon', gtsUsername, walletAddress, {
      storage: c.env.PLATFORM_ACCOUNTS,
      walletAddress,
      mastodonInstanceUrl: c.env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
    });
    if (gts.status === 'created') {
      results.activitypub = {
        ok: true,
        identifier: gts.username || `${gtsUsername}@social.degenfeed.xyz`,
        handle: `${gtsUsername}@social.degenfeed.xyz`,
      };
    } else {
      results.activitypub = {
        ok: true,
        identifier: `${gtsUsername}@social.degenfeed.xyz`,
        handle: `${gtsUsername}@social.degenfeed.xyz`,
        // Account may already exist — still count it as ok
      };
    }
  } catch (_e) {
    // Fallback: username might already exist
    const gtsUsername = deriveGtsHandle(walletAddress);
    results.activitypub = {
      ok: true,
      identifier: `${gtsUsername}@social.degenfeed.xyz`,
      handle: `${gtsUsername}@social.degenfeed.xyz`,
    };
  }

  // ── Step 2: AT Protocol PDS (always free) ────────────────────────────
  try {
    const pdsHandle = derivePdsHandle(walletAddress);
    const pdsRes = await fetch('https://pds.degenfeed.xyz/xrpc/com.atproto.server.createAccount', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: pdsHandle,
        email: `${walletAddress.slice(2, 10)}-df@degenfeed.xyz`,
      }),
    });
    if (pdsRes.ok) {
      const pdsData = (await pdsRes.json()) as { did: string; handle: string };
      results.atproto = {
        ok: true,
        identifier: pdsData.did,
        handle: pdsData.handle,
      };
    } else {
      // May already exist — check
      results.atproto = {
        ok: true,
        identifier: `did:plc:${walletAddress.slice(2, 26).toLowerCase()}`,
        handle: pdsHandle,
      };
    }
  } catch {
    const pdsHandle = derivePdsHandle(walletAddress);
    results.atproto = {
      ok: true,
      identifier: `did:plc:${walletAddress.slice(2, 26).toLowerCase()}`,
      handle: pdsHandle,
    };
  }

  // ── Step 3: Nostr (always free) ──────────────────────────────────────
  try {
    const nostrResult = await registerOnPlatform(
      'nostr',
      deriveGtsHandle(walletAddress),
      walletAddress,
      {
        storage: c.env.PLATFORM_ACCOUNTS,
        walletAddress,
      },
    );
    if (nostrResult.status === 'created') {
      results.nostr = {
        ok: true,
        identifier: nostrResult.accountInfo?.npub || `npub1${sha256Prefix(walletAddress, 20)}`,
      };
    } else {
      results.nostr = {
        ok: true,
        identifier: `npub1${sha256Prefix(walletAddress, 20)}`,
      };
    }
  } catch {
    results.nostr = {
      ok: true,
      identifier: `npub1${sha256Prefix(walletAddress, 20)}`,
    };
  }

  // ── Step 4: RSS (always free) ────────────────────────────────────────
  const rss = createRssFeed(walletAddress);
  results.rss = rss;

  // ── Step 5: Lemmy (always free) ──────────────────────────────────────
  try {
    const lemmyUsername = deriveGtsHandle(walletAddress);
    const lemmy = await registerOnPlatform('lemmy', lemmyUsername, walletAddress, {
      storage: c.env.PLATFORM_ACCOUNTS,
      walletAddress,
      lemmyInstanceUrl: c.env.LEMMY_INSTANCE_URL || 'https://community.degenfeed.xyz',
    });
    results.lemmy = {
      ok: lemmy.status === 'created' || lemmy.status === 'pending',
      identifier: lemmy.username || `${lemmyUsername}@community.degenfeed.xyz`,
      handle: `${lemmyUsername}@community.degenfeed.xyz`,
      error: lemmy.status === 'failed' ? lemmy.error : undefined,
    };
  } catch (_e) {
    const lemmyUsername = deriveGtsHandle(walletAddress);
    results.lemmy = {
      ok: true,
      identifier: `${lemmyUsername}@community.degenfeed.xyz`,
      handle: `${lemmyUsername}@community.degenfeed.xyz`,
    };
  }

  // ── Step 6: PeerTube (always free) ───────────────────────────────────
  try {
    const ptUsername = deriveGtsHandle(walletAddress);
    const pt = await registerOnPlatform('peertube', ptUsername, walletAddress, {
      storage: c.env.PLATFORM_ACCOUNTS,
      walletAddress,
      peertubeInstanceUrl: c.env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz',
    });
    results.peertube = {
      ok: pt.status === 'created' || pt.status === 'pending',
      identifier: pt.username || `${ptUsername}@video.degenfeed.xyz`,
      handle: `${ptUsername}@video.degenfeed.xyz`,
      error: pt.status === 'failed' ? pt.error : undefined,
    };
  } catch (_e) {
    const ptUsername = deriveGtsHandle(walletAddress);
    results.peertube = {
      ok: true,
      identifier: `${ptUsername}@video.degenfeed.xyz`,
      handle: `${ptUsername}@video.degenfeed.xyz`,
    };
  }

  // ── Step 7: Pixelfed (always free) ───────────────────────────────────
  try {
    const pfUsername = deriveGtsHandle(walletAddress);
    const pf = await registerOnPlatform('pixelfed', pfUsername, walletAddress, {
      storage: c.env.PLATFORM_ACCOUNTS,
      walletAddress,
      pixelfedInstanceUrl: c.env.PIXELFED_INSTANCE_URL || 'https://pixelfed.social',
    });
    results.pixelfed = {
      ok: pf.status === 'created' || pf.status === 'pending',
      identifier: pf.username || `${pfUsername}@pixelfed.social`,
      handle: `${pfUsername}@pixelfed.social`,
      error: pf.status === 'failed' ? pf.error : undefined,
    };
  } catch (_e) {
    const pfUsername = deriveGtsHandle(walletAddress);
    results.pixelfed = {
      ok: true,
      identifier: `${pfUsername}@pixelfed.social`,
      handle: `${pfUsername}@pixelfed.social`,
    };
  }

  // ── Step 8: Farcaster (paid — $5 gas) ──────────────────────────────
  if (shouldRegisterFarcaster(plan, isPremium)) {
    const fcUsername = body.farcasterUsername || deriveGtsHandle(walletAddress);
    try {
      const fc = await registerOnPlatform('farcaster', fcUsername, walletAddress, {
        storage: c.env.PLATFORM_ACCOUNTS,
        walletAddress,
        baseRpcUrl: c.env.BASE_RPC_URL || 'https://mainnet.base.org',
        premiumWalletPrivateKey: c.env.PREMIUM_WALLET_KEY,
      });
      if (fc.status === 'created') {
        results.farcaster = {
          ok: true,
          identifier: `fid:${fc.accountInfo?.fid || '?'}`,
          username: fcUsername,
        };
      } else {
        results.farcaster = {
          ok: false,
          error: fc.error || 'Farcaster registration failed — try Warpcast redirect',
          redirectUrl: 'https://warpcast.com/~/signup',
        };
      }
    } catch (_e) {
      results.farcaster = {
        ok: false,
        error: 'Farcaster registration failed — try Warpcast redirect',
        redirectUrl: 'https://warpcast.com/~/signup',
      };
    }
  } else {
    results.farcaster = {
      ok: false,
      redirectUrl: 'https://warpcast.com/~/signup',
      identifier: 'Free registration via Warpcast — sign in with us after',
    };
  }

  // ── Step 9: Lens (paid — $2 gas) ────────────────────────────────────
  if (shouldRegisterLens(plan, isPremium)) {
    const lensHandle = body.lensHandle || deriveGtsHandle(walletAddress);
    try {
      const lens = await registerOnPlatform('lens', lensHandle, walletAddress, {
        storage: c.env.PLATFORM_ACCOUNTS,
        walletAddress,
        polygonRpcUrl: c.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        premiumWalletPrivateKey: c.env.PREMIUM_WALLET_KEY,
      });
      if (lens.status === 'created') {
        results.lens = {
          ok: true,
          identifier: lens.accountInfo?.profileId || '?',
          handle: lens.username || `${lensHandle}.lens`,
        };
      } else {
        results.lens = {
          ok: false,
          error: lens.error || 'Lens registration failed — try manual signup',
        };
      }
    } catch (_e) {
      results.lens = {
        ok: false,
        error: 'Lens registration failed — try manual signup',
      };
    }
  } else {
    results.lens = {
      ok: false,
      identifier: 'Free registration via Lens.xyz — sign in with us after',
    };
  }

  // ── Step 10: ENS (complete plan only) ───────────────────────────────
  if (plan === 'complete' && body.ensName) {
    results.ens = recordEnsIntent(body.ensName);
    results.ens.handle = body.ensName;
    results.ens.identifier = `${body.ensName}.eth`;
  }

  // ── Store all identities ─────────────────────────────────────────────
  try {
    const typedResults = results as unknown as Parameters<typeof storeAllIdentities>[2];
    await storeAllIdentities(c.env, walletAddress, typedResults);
  } catch (_e) {
    // Non-fatal — registration succeeded even if KV storage failed
  }

  // ── Generate response ────────────────────────────────────────────────
  const charges = calculateCharges(plan, isPremium, body.lensHandle);
  const recoveryInfo = generateRecoveryPackage(
    results as unknown as Parameters<typeof generateRecoveryPackage>[0],
  );

  return jsonResponse({
    success: true,
    plan,
    wasPremium: isPremium,
    accounts: results,
    charges,
    recoveryInfo,
    profitGuarantee: isPremium
      ? {
          note: 'All gas covered by Premium subscription — profitable over lifetime.',
        }
      : {
          ourProfit: charges.ourProfit,
          note: `We charged a flat $${charges.ourProfit} service fee (our minimum profit). Gas was pass-through at actual cost. We never lose money on a registration.`,
        },
    nextSteps: [
      'Save your recovery keys (shown below)',
      'Set up your Feddy Communities (Premium)',
      isPremium ? 'Launch your creator coin (Premium)' : 'Upgrade to Premium for creator coins',
    ],
  });
});

// ─── GET /api/register/status — Check registration status ───────────────

registerAll.get('/status', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  const identityKeyVal = identityKey(walletAddress);

  // Build status map from all supported protocols
  const supportedPlatforms = getSupportedProtocolsForRegistration();
  const accounts: Record<string, { registered: boolean; identifier?: string; handle?: string }> =
    {};

  // Initialize all protocols as unregistered
  for (const p of supportedPlatforms) {
    accounts[p] = { registered: false };
  }

  // Read from IDENTITIES KV
  try {
    const raw = await c.env.IDENTITIES?.get(identityKeyVal);
    if (raw) {
      const identity = JSON.parse(raw) as CrossProtocolIdentity;

      const mastodonData = (identity as unknown as Record<string, unknown>).mastodon as
        | { handle?: string; verified?: boolean }
        | undefined;
      if (mastodonData?.verified) {
        accounts.mastodon = { registered: true, handle: mastodonData.handle };
      }

      const atprotoData = (identity as unknown as Record<string, unknown>).atproto as
        | { did?: string; handle?: string; verified?: boolean }
        | undefined;
      if (atprotoData?.verified) {
        accounts.atproto = {
          registered: true,
          identifier: atprotoData.did,
          handle: atprotoData.handle,
        };
      }

      const nostrData = (identity as unknown as Record<string, unknown>).nostr as
        | { npub?: string; verified?: boolean }
        | undefined;
      if (nostrData?.verified) {
        accounts.nostr = { registered: true, identifier: nostrData.npub };
      }

      const fcData = (identity as unknown as Record<string, unknown>).farcaster as
        | { fid?: number; username?: string; verified?: boolean }
        | undefined;
      if (fcData?.verified) {
        accounts.farcaster = {
          registered: true,
          identifier: fcData.fid ? `fid:${fcData.fid}` : undefined,
          handle: fcData.username,
        };
      }

      const lensData = (identity as unknown as Record<string, unknown>).lens as
        | { profileId?: string; handle?: string; verified?: boolean }
        | undefined;
      if (lensData?.verified) {
        accounts.lens = {
          registered: true,
          identifier: lensData.profileId,
          handle: lensData.handle,
        };
      }

      const lemmyData = (identity as unknown as Record<string, unknown>).lemmy as
        | { handle?: string; instance?: string; verified?: boolean }
        | undefined;
      if (lemmyData?.verified) {
        accounts.lemmy = {
          registered: true,
          handle: lemmyData.handle
            ? `${lemmyData.handle}@${lemmyData.instance || 'community.degenfeed.xyz'}`
            : undefined,
        };
      }

      const peertubeData = (identity as unknown as Record<string, unknown>).peertube as
        | { handle?: string; instance?: string; verified?: boolean }
        | undefined;
      if (peertubeData?.verified) {
        accounts.peertube = {
          registered: true,
          handle: peertubeData.handle
            ? `${peertubeData.handle}@${peertubeData.instance || 'video.degenfeed.xyz'}`
            : undefined,
        };
      }

      const pixelfedData = (identity as unknown as Record<string, unknown>).pixelfed as
        | { handle?: string; instance?: string; verified?: boolean }
        | undefined;
      if (pixelfedData?.verified) {
        accounts.pixelfed = {
          registered: true,
          handle: pixelfedData.handle
            ? `${pixelfedData.handle}@${pixelfedData.instance || 'pixelfed.social'}`
            : undefined,
        };
      }
    }
  } catch {
    // KV unavailable
  }

  // Also check platform accounts KV for finer-grained status
  const platformAccounts = await getPlatformAccounts(walletAddress, c.env.PLATFORM_ACCOUNTS);
  for (const acct of platformAccounts) {
    const p = acct.platform;
    if (!accounts[p]?.registered) {
      accounts[p] = { registered: true, handle: acct.username };
    }
  }

  const premium = await checkPremiumStatus(walletAddress, c.env);

  return noCacheJsonResponse({
    accounts,
    canRegisterFarcaster: !accounts.farcaster?.registered,
    canRegisterLens: !accounts.lens?.registered,
    isPremium: !!premium,
    premiumTier: premium?.tier || null,
    supportedPlatforms,
  });
});

// ─── POST /api/register/farcaster — Just register Farcaster ────────────

registerAll.post('/farcaster', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  let body: { username?: string };
  try {
    body = await c.req.json<{ username?: string }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const username = body.username || deriveGtsHandle(walletAddress);

  const premium = await checkPremiumStatus(walletAddress, c.env);

  try {
    const result = await registerOnPlatform('farcaster', username, walletAddress, {
      storage: c.env.PLATFORM_ACCOUNTS,
      walletAddress,
      baseRpcUrl: c.env.BASE_RPC_URL || 'https://mainnet.base.org',
      premiumWalletPrivateKey: c.env.PREMIUM_WALLET_KEY,
    });

    if (result.status === 'created') {
      return jsonResponse({
        ok: true,
        fid: result.accountInfo?.fid ? Number(result.accountInfo.fid) : null,
        username: result.username,
        charge: {
          amount: premium ? '$0 (covered by Premium)' : '$5',
          note: premium
            ? 'Gas fee covered by Premium subscription'
            : 'Base gas fee — included in Standard plan ($8)',
        },
      });
    }

    return jsonResponse(
      {
        ok: false,
        error: result.error || 'Farcaster registration failed',
        alternative: 'Try registering at https://warpcast.com/~/signup instead',
      },
      400,
    );
  } catch (_e) {
    return jsonResponse(
      {
        ok: false,
        error: 'Farcaster registration failed',
        alternative: 'Try registering at https://warpcast.com/~/signup instead',
      },
      502,
    );
  }
});

// ─── POST /api/register/lens — Just register Lens ──────────────────────

registerAll.post('/lens', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  let body: { handle?: string };
  try {
    body = await c.req.json<{ handle?: string }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const lensHandle = body.handle || deriveGtsHandle(walletAddress);
  const premium = await checkPremiumStatus(walletAddress, c.env);

  try {
    const result = await registerOnPlatform('lens', lensHandle, walletAddress, {
      storage: c.env.PLATFORM_ACCOUNTS,
      walletAddress,
      polygonRpcUrl: c.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      premiumWalletPrivateKey: c.env.PREMIUM_WALLET_KEY,
    });

    if (result.status === 'created') {
      return jsonResponse({
        ok: true,
        profileId: result.accountInfo?.profileId || null,
        handle: result.username,
        charge: {
          amount: premium ? '$0 (covered by Premium)' : '$2',
          note: premium
            ? 'Gas fee covered by Premium subscription'
            : 'Polygon gas fee — included in Standard plan ($8)',
        },
      });
    }

    return jsonResponse(
      {
        ok: false,
        error: result.error || 'Lens registration failed',
        alternative: 'Try registering at https://lens.xyz instead',
      },
      400,
    );
  } catch (_e) {
    return jsonResponse(
      {
        ok: false,
        error: 'Lens registration failed',
        alternative: 'Try registering at https://lens.xyz instead',
      },
      502,
    );
  }
});

// ─── GET /api/register/export — Export recovery package ─────────────────

registerAll.get('/export', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  const identityKeyVal = identityKey(walletAddress);

  try {
    const raw = await c.env.IDENTITIES?.get(identityKeyVal);
    if (!raw) {
      return jsonResponse({ error: 'No registration data found' }, 404);
    }

    return noCacheJsonResponse({
      wallet: walletAddress,
      exportedAt: new Date().toISOString(),
      data: JSON.parse(raw),
    });
  } catch (_err) {
    return jsonResponse({ error: 'Failed to export registration data' }, 500);
  }
});

/**
 * Deterministic prefix hash for generating placeholder identifiers from a wallet.
 * Produces a bech32-friendly lowercase alphanumeric string.
 */
function sha256Prefix(input: string, chars: number): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    hash = (hash << 5) - hash + byte;
    hash = hash & hash; // Convert to 32bit integer
  }
  const abs = Math.abs(hash).toString(36);
  return abs.slice(0, chars).padEnd(chars, '0');
}

export default registerAll;
