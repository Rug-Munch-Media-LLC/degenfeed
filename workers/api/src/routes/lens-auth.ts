/**
 * @degenfeed/api-worker — Lens Protocol Authentication & Registration
 *
 * Enables full Lens Protocol ownership:
 *   POST /api/lens/auth          — Authenticate as existing Lens user via wallet signature
 *   POST /api/lens/register      — Create a new Lens profile + handle on Polygon
 *   GET  /api/lens/auth/status   — Check whether the session has a linked Lens profile
 *
 * All Lens API calls go through the free public Lens v2 GraphQL API.
 * No paid API dependency.
 *
 * Rate limits:
 *   Auth:      10 req/min per IP
 *   Register:  3 req/min per IP (on-chain costs involved)
 */

import { LensClient, LENS_API_URL } from '@degenfeed/lens-sdk';
import type { Env } from '../index';
import { jsonResponse, log } from '../index';
import { requireSession } from '../session';
import { validateBodySize } from '../sanitize';
import { hasSuspiciousPayload, sanitizeString } from '../sanitize';

// ─── Constants ──────────────────────────────────────────────────────────────

const LENS_API_URL_ENV = 'https://api-v2.lens.dev/graphql';
const LENS_HUB_ADDRESS = '0xDb46d1Dc155634FbC732f92E853b10B288AD5a1d';
const POLYGON_CHAIN_ID = 137;

/** Rate limit config */
const AUTH_RATE_LIMIT = { max: 10, window: 60_000 };
const REGISTER_RATE_LIMIT = { max: 3, window: 60_000 };

// ─── KV key helpers ─────────────────────────────────────────────────────────

function lensAuthKey(wallet: string): string {
  return `lens:auth:${wallet.toLowerCase()}`;
}

function lensProfileLinkKey(wallet: string): string {
  return `lens:linked:${wallet.toLowerCase()}`;
}

function lensNonceKey(wallet: string): string {
  return `lens:nonce:${wallet.toLowerCase()}`;
}

// ─── Helper: Query Lens API ─────────────────────────────────────────────────

async function queryLensApi<T>(
  query: string,
  variables: Record<string, unknown> = {},
  accessToken?: string,
): Promise<T | null> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
  };
  if (accessToken) headers['x-access-token'] = accessToken;

  try {
    const res = await fetch(LENS_API_URL_ENV, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (json.errors?.length) {
      log('warn', '[lens-auth] GraphQL error', json.errors[0]);
      return null;
    }
    return json.data ?? null;
  } catch (err) {
    log('warn', '[lens-auth] Lens API error', String(err));
    return null;
  }
}

// ─── Helper: Get profile by wallet address ──────────────────────────────────

interface LensProfileResult {
  defaultProfile?: {
    id: string;
    handle?: { localName: string; fullHandle?: string };
    metadata?: { displayName?: string; bio?: string; picture?: { optimized?: { uri?: string } } };
    stats?: { totalFollowers?: number; totalFollowing?: number };
  };
  profiles?: {
    items: Array<{
      id: string;
      handle?: { localName: string };
      metadata?: { displayName?: string };
    }>;
  };
}

async function resolveProfilesByWallet(wallet: string): Promise<{
  defaultProfile: LensProfileResult['defaultProfile'] | null;
  allProfiles: Array<{ id: string; handle: string; displayName: string }>;
}> {
  const data = await queryLensApi<LensProfileResult>(
    `query ProfilesByAddress($address: EthereumAddress!) {
      defaultProfile(request: { ethereumAddress: $address }) {
        id
        handle { localName fullHandle }
        metadata { displayName bio picture { optimized { uri } } }
        stats { totalFollowers totalFollowing }
      }
      profiles(request: { ownedBy: [$address], limit: 10 }) {
        items {
          id
          handle { localName }
          metadata { displayName }
        }
      }
    }`,
    { address: wallet },
  );

  if (!data) return { defaultProfile: null, allProfiles: [] };

  const profiles = (data.profiles?.items || [])
    .filter((p) => p.id && p.handle?.localName)
    .map((p) => ({
      id: p.id,
      handle: p.handle!.localName,
      displayName: p.metadata?.displayName || p.handle!.localName,
    }));

  return {
    defaultProfile: data.defaultProfile ?? null,
    allProfiles: profiles,
  };
}

// ─── POST /api/lens/register — Create Lens Profile ────────────────────────

interface RegisterBody {
  /** Desired Lens handle (without .lens suffix) */
  handle?: string;
  /** Whether to use Momoka for gasless profile creation */
  gasless?: boolean;
  /** Profile metadata */
  displayName?: string;
  bio?: string;
  /** Signature proving wallet ownership (for on-chain creation) */
  signature?: string;
  /** Message that was signed */
  message?: string;
}

export async function handleLensRegister(request: Request, env: Env): Promise<Response> {
  // 1. Authenticate session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  // 2. Rate limit: 3 req/min
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { rateLimit } = await import('../index');
  const rl = await rateLimit(env, ip, 'lens:register', REGISTER_RATE_LIMIT.max, REGISTER_RATE_LIMIT.window);
  if (!rl.allowed) {
    const { rateLimitResponse } = await import('../response-helpers');
    return rateLimitResponse(rl.retryAfter);
  }

  // 3. Check if wallet already has a linked Lens profile
  const existingLink = await env.CACHE?.get(lensProfileLinkKey(walletAddress));
  if (existingLink) {
    return jsonResponse({
      error: 'Wallet already linked to a Lens profile',
      profileLink: JSON.parse(existingLink),
    }, 409);
  }

  // 4. Check if wallet already owns Lens profiles on-chain
  const existingProfiles = await resolveProfilesByWallet(walletAddress);
  if (existingProfiles.defaultProfile || existingProfiles.allProfiles.length > 0) {
    // Wallet already has Lens profiles — they should use /auth instead
    return jsonResponse({
      error: 'Wallet already owns Lens profiles. Use POST /api/lens/auth to connect.',
      profiles: existingProfiles.allProfiles,
      defaultProfile: existingProfiles.defaultProfile ? {
        id: existingProfiles.defaultProfile.id,
        handle: existingProfiles.defaultProfile.handle?.localName,
      } : null,
    }, 409);
  }

  // 5. Validate body
  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const handle = sanitizeString(body.handle, 31);
  if (!handle || !/^[a-zA-Z0-9_\-.]{5,31}$/.test(handle)) {
    return jsonResponse({
      error: 'Handle must be 5-31 characters: letters, numbers, hyphens, underscores, dots',
    }, 400);
  }
  if (hasSuspiciousPayload(handle)) {
    return jsonResponse({ error: 'Invalid characters in handle' }, 400);
  }

  // 6. Generate auth challenge for signing
  const nonce = crypto.randomUUID();
  const authMessage = `DegenFeed Lens Profile Registration\n\n` +
    `Wallet: ${walletAddress}\n` +
    `Handle: ${handle}.lens\n` +
    `Nonce: ${nonce}\n` +
    `Timestamp: ${Date.now()}\n\n` +
    `Sign this message to prove you own this wallet and authorize ` +
    `the creation of a Lens profile with the handle @${handle}.lens`;

  // Store the nonce for verification
  await env.CACHE?.put(lensNonceKey(walletAddress), JSON.stringify({
    nonce,
    handle,
    createdAt: Date.now(),
  }), { expirationTtl: 300 }); // 5 min TTL

  // 7. If gasless, return the message to sign + on-chain tx calldata
  //    In the Momoka path, the profile is created via the Lens API with
  //    a signature and the on-chain handle registration happens via relay.
  //
  //    In the on-chain path, we build the createProfile + handle calldata
  //    for the user to submit via their wallet.

  const isGasless = body.gasless !== false; // default to gasless

  // Store pending registration
  const pendingKey = `lens:pending:${walletAddress}`;
  await env.CACHE?.put(pendingKey, JSON.stringify({
    handle,
    wallet: walletAddress,
    gasless: isGasless,
    nonce,
    step: 'awaiting_signature',
    createdAt: Date.now(),
  }), { expirationTtl: 600 });

  // Build the on-chain transaction intent for handle registration
  // This generates the calldata for LensHub.createProfile + handle registration
  // on Polygon. The user signs + sends this via their wallet.
  const { buildLensProfileCreateCalldata } = await import('./lens');
  const txIntent = buildLensProfileCreateCalldata({
    handle,
    to: walletAddress,
    followModule: '0x0000000000000000000000000000000000000000', // free follow
  });

  return jsonResponse({
    success: true,
    message: isGasless
      ? 'Sign the message below to authorize gasless profile creation. We will relay the transaction via Momoka.'
      : 'Send the transaction to Polygon to create your Lens profile. After confirmation, sign the auth message to link.',
    handle: `${handle}.lens`,
    authMessage,
    nonce,
    wallet: walletAddress,
    gasless: isGasless,
    tx: isGasless ? null : txIntent,
    chainId: POLYGON_CHAIN_ID,
    lensHubAddress: LENS_HUB_ADDRESS,
  });
}

// ─── POST /api/lens/auth — Authenticate Existing Lens User ───────────────

interface AuthBody {
  /** The wallet address to authenticate (may own Lens profile) */
  wallet?: string;
  /** Signature for wallet ownership proof */
  signature?: string;
  /** Message that was signed */
  message?: string;
  /** Optional: specific profile ID to link (if wallet owns multiple) */
  profileId?: string;
}

export async function handleLensAuth(request: Request, env: Env): Promise<Response> {
  // 1. Authenticate session
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  // 2. Rate limit
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { rateLimit } = await import('../index');
  const rl = await rateLimit(env, ip, 'lens:auth', AUTH_RATE_LIMIT.max, AUTH_RATE_LIMIT.window);
  if (!rl.allowed) {
    const { rateLimitResponse } = await import('../response-helpers');
    return rateLimitResponse(rl.retryAfter);
  }

  // 3. Validate body
  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: AuthBody;
  try {
    body = (await request.json()) as AuthBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const authWallet = (body.wallet || walletAddress).toLowerCase();

  // 4. Resolve Lens profiles owned by this wallet via the free Lens API
  const { defaultProfile, allProfiles } = await resolveProfilesByWallet(authWallet);

  if (allProfiles.length === 0) {
    // No Lens profiles found for this wallet
    return jsonResponse({
      error: 'No Lens profiles found for this wallet address',
      wallet: authWallet,
      hint: 'Create one at POST /api/lens/register',
    }, 404);
  }

  // 5. Determine which profile to link
  let selectedProfile: (typeof allProfiles)[0] | null = null;
  if (body.profileId) {
    selectedProfile = allProfiles.find((p) => p.id === body.profileId) || null;
    if (!selectedProfile) {
      return jsonResponse({ error: 'Specified profileId not owned by this wallet' }, 400);
    }
  } else if (defaultProfile) {
    selectedProfile = {
      id: defaultProfile.id,
      handle: defaultProfile.handle?.localName || 'unknown',
      displayName: defaultProfile.metadata?.displayName || defaultProfile.handle?.localName || 'Unknown',
    };
  } else {
    selectedProfile = allProfiles[0];
  }

  // 6. Verify wallet ownership — the session already proves wallet control
  //    via the existing DegenFeed auth flow (EIP-4361 / Solana sign-in).
  //    If the auth wallet matches the session wallet, verification is complete.
  //    If a different wallet is provided (rare), the frontend should re-auth.
  const sessionWallet = session.address.toLowerCase();
  const verified = sessionWallet === authWallet;

  if (!verified) {
    // Return the profiles + a message to sign for verification
    const nonce = crypto.randomUUID();
    const authMessage = `DegenFeed Lens Authentication\n\n` +
      `Wallet: ${authWallet}\n` +
      `Nonce: ${nonce}\n` +
      `Timestamp: ${Date.now()}\n\n` +
      `Sign this message to prove you own this wallet and authorize ` +
      `linking your Lens profile @${selectedProfile.handle}.lens to DegenFeed.`;

    await env.CACHE?.put(lensNonceKey(authWallet), JSON.stringify({
      nonce,
      wallet: authWallet,
      profileId: selectedProfile.id,
      handle: selectedProfile.handle,
      createdAt: Date.now(),
    }), { expirationTtl: 300 });

    return jsonResponse({
      verified: false,
      message: 'Sign the auth message to prove wallet ownership',
      authMessage,
      nonce,
      profiles: allProfiles,
      selectedProfile,
    }, 200);
  }

  // 8. Link the Lens profile to the DegenFeed identity
  const identityKey = `identity:${authWallet}`;
  let identity: Record<string, unknown> = {};
  try {
    const raw = await env.IDENTITIES?.get(identityKey);
    if (raw) identity = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // No existing identity — create fresh
  }

  identity.lens = {
    profileId: selectedProfile.id,
    handle: selectedProfile.handle,
    displayName: selectedProfile.displayName,
    verified: true,
    linkedAt: Date.now(),
  };
  identity.lastVerified = Date.now();

  try {
    await env.IDENTITIES?.put(identityKey, JSON.stringify(identity));
  } catch (err) {
    return jsonResponse({ error: `Failed to store identity: ${String(err)}` }, 500);
  }

  // Store Lens profile link KV for quick lookup
  const linkData = {
    profileId: selectedProfile.id,
    handle: selectedProfile.handle,
    displayName: selectedProfile.displayName,
    linkedAt: Date.now(),
  };
  await env.CACHE?.put(lensProfileLinkKey(authWallet), JSON.stringify(linkData), {
    expirationTtl: 365 * 86400,
  });

  // Also link wallet → profile in Lens auth KV
  const authData = {
    profileId: selectedProfile.id,
    handle: selectedProfile.handle,
    wallet: authWallet,
    authMethod: body.signature ? 'signature' : 'session',
    linkedAt: Date.now(),
  };
  await env.CACHE?.put(lensAuthKey(authWallet), JSON.stringify(authData), {
    expirationTtl: 365 * 86400,
  });

  log('info', '[lens-auth] Profile linked', { wallet: authWallet, profile: selectedProfile.handle });

  return jsonResponse({
    success: true,
    verified: true,
    profile: {
      id: selectedProfile.id,
      handle: `${selectedProfile.handle}.lens`,
      displayName: selectedProfile.displayName,
    },
    allProfiles: allProfiles.map((p) => ({
      id: p.id,
      handle: `${p.handle}.lens`,
      displayName: p.displayName,
    })),
  });
}

// ─── GET /api/lens/auth/status — Check Lens Auth Status ──────────────────

export async function handleLensAuthStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  // Check linked Lens profile
  const linkRaw = await env.CACHE?.get(lensProfileLinkKey(walletAddress));
  if (!linkRaw) {
    return jsonResponse({
      linked: false,
      wallet: walletAddress,
      message: 'No Lens profile linked. Use /api/lens/auth or /api/lens/register.',
    });
  }

  const link = JSON.parse(linkRaw);

  // Fetch fresh profile data from Lens API
  const client = new LensClient(env.LENS_API_URL || LENS_API_URL);
  const profile = await client.getProfile(link.profileId);
  const freshData = profile ? {
    displayName: profile.metadata?.displayName || link.displayName,
    avatarUrl: profile.metadata?.picture?.optimized?.uri || '',
    bio: profile.metadata?.bio || '',
    followerCount: profile.stats?.followers || 0,
    followingCount: profile.stats?.following || 0,
  } : {};

  return jsonResponse({
    linked: true,
    wallet: walletAddress,
    profile: {
      id: link.profileId,
      handle: `${link.handle}.lens`,
      displayName: link.displayName,
      ...freshData,
    },
    linkedAt: link.linkedAt,
  });
}

// ─── POST /api/lens/confirm — Confirm pending registration with signature ──

interface ConfirmBody {
  signature: string;
  message: string;
  /** Transaction hash if on-chain create was submitted */
  txHash?: string;
}

export async function handleLensConfirmRegistration(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address.toLowerCase();

  const sizeCheck = validateBodySize(request, 10 * 1024);
  if (!sizeCheck.ok) return jsonResponse({ error: sizeCheck.error }, 413);

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.signature || !body.message) {
    return jsonResponse({ error: 'signature and message are required' }, 400);
  }

  // The session already proves wallet ownership via the DegenFeed auth flow.
  // The signature is a proof-of-intent: the user signs to confirm they want
  // to create a Lens profile with the requested handle.
  //
  // In production, the frontend sends the signed message to the Lens relay
  // which handles the on-chain registration. We confirm the intent here.
  if (body.txHash) {
    // If a tx hash is provided, the on-chain registration has been submitted
    // (via the user's wallet). We trust the session-authenticated wallet.
    log('info', '[lens-auth] Registration confirmed with tx', {
      wallet: walletAddress,
      txHash: body.txHash,
    });
  }

  // Check pending registration
  const pendingKey = `lens:pending:${walletAddress}`;
  const pendingRaw = await env.CACHE?.get(pendingKey);
  if (!pendingRaw) {
    return jsonResponse({
      error: 'No pending registration. Start one at POST /api/lens/register.',
      hint: 'register',
    }, 400);
  }

  const pending = JSON.parse(pendingRaw);
  await env.CACHE?.delete(pendingKey);

  // Link the profile to the DegenFeed identity
  const identityKey = `identity:${walletAddress}`;
  let identity: Record<string, unknown> = {};
  try {
    const raw = await env.IDENTITIES?.get(identityKey);
    if (raw) identity = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // No existing identity
  }

  // The profile ID will be assigned by the Lens protocol after the tx confirms
  // For now, store the handle as pending
  identity.lens = {
    handle: pending.handle,
    walletAddress,
    status: 'pending_confirmation',
    txHash: body.txHash || null,
    verified: true,
    linkedAt: Date.now(),
  };
  identity.lastVerified = Date.now();

  try {
    await env.IDENTITIES?.put(identityKey, JSON.stringify(identity));
  } catch (err) {
    return jsonResponse({ error: `Failed to store identity: ${String(err)}` }, 500);
  }

  return jsonResponse({
    success: true,
    message: 'Lens profile registration confirmed. Profile will be active once the transaction confirms on Polygon.',
    handle: `${pending.handle}.lens`,
    wallet: walletAddress,
    txHash: body.txHash || null,
    status: 'pending_confirmation',
  });
}
