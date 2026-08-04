/**
 * @degenfeed/api-worker — Protocol Account Creation Routes
 *
 * Creates accounts on each self-hosted protocol instance and links them
 * to the user's wallet.
 *
 * Routes:
 *   POST /api/protocol/mastodon/register    — GoToSocial account
 *   POST /api/protocol/peertube/register    — PeerTube account
 *   POST /api/protocol/lemmy/register       — Lemmy account
 *   POST /api/protocol/pixelfed/register    — Pixelfed account
 *   POST /api/protocol/writefreely/register — WriteFreely account
 *   POST /api/protocol/bookwyrm/register    — BookWyrm account
 *   POST /api/protocol/mobilizon/register   — Mobilizon account
 *   POST /api/protocol/funkwhale/register   — Funkwhale account
 *   GET  /api/protocol/status               — Get all protocol accounts
 *   POST /api/protocol/join-all             — Create all accounts at once
 *
 * Each route:
 *   1. Validates the session
 *   2. Validates the desired username
 *   3. Creates the account via the self-hosted instance API
 *   4. Stores encrypted credentials in PLATFORM_ACCOUNTS KV
 *   5. Auto-links the identity in IDENTITIES KV
 *   6. Returns the new account info
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
import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { log } from '../index';
import { sealForWallet } from '../lib/crypto-seal';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────

const USERNAME_REGEX = /^[a-zA-Z0-9_\-.]{2,30}$/;

interface ProtocolDef {
  id: string;
  label: string;
  icon: string;
  color: string;
  instanceUrl: string;
  requiresPremium: boolean;
}

const SELF_HOSTED_PROTOCOLS: ProtocolDef[] = [
  {
    id: 'mastodon',
    label: 'GoToSocial (Mastodon)',
    icon: '🐘',
    color: '#6364ff',
    instanceUrl: 'https://social.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'peertube',
    label: 'PeerTube',
    icon: '▶️',
    color: '#f2691d',
    instanceUrl: 'https://video.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    icon: '🔮',
    color: '#4a8c6f',
    instanceUrl: 'https://community.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'pixelfed',
    label: 'Pixelfed',
    icon: '📷',
    color: '#f5a623',
    instanceUrl: 'https://pixelfed.social',
    requiresPremium: false,
  },
  {
    id: 'writefreely',
    label: 'WriteFreely',
    icon: '✍️',
    color: '#2eaadc',
    instanceUrl: 'https://blog.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'bookwyrm',
    label: 'BookWyrm',
    icon: '📚',
    color: '#4a8c6f',
    instanceUrl: 'https://books.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'mobilizon',
    label: 'Mobilizon',
    icon: '📅',
    color: '#f15a22',
    instanceUrl: 'https://events.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'funkwhale',
    label: 'Funkwhale',
    icon: '🎵',
    color: '#f2691d',
    instanceUrl: 'https://music.degenfeed.xyz',
    requiresPremium: false,
  },
];

const SELF_HOSTED_IDS = new Set(SELF_HOSTED_PROTOCOLS.map((p) => p.id));

// ─── Route: POST /api/protocol/:protocol/register ─────────────────────

export async function handleProtocolRegister(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  // Parse protocol name from URL path: /api/protocol/{protocol}/register
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // pathParts = ['api', 'protocol', '{protocol}', 'register']
  const protocol = pathParts[2];

  if (!protocol || !SELF_HOSTED_IDS.has(protocol)) {
    return jsonResponse(
      {
        error: `Unsupported protocol: ${protocol}. Supported: ${[...SELF_HOSTED_IDS].join(', ')}`,
      },
      400,
    );
  }

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  // Parse body
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

  // Check premium if required
  const protoDef = SELF_HOSTED_PROTOCOLS.find((p) => p.id === protocol)!;
  if (protoDef.requiresPremium) {
    const { checkPremiumStatus } = await import('../premium');
    const tier = await checkPremiumStatus(walletAddress, env);
    if (!tier) {
      return jsonResponse(
        {
          error: `Premium subscription required to create a ${protoDef.label} account.`,
          upgrade: true,
        },
        402,
      );
    }
  }

  // Register on the protocol
  const result = await registerOnProtocol(protocol, desiredUsername, walletAddress, env);

  // Auto-link identity
  if (result.status === 'created' && result.accountInfo) {
    await autoLinkIdentity(protocol, result.accountInfo, walletAddress, env);
  }

  log('info', 'Protocol account creation', {
    protocol,
    wallet: walletAddress.slice(0, 8),
    status: result.status,
    username: result.username,
  });

  const statusCode = result.status === 'created' ? 201 : result.status === 'failed' ? 400 : 202;
  return jsonResponse({ data: result }, statusCode);
}

// ─── Route: GET /api/protocol/status ────────────────────────────────

export async function handleProtocolStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  const accounts = await getPlatformAccounts(walletAddress, env.PLATFORM_ACCOUNTS);

  const protocolStatus: Record<
    string,
    {
      registered: boolean;
      username: string | null;
      profileUrl: string | null;
      label: string;
      icon: string;
      color: string;
    }
  > = {};

  for (const proto of SELF_HOSTED_PROTOCOLS) {
    protocolStatus[proto.id] = {
      registered: false,
      username: null,
      profileUrl: null,
      label: proto.label,
      icon: proto.icon,
      color: proto.color,
    };
  }

  for (const acct of accounts) {
    const id = acct.platform;
    if (id in protocolStatus) {
      const info = acct.accountInfo;
      protocolStatus[id] = {
        ...protocolStatus[id],
        registered: true,
        username: acct.username || null,
        profileUrl:
          info?.profileUrl ||
          (info?.username
            ? `${SELF_HOSTED_PROTOCOLS.find((p) => p.id === id)?.instanceUrl || ''}/@${info.username}`
            : null),
      };
    }
  }

  return noCacheJsonResponse({
    data: {
      protocols: protocolStatus,
      connectedCount: accounts.filter((a) => SELF_HOSTED_IDS.has(a.platform)).length,
      totalPlatforms: SELF_HOSTED_PROTOCOLS.length,
    },
  });
}

// ─── Route: POST /api/protocol/join-all ─────────────────────────────

export async function handleJoinAll(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: { username?: string; platforms?: string[] };
  try {
    body = (await request.json()) as { username?: string; platforms?: string[] };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const desiredUsername = body.username || `df${walletAddress.slice(2, 8)}`;
  if (!USERNAME_REGEX.test(desiredUsername)) {
    return jsonResponse({ error: 'Invalid username format' }, 400);
  }

  // Determine which platforms to join (default: all free self-hosted)
  const platformFilter = body.platforms;
  const targets = SELF_HOSTED_PROTOCOLS.filter(
    (p) => !platformFilter || platformFilter.includes(p.id),
  );

  // Check premium for any that require it
  const premiumRequired = targets.some((p) => p.requiresPremium);
  if (premiumRequired) {
    const { checkPremiumStatus } = await import('../premium');
    const tier = await checkPremiumStatus(walletAddress, env);
    if (!tier) {
      return jsonResponse(
        {
          error: 'Premium subscription required for some of these platforms.',
          upgrade: true,
        },
        402,
      );
    }
  }

  // Create accounts in parallel
  const results = await Promise.allSettled(
    targets.map(async (proto) => {
      const result = await registerOnProtocol(proto.id, desiredUsername, walletAddress, env);
      if (result.status === 'created' && result.accountInfo) {
        await autoLinkIdentity(proto.id, result.accountInfo, walletAddress, env);
      }
      return { protocol: proto.id, ...result };
    }),
  );

  const summary = results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      protocol: 'unknown',
      platform: 'unknown' as const,
      status: 'failed' as const,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  const created = summary.filter((r) => r.status === 'created').length;
  const failed = summary.filter((r) => r.status === 'failed').length;
  const pending = summary.filter((r) => r.status === 'pending').length;

  log('info', 'Join-all account creation', {
    wallet: walletAddress.slice(0, 8),
    created,
    failed,
    pending,
    total: summary.length,
  });

  return jsonResponse(
    {
      data: {
        summary,
        totals: { created, failed, pending, total: summary.length },
        username: desiredUsername,
      },
    },
    201,
  );
}

// ─── Registration Dispatcher ──────────────────────────────────────────

async function registerOnProtocol(
  protocol: string,
  username: string,
  walletAddress: string,
  env: Env,
) {
  const opts = {
    walletAddress,
    storage: env.PLATFORM_ACCOUNTS,
    sealSecret: (plaintext: string) => sealForWallet(env, plaintext, walletAddress, 'protocol-key'),
    mastodonInstanceUrl: env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
    lemmyInstanceUrl: env.LEMMY_INSTANCE_URL || 'https://community.degenfeed.xyz',
    peertubeInstanceUrl: env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz',
    pixelfedInstanceUrl: env.PIXELFED_INSTANCE_URL || 'https://pixelfed.social',
  };

  switch (protocol) {
    case 'mastodon':
      return registerMastodon(username, walletAddress, opts);
    case 'peertube':
      return registerPeerTube(username, walletAddress, opts);
    case 'lemmy':
      return registerLemmyWrapper(username, walletAddress, opts);
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
        error: `Unsupported protocol: ${protocol}`,
      };
  }
}

async function registerLemmyWrapper(
  username: string,
  walletAddress: string,
  opts: Record<string, unknown>,
) {
  const { registerLemmy } = await import('@degenfeed/crossplatform-register');
  return registerLemmy(username, walletAddress, opts);
}

// ─── Identity Auto-Linking ─────────────────────────────────────────────

async function autoLinkIdentity(
  protocol: string,
  accountInfo: Record<string, string>,
  walletAddress: string,
  env: Env,
): Promise<void> {
  try {
    const payload = buildIdentityPayload(protocol, accountInfo);
    if (!payload) return;

    const key = identityKey(walletAddress);
    let existing: CrossProtocolIdentity | null = null;
    const raw = await env.IDENTITIES?.get(key);
    if (raw) existing = JSON.parse(raw) as CrossProtocolIdentity;

    const now = Date.now();
    const updated: CrossProtocolIdentity = {
      ...(existing || { walletAddress, linkedAt: now, lastVerified: now }),
      [protocol]: payload,
      lastVerified: now,
    };

    await env.IDENTITIES?.put(key, JSON.stringify(updated));
    log('info', 'Identity auto-linked after protocol account creation', {
      protocol,
      wallet: walletAddress.slice(0, 8),
    });
  } catch (linkErr) {
    log('warn', 'Failed to auto-link identity', {
      protocol,
      error: linkErr instanceof Error ? linkErr.message : String(linkErr),
    });
  }
}

function buildIdentityPayload(
  protocol: string,
  info: Record<string, string>,
): Record<string, unknown> | null {
  switch (protocol) {
    case 'mastodon':
      return {
        handle: info.username || info.accountId || '',
        instance: info.instance || 'social.degenfeed.xyz',
        verified: false,
      };
    case 'peertube':
      return {
        handle: info.username || '',
        instance: info.instance || 'video.degenfeed.xyz',
        userId: info.userId || '',
        verified: false,
      };
    case 'lemmy':
      return {
        handle: info.username || '',
        instance: info.instance || 'community.degenfeed.xyz',
        verified: false,
      };
    case 'pixelfed':
      return {
        handle: info.username || '',
        instance: info.instance || 'pixelfed.social',
        verified: false,
      };
    case 'writefreely':
      return {
        handle: info.username || '',
        instance: 'blog.degenfeed.xyz',
        profileUrl: info.profileUrl || '',
        verified: false,
      };
    case 'bookwyrm':
      return {
        handle: info.username || '',
        instance: 'books.degenfeed.xyz',
        profileUrl: info.profileUrl || '',
        verified: false,
      };
    case 'mobilizon':
      return {
        handle: info.username || '',
        instance: 'events.degenfeed.xyz',
        profileUrl: info.profileUrl || '',
        verified: false,
      };
    case 'funkwhale':
      return {
        handle: info.username || '',
        instance: 'music.degenfeed.xyz',
        profileUrl: info.profileUrl || '',
        verified: false,
      };
    default:
      return null;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function getSelfHostedProtocols(): ProtocolDef[] {
  return [...SELF_HOSTED_PROTOCOLS];
}

export { SELF_HOSTED_IDS, SELF_HOSTED_PROTOCOLS };
