/**
 * @degenfeed/api-worker — Identity routes
 *
 * GET  /api/identity/resolve          — Resolve a handle to a protocol identity (existing)
 * POST /api/identity/link             — Link a protocol identity to an authenticated wallet
 * DELETE /api/identity/link           — Unlink a protocol identity from the authenticated wallet
 * GET  /api/identity/profile          — Get all linked identities for a wallet address (public)
 */

import { resolveHandle } from '@degenfeed/identity';
import type { CrossProtocolIdentity } from '@degenfeed/utils';
import { identityKey } from '@degenfeed/utils';
import { type Env, jsonResponse, noCacheJsonResponse } from '../index';
import { requireSession } from '../session';

// ─── Existing: resolve a handle ───────────────────────────────────────

export async function handleResolveIdentity(request: Request, env: Env): Promise<Response> {
  const handle = new URL(request.url).searchParams.get('handle');
  if (!handle) {
    return jsonResponse({ error: 'Missing handle parameter' }, 400);
  }

  // Check KV cache first (5 minute TTL for resolved handles)
  const cacheKey = `resolve:${encodeURIComponent(handle.toLowerCase())}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return jsonResponse({ data: parsed, cached: true });
    }
  } catch {
    /* cache miss or unavailable — proceed */
  }

  const result = await resolveHandle(handle);
  if (!result) {
    return jsonResponse({ error: 'Handle not found', handle }, 404);
  }

  // Cache the result (5 min TTL)
  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 300,
    });
  } catch {
    /* cache write failure is non-fatal */
  }

  return jsonResponse({ data: result });
}

// ─── Link a protocol identity to the authenticated wallet ────────────

export async function handleLinkIdentity(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;

  let body: {
    protocol: string;
    identity: Record<string, unknown>;
  };
  try {
    body = (await request.json()) as {
      protocol: string;
      identity: Record<string, unknown>;
    };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.protocol || !body.identity) {
    return jsonResponse({ error: 'Missing protocol or identity fields' }, 400);
  }

  const validProtocols = [
    'nostr',
    'farcaster',
    'lens',
    'bluesky',
    'mastodon',
    'reddit',
    'lemmy',
    'threads',
    'rss',
    'peertube',
    'atproto',
    'zora',
    'telegram',
  ];
  if (!validProtocols.includes(body.protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${body.protocol}` }, 400);
  }

  // Validate and normalize the identity payload per protocol
  const normalizedIdentity = validateProtocolIdentity(body.protocol, body.identity);
  if (!normalizedIdentity) {
    return jsonResponse({ error: `Invalid identity data for protocol: ${body.protocol}` }, 400);
  }

  // Fetch existing identity record from KV
  const key = identityKey(walletAddress);
  let existing: CrossProtocolIdentity | null = null;
  try {
    const raw = await env.IDENTITIES?.get(key);
    if (raw) existing = JSON.parse(raw) as CrossProtocolIdentity;
  } catch {
    // No existing record — create fresh
  }

  const now = Date.now();
  const updated: CrossProtocolIdentity = {
    ...(existing || { walletAddress, linkedAt: now, lastVerified: now }),
    [body.protocol]: { ...normalizedIdentity, verified: false },
    lastVerified: now,
  };

  try {
    await env.IDENTITIES?.put(key, JSON.stringify(updated));
  } catch (err) {
    return jsonResponse({ error: `Failed to store identity: ${String(err)}` }, 500);
  }

  const protocolKey = body.protocol as keyof CrossProtocolIdentity;
  return jsonResponse({
    success: true,
    protocol: body.protocol,
    identity: updated[protocolKey],
  });
}

// ─── Unlink a protocol identity from the authenticated wallet ────────

export async function handleUnlinkIdentity(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  const walletAddress = session.address;
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol');

  if (!protocol) {
    return jsonResponse({ error: 'Missing protocol parameter' }, 400);
  }

  const validProtocols = [
    'nostr',
    'farcaster',
    'lens',
    'bluesky',
    'mastodon',
    'reddit',
    'lemmy',
    'threads',
    'rss',
    'peertube',
    'atproto',
    'zora',
    'telegram',
  ];
  if (!validProtocols.includes(protocol)) {
    return jsonResponse({ error: `Unsupported protocol: ${protocol}` }, 400);
  }

  const key = identityKey(walletAddress);
  try {
    const raw = await env.IDENTITIES?.get(key);
    if (!raw) {
      return jsonResponse({ error: 'No identity record found' }, 404);
    }
    const existing = JSON.parse(raw) as CrossProtocolIdentity;

    // Remove the protocol field from the record
    const updated: CrossProtocolIdentity = { ...existing };
    delete (updated as unknown as Record<string, unknown>)[protocol];
    updated.lastVerified = Date.now();

    await env.IDENTITIES?.put(key, JSON.stringify(updated));
  } catch (err) {
    return jsonResponse({ error: `Failed to unlink identity: ${String(err)}` }, 500);
  }

  return jsonResponse({ success: true, protocol });
}

// ─── Get all linked identities for a wallet (public) ─────────────────

export async function handleGetIdentityProfile(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');

  if (!wallet) {
    return jsonResponse({ error: 'Missing wallet parameter' }, 400);
  }

  const key = identityKey(wallet);
  try {
    const raw = await env.IDENTITIES?.get(key);
    if (!raw) {
      return jsonResponse({ data: null, wallet }, 200);
    }
    const identity = JSON.parse(raw) as CrossProtocolIdentity;
    return noCacheJsonResponse({ data: identity, wallet });
  } catch (err) {
    return jsonResponse({ error: `Failed to read identity: ${String(err)}` }, 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

interface NostrIdentityInput {
  npub?: string;
  relays?: string[];
  pubkey?: string;
}
interface FarcasterIdentityInput {
  fid?: number;
  username?: string;
  custodyAddress?: string;
}
interface LensIdentityInput {
  profileId?: string;
  handle?: string;
}
interface BlueskyIdentityInput {
  did?: string;
  handle?: string;
}
interface MastodonIdentityInput {
  handle?: string;
  instance?: string;
}
interface RedditIdentityInput {
  username?: string;
}
interface LemmyIdentityInput {
  username?: string;
  instance?: string;
}
interface ThreadsIdentityInput {
  username?: string;
}
interface RssIdentityInput {
  url?: string;
}
interface PeerTubeIdentityInput {
  username?: string;
  channelId?: string;
  instance?: string;
}
interface AtprotoIdentityInput {
  did?: string;
  handle?: string;
  pdsUrl?: string;
}
interface ZoraIdentityInput {
  coinAddress?: string;
  network?: string;
}
interface TelegramIdentityInput {
  userId?: string;
  username?: string;
  chatId?: string;
}

function validateProtocolIdentity(
  protocol: string,
  data: Record<string, unknown>,
):
  | NostrIdentityInput
  | FarcasterIdentityInput
  | LensIdentityInput
  | BlueskyIdentityInput
  | MastodonIdentityInput
  | RedditIdentityInput
  | LemmyIdentityInput
  | ThreadsIdentityInput
  | RssIdentityInput
  | PeerTubeIdentityInput
  | AtprotoIdentityInput
  | ZoraIdentityInput
  | TelegramIdentityInput
  | null {
  // Extract optional manualLinking flag from all inputs
  const manualLinking = Boolean(data.manualLinking);

  switch (protocol) {
    case 'nostr': {
      const npub = String(data.npub || '');
      const pubkey = String(data.pubkey || '');
      if (!npub && !pubkey) return null;
      return {
        npub: npub || `npub1${pubkey.slice(0, 8)}...`,
        relays: Array.isArray(data.relays) ? data.relays.map(String) : [],
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'farcaster': {
      const fid = Number(data.fid);
      const username = String(data.username || '');
      const custodyAddress = String(data.custodyAddress || '');
      if (!fid || !username) return null;
      return {
        fid,
        username,
        custodyAddress,
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'lens': {
      const profileId = String(data.profileId || '');
      const handle = String(data.handle || '');
      if (!profileId && !handle) return null;
      return {
        profileId,
        handle,
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'bluesky': {
      const did = String(data.did || '');
      const handle = String(data.handle || '');
      if (!did && !handle) return null;
      return { did, handle, ...(manualLinking ? { manualLinking: true } : {}) };
    }
    case 'mastodon': {
      const handle = String(data.handle || '');
      const instance = String(data.instance || '');
      if (!handle) return null;
      return {
        handle,
        instance: instance || 'social.degenfeed.xyz',
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'reddit': {
      const username = String(data.username || '');
      if (!username) return null;
      return { username, ...(manualLinking ? { manualLinking: true } : {}) };
    }
    case 'lemmy': {
      const username = String(data.username || '');
      const instance = String(data.instance || '');
      if (!username) return null;
      return {
        username,
        instance: instance || 'community.degenfeed.xyz',
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'threads': {
      const username = String(data.username || '');
      const did = String(data.did || '');
      if (!username && !did) return null;
      return {
        username,
        ...(did ? { did } : {}),
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'rss': {
      const url = String(data.url || '');
      if (!url) return null;
      return { url, ...(manualLinking ? { manualLinking: true } : {}) };
    }
    case 'peertube': {
      const username = String(data.username || '');
      const channelId = String(data.channelId || '');
      const instance = String(data.instance || '');
      if (!username && !channelId) return null;
      return {
        username,
        channelId,
        instance: instance || 'video.degenfeed.xyz',
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'atproto': {
      const did = String(data.did || '');
      const handle = String(data.handle || '');
      if (!did && !handle) return null;
      return {
        did,
        handle,
        pdsUrl: String(data.pdsUrl || 'https://pds.degenfeed.xyz'),
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'zora': {
      const coinAddress = String(data.coinAddress || '');
      if (!coinAddress) return null;
      return {
        coinAddress,
        network: String(data.network || 'base'),
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    case 'telegram': {
      const userId = String(data.userId || '');
      if (!userId) return null;
      return {
        userId,
        username: String(data.username || ''),
        chatId: String(data.chatId || ''),
        ...(manualLinking ? { manualLinking: true } : {}),
      };
    }
    default:
      return null;
  }
}
