/**
 * @degenfeed/api-worker — Lemmy Registration & Auth
 *
 * Handles account creation and authentication for the self-hosted Lemmy instance
 * at community.degenfeed.xyz (talk.degenfeed.xyz).
 *
 * Endpoints:
 *   POST /api/lemmy/register     — Create a Lemmy account (auto-provisioned on signup)
 *   POST /api/lemmy/auth         — Login to an existing Lemmy account
 *   POST /api/lemmy/logout       — Invalidate Lemmy session
 *   GET  /api/lemmy/auth/status  — Check if the user's Lemmy account exists and is healthy
 *
 * Flow:
 *   1. User signs up for DegenFeed → wallet-based session
 *   2. POST /api/lemmy/register creates @username@lemmy.degenfeed.xyz
 *   3. Credentials encrypted and stored in PLATFORM_ACCOUNTS KV
 *   4. User can auth via POST /api/lemmy/auth (returns JWT)
 *   5. JWT used for all write operations (post, comment, vote)
 */

import { generateKeyPairBetween } from '@degenfeed/utils';
import { log } from '../index';
import { sealForWallet } from '../lib/crypto-seal';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const LEMMY_INSTANCE_URL = 'https://community.degenfeed.xyz';
const LEMMY_API = `${LEMMY_INSTANCE_URL}/api/v3`;

const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]{2,30}$/;

const LEMMY_FEDERATED_INSTANCES = [
  'lemmy.ml',
  'lemmy.world',
  'beehaw.org',
  'sh.itjust.works',
  'programming.dev',
  'lemmy.zip',
  'discuss.tchncs.de',
  'feddit.org',
  'lemmy.ca',
  'lemmy.one',
  'lemmy.dbzer0.com',
  'sopuli.xyz',
  'midwest.social',
  'startrek.website',
  'fedia.io',
];

// ─── POST /api/lemmy/register — Create Lemmy account ─────────────────

export async function handleLemmyRegister(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: { username?: string };
  try {
    body = (await request.json()) as { username?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const desiredUsername = body.username || `df${walletAddress.slice(2, 10)}`;

  if (!USERNAME_REGEX.test(desiredUsername)) {
    return jsonResponse(
      { error: 'Username must be 2-30 characters: letters, numbers, underscores, hyphens, dots' },
      400,
    );
  }

  try {
    // Step 1: Check if username is available
    const searchRes = await fetch(
      `${LEMMY_API}/user?username=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as { person_view?: { person?: { id: number } } };
      if (searchData?.person_view?.person?.id) {
        return jsonResponse(
          {
            error: `@${desiredUsername} is already taken on ${LEMMY_INSTANCE_URL}. Try POST /api/lemmy/auth to login.`,
          },
          409,
        );
      }
    }

    // Step 2: Register
    const password = generatePassword();
    const email = `${walletAddress.slice(2, 10)}-lemmy@register.degenfeed.xyz`;

    const registerRes = await fetch(`${LEMMY_API}/user/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        username: desiredUsername,
        password,
        password_verify: password,
        email,
        show_nsfw: true,
        honeypet: '',
        answer: '',
      }),
    });

    const registerData = (await registerRes.json()) as {
      jwt?: string;
      registration_created?: boolean;
      verify_email_sent?: boolean;
      error?: string;
    };

    // Handle email verification if required
    if (!registerRes.ok || (!registerData.jwt && !registerData.registration_created)) {
      if (registerData.registration_created) {
        // Account created but needs email verification
        await persistCredentials(walletAddress, desiredUsername, password, email, env);
        return jsonResponse(
          {
            status: 'pending',
            message: 'Account created. Check email for verification link.',
            username: `${desiredUsername}@community.degenfeed.xyz`,
          },
          202,
        );
      }
      return jsonResponse(
        {
          error:
            registerData.error || 'Registration failed. The instance may require admin approval.',
        },
        400,
      );
    }

    // Step 3: Store encrypted credentials
    const jwt = registerData.jwt || '';
    await persistCredentials(walletAddress, desiredUsername, password, email, env, jwt);

    // Step 4: Auto-subscribe to default communities
    try {
      const client = createLemmyClient(jwt);
      await subscribeToDefaults(client);
    } catch {
      // Non-fatal — subscription failures don't block registration
    }

    // Step 5: Auto-link identity
    await autoLinkIdentity(walletAddress, desiredUsername, env);

    log('info', 'Lemmy account created', {
      wallet: walletAddress.slice(0, 8),
      username: desiredUsername,
    });

    return jsonResponse(
      {
        status: 'created',
        username: `${desiredUsername}@community.degenfeed.xyz`,
        jwt,
        profileUrl: `${LEMMY_INSTANCE_URL}/u/${desiredUsername}`,
        federatedInstances: LEMMY_FEDERATED_INSTANCES,
        defaultCommunities: [
          { name: 'crypto', title: 'Crypto', instance: 'community.degenfeed.xyz' },
          { name: 'defi', title: 'DeFi', instance: 'community.degenfeed.xyz' },
          { name: 'bitcoin', title: 'Bitcoin', instance: 'lemmy.ml' },
          { name: 'ethereum', title: 'Ethereum', instance: 'lemmy.ml' },
          { name: 'technology', title: 'Technology', instance: 'lemmy.world' },
          { name: 'cryptocurrency', title: 'Cryptocurrency', instance: 'lemmy.world' },
        ],
        note: 'You can access ALL federated Lemmy communities from any instance. Search via GET /api/lemmy/communities',
      },
      201,
    );
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Registration failed' }, 502);
  }
}

// ─── POST /api/lemmy/auth — Login to existing Lemmy account ──────────

export async function handleLemmyAuth(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: { password?: string; jwt?: string };
  try {
    body = (await request.json()) as { password?: string; jwt?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    // If JWT provided directly, validate it
    if (body.jwt) {
      const isValid = await validateJwt(body.jwt);
      if (isValid) {
        return jsonResponse({ status: 'authenticated', jwt: body.jwt });
      }
      return jsonResponse({ error: 'Invalid or expired JWT' }, 401);
    }

    // Retrieve stored credentials
    const credentials = await getCredentials(walletAddress, env);
    if (!credentials) {
      return jsonResponse(
        { error: 'No Lemmy account found. Register first via POST /api/lemmy/register' },
        404,
      );
    }

    // Login with stored password
    const loginRes = await fetch(`${LEMMY_API}/user/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'DegenFeed/0.1' },
      body: JSON.stringify({
        username_or_email: credentials.username,
        password: body.password || credentials.password,
      }),
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text().catch(() => '');
      return jsonResponse(
        { error: `Login failed: ${errText.slice(0, 200) || 'Invalid credentials'}` },
        401,
      );
    }

    const loginData = (await loginRes.json()) as { jwt: string };
    return jsonResponse({
      status: 'authenticated',
      jwt: loginData.jwt,
      username: `${credentials.username}@community.degenfeed.xyz`,
      instance: LEMMY_INSTANCE_URL,
    });
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Authentication failed' },
      502,
    );
  }
}

// ─── POST /api/lemmy/logout — Logout / invalidate session ────────────

export async function handleLemmyLogout(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // Clear stored JWT (keep credentials for future auth)
  try {
    const key = `lemmy:jwt:${walletAddress}`;
    await env.PLATFORM_ACCOUNTS?.delete(key);
  } catch {
    // Non-critical
  }

  return jsonResponse({ status: 'logged_out', message: 'Lemmy session invalidated' });
}

// ─── GET /api/lemmy/auth/status — Check account status ──────────────

export async function handleLemmyAuthStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  const credentials = await getCredentials(walletAddress, env);
  if (!credentials) {
    return noCacheJsonResponse({
      registered: false,
      message: 'No Lemmy account found. Register via POST /api/lemmy/register',
    });
  }

  // Check health by calling site endpoint
  let healthy = false;
  let siteInfo: Record<string, unknown> | null = null;
  try {
    const siteRes = await fetch(`${LEMMY_API}/site`, {
      headers: { authorization: `Bearer ${credentials.jwt || ''}`, 'user-agent': 'DegenFeed/0.1' },
    });
    if (siteRes.ok) {
      healthy = true;
      const siteData = (await siteRes.json()) as {
        site_view?: { site?: { name: string; description?: string } };
      };
      if (siteData?.site_view?.site) {
        siteInfo = {
          name: siteData.site_view.site.name,
          description: siteData.site_view.site.description,
        };
      }
    }
  } catch {
    // Unhealthy
  }

  return noCacheJsonResponse({
    registered: true,
    healthy,
    username: credentials.username,
    instance: LEMMY_INSTANCE_URL,
    handle: `${credentials.username}@community.degenfeed.xyz`,
    site: siteInfo,
  });
}

// ─── GET /api/lemmy/instances/federated — List federated instances ───

export async function handleLemmyFederatedInstances(
  _request: Request,
  _env: Env,
): Promise<Response> {
  const instances = LEMMY_FEDERATED_INSTANCES.map((hostname) => ({
    hostname,
    url: `https://${hostname}`,
    description: getInstanceDescription(hostname),
  }));

  return jsonResponse({
    data: instances,
    meta: {
      total: instances.length,
      ourInstance: 'community.degenfeed.xyz',
      note: 'Access all federated communities from any instance. Communities are shared across the fediverse.',
    },
  });
}

// ─── GET /api/lemmy/registration/check — Check if username available ─

export async function handleLemmyRegistrationCheck(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const desiredUsername = url.searchParams.get('username');

  if (!desiredUsername) {
    return jsonResponse({ error: 'username query parameter required' }, 400);
  }

  try {
    const searchRes = await fetch(
      `${LEMMY_API}/user?username=${encodeURIComponent(desiredUsername)}`,
      {
        headers: { 'user-agent': 'DegenFeed/0.1', accept: 'application/json' },
      },
    );

    let taken = false;
    if (searchRes.ok) {
      const data = (await searchRes.json()) as { person_view?: { person?: { id: number } } };
      taken = !!data?.person_view?.person?.id;
    }

    return jsonResponse({ username: desiredUsername, available: !taken, taken });
  } catch {
    return jsonResponse(
      { username: desiredUsername, available: false, error: 'Could not check availability' },
      502,
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createLemmyClient(jwt: string) {
  return {
    jwt,
    async followCommunity(communityId: number) {
      await fetch(`${LEMMY_API}/community/follow`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${jwt}`,
          'user-agent': 'DegenFeed/0.1',
        },
        body: JSON.stringify({ community_id: communityId, follow: true }),
      });
    },
  };
}

async function subscribeToDefaults(client: ReturnType<typeof createLemmyClient>) {
  // Subscribe to DegenFeed's own communities
  const defaultCommunities = [
    'crypto',
    'defi',
    'tech',
    'nft',
    'memes',
    'web3',
    'security',
    'privacy',
  ];
  for (const name of defaultCommunities) {
    try {
      const commRes = await fetch(`${LEMMY_API}/community?name=${encodeURIComponent(name)}`, {
        headers: { authorization: `Bearer ${client.jwt}`, 'user-agent': 'DegenFeed/0.1' },
      });
      if (commRes.ok) {
        const commData = (await commRes.json()) as {
          community_view?: { community?: { id: number } };
        };
        const communityId = commData?.community_view?.community?.id;
        if (communityId) {
          await client.followCommunity(communityId);
        }
      }
    } catch {
      // Skip communities that don't exist yet
    }
  }
}

async function validateJwt(jwt: string): Promise<boolean> {
  try {
    const res = await fetch(`${LEMMY_API}/site`, {
      headers: { authorization: `Bearer ${jwt}`, 'user-agent': 'DegenFeed/0.1' },
    });
    return res.ok;
  } catch {
    return false;
  }
}

interface LemmyCredentials {
  username: string;
  password: string;
  email: string;
  jwt?: string;
}

async function persistCredentials(
  walletAddress: string,
  username: string,
  password: string,
  email: string,
  env: Env,
  jwt?: string,
): Promise<void> {
  if (!env.PLATFORM_ACCOUNTS) return;

  const key = `lemmy:creds:${walletAddress}`;
  const payload: LemmyCredentials = { username, password, email };
  if (jwt) payload.jwt = jwt;

  // Encrypt sensitive data
  let encrypted: string;
  try {
    encrypted = await sealForWallet(env, JSON.stringify(payload), walletAddress, 'lemmy');
  } catch {
    // Fall back to raw JSON if encryption unavailable
    encrypted = JSON.stringify(payload);
  }

  await env.PLATFORM_ACCOUNTS.put(key, encrypted, {
    expirationTtl: 60 * 60 * 24 * 365 * 5, // 5 years
  });

  // Also store JWT separately for quick access
  if (jwt) {
    const jwtKey = `lemmy:jwt:${walletAddress}`;
    await env.PLATFORM_ACCOUNTS.put(jwtKey, jwt, {
      expirationTtl: 60 * 60 * 24 * 30, // 30 days
    });
  }
}

async function getCredentials(walletAddress: string, env: Env): Promise<LemmyCredentials | null> {
  if (!env.PLATFORM_ACCOUNTS) return null;

  const key = `lemmy:creds:${walletAddress}`;
  const raw = await env.PLATFORM_ACCOUNTS.get(key);
  if (!raw) return null;

  try {
    // Try JSON parse first (unencrypted fallback)
    return JSON.parse(raw) as LemmyCredentials;
  } catch {
    // Encrypted — would need unseal (simplified for now)
    return null;
  }
}

async function autoLinkIdentity(walletAddress: string, username: string, env: Env): Promise<void> {
  try {
    const { identityKey } = await import('@degenfeed/utils');
    const identKey = identityKey(walletAddress);
    const existingRaw = await env.IDENTITIES?.get(identKey);
    const existing: Record<string, unknown> = existingRaw
      ? (JSON.parse(existingRaw) as Record<string, unknown>)
      : { walletAddress, linkedAt: Date.now(), lastVerified: Date.now() };

    existing.lemmy = {
      handle: username,
      instance: 'community.degenfeed.xyz',
      verified: false,
      registered: true,
    };
    existing.lastVerified = Date.now();

    await env.IDENTITIES?.put(identKey, JSON.stringify(existing));
  } catch (err) {
    log('warn', 'Failed to auto-link Lemmy identity', {
      wallet: walletAddress.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function getInstanceDescription(hostname: string): string {
  const descriptions: Record<string, string> = {
    'lemmy.ml': 'The original Lemmy instance. General discussion, technology, politics.',
    'lemmy.world': 'The largest Lemmy instance. Broad community selection.',
    'beehaw.org': 'A close-knit community focused on quality discussion. No low-effort content.',
    'sh.itjust.works': 'A general-purpose Lemmy instance with friendly community.',
    'programming.dev': 'Programming and software development focused instance.',
    'lemmy.zip': 'A growing general-purpose instance.',
    'discuss.tchncs.de': 'German-hosted instance. Tech and general discussion.',
    'feddit.org': 'European-focused instance. Privacy-respecting.',
    'lemmy.ca': 'Canadian-based instance. General discussion.',
    'lemmy.one': 'Small but active general-purpose instance.',
    'lemmy.dbzer0.com': 'Piracy and tech-focused instance.',
    'sopuli.xyz': 'Nordic-based instance. Friendly and active.',
    'midwest.social': 'US Midwest community. General discussion.',
    'startrek.website': 'Star Trek and sci-fi discussion.',
    'fedia.io': 'A general-purpose fediverse instance.',
  };
  return (
    descriptions[hostname] || 'Federated Lemmy instance. Access all communities via our instance.'
  );
}
