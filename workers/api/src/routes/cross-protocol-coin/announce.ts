/**
 * @degenfeed/api-worker — Cross-Protocol Creator Coin Announcements
 *
 * Announce coin launches across Farcaster, Nostr, Bluesky, Lens, Threads, Mastodon.
 */

import { hexToBytes } from '@noble/hashes/utils';
import type { Env } from '../../types';

// ─── Dispatch ──────────────────────────────────────────────────────────────

/**
 * Announce a coin launch on the creator's native protocol.
 */
export async function announceCoinLaunch(opts: {
  protocol: string;
  creator: string;
  coinSymbol: string;
  coinAddress: string;
  zoraUrl: string;
  degenfeedUrl: string;
  env: Env;
  creatorId: string;
}): Promise<Record<string, unknown> | null> {
  const message =
    `I just launched $${opts.coinSymbol} on DegenFeed!\n\n` +
    `My creator coin is now live and visible across Zora, Base, Solana, and all protocols.\n\n` +
    `Join me: ${opts.degenfeedUrl}\n` +
    `Zora: ${opts.zoraUrl}`;

  switch (opts.protocol) {
    case 'farcaster':
      return postFarcasterCast(opts.creator, opts.creatorId, message, opts.degenfeedUrl, opts.env);
    case 'nostr':
      return publishNostrEvent(opts.creatorId, message, opts.env);
    case 'bluesky':
      return postBluesky(opts.creatorId, message.slice(0, 300), opts.degenfeedUrl, opts.env);
    case 'lens':
      return postLensPublication(opts.creatorId, message, opts.env);
    case 'threads':
      return postThreads(opts.creatorId, message, opts.env);
    case 'mastodon':
    case 'activitypub':
      return postActivityPub(opts.creatorId, message, opts.env);
    default:
      return null;
  }
}

// ─── Farcaster ─────────────────────────────────────────────────────────────

async function postFarcasterCast(
  _creatorWallet: string,
  creatorId: string,
  text: string,
  _linkUrl: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const fid = Number(creatorId);
  if (!fid || !Number.isFinite(fid)) return null;

  try {
    const botSignerHex = (env as Record<string, string | undefined>).FARCASTER_BOT_SIGNER_KEY;
    const botFid = Number((env as Record<string, string | undefined>).FARCASTER_BOT_FID || 0);
    if (botSignerHex && botFid) {
      const { buildFarcasterCastMessage, HubClient } = await import('@degenfeed/farcaster-sdk');

      const castResult = buildFarcasterCastMessage({
        signerKeyHex: botSignerHex,
        fid: botFid,
        text,
      });

      if (!castResult.ok || !castResult.messageHex) {
        console.warn('[cross-protocol-coin] Failed to build cast message:', castResult.error);
        return null;
      }

      const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
      const hub = new HubClient(hubUrl);
      const messageBytes = hexToBytes(castResult.messageHex);
      const messageArray = new Uint8Array(messageBytes);
      await hub.submitMessage(messageArray.buffer as ArrayBuffer);

      return { ok: true, protocol: 'farcaster', hubUrl, method: 'direct' };
    }

    return null;
  } catch (err) {
    console.warn('[cross-protocol-coin] Farcaster cast failed:', String(err));
    return null;
  }
}

// ─── Nostr ─────────────────────────────────────────────────────────────────

async function publishNostrEvent(
  _pubkey: string,
  text: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const privateKeyHex = env.NOSTR_PRIVATE_KEY;
  if (!privateKeyHex) return null;

  try {
    const { createTextNote } = await import('@degenfeed/nostr-sdk');
    const signed = createTextNote(text, privateKeyHex, [
      ['t', 'degenfeed'],
      ['t', 'creatorcoin'],
      ['r', 'https://app.degenfeed.xyz'],
    ]);

    const relayUrls = [
      ...(env.RELAY_URLS?.split(',').map((u) => u.trim()) || []),
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
    ].filter(Boolean);

    const publishedRelays: string[] = [];
    const failedRelays: string[] = [];

    // Method 1: RelayPool WebSocket
    try {
      const { RelayPool } = await import('@degenfeed/nostr-sdk');
      const pool = new RelayPool(relayUrls, {
        connectTimeout: 3000,
        eoseTimeout: 2000,
        maxReconnects: 0,
        logLevel: 'error',
      });

      await new Promise<void>((resolve) => {
        const check = () => {
          const connected = pool.getConnectedRelays().length;
          if (connected > 0 || Date.now() - start > 3000) resolve();
          else setTimeout(check, 100);
        };
        const start = Date.now();
        setTimeout(check, 500);
      });

      pool.publish(signed, {
        onOk: (relayUrl) => {
          if (!publishedRelays.includes(relayUrl)) publishedRelays.push(relayUrl);
        },
        onError: (relayUrl) => {
          if (!failedRelays.includes(relayUrl)) failedRelays.push(relayUrl);
        },
      });

      await new Promise((r) => setTimeout(r, 1500));
      for (const url of pool.getConnectedRelays()) {
        pool.removeRelay(url);
      }
    } catch {
      // WebSocket pool failed — fall through to HTTP
    }

    // Method 2: HTTP relay publish
    const httpRelays = relayUrls
      .filter((u) => u.startsWith('wss://'))
      .map((ws) => `https://${ws.slice(6)}`);

    for (const httpUrl of httpRelays) {
      try {
        const res = await fetch(httpUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(['EVENT', signed]),
        });
        if (res.ok && !publishedRelays.includes(httpUrl)) {
          publishedRelays.push(httpUrl);
        }
      } catch {
        // HTTP publish not supported
      }
    }

    return {
      ok: publishedRelays.length > 0,
      eventId: signed.id,
      protocol: 'nostr',
      relays: publishedRelays.length,
      publishedRelays,
      failedRelays,
    };
  } catch (err) {
    console.warn('[cross-protocol-coin] Nostr publish failed:', String(err));
    return null;
  }
}

// ─── Bluesky ───────────────────────────────────────────────────────────────

async function postBluesky(
  _did: string,
  text: string,
  _linkUrl: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const bskyDid = env.BSKY_DID;
  const bskyPassword = env.PREMIUM_WALLET_KEY;
  if (!bskyDid || !bskyPassword) return null;

  try {
    const { PdsClient } = await import('@degenfeed/bluesky-sdk');
    const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
    const client = new PdsClient(pdsUrl);
    await client.createSession(bskyDid, bskyPassword);
    const result = await client.createPost({ text, langs: ['en'] });

    return { ok: true, uri: result.uri, cid: result.cid, protocol: 'bluesky' };
  } catch (err) {
    console.warn('[cross-protocol-coin] Bluesky post failed:', String(err));
    return null;
  }
}

// ─── Lens ──────────────────────────────────────────────────────────────────

async function postLensPublication(
  profileId: string,
  text: string,
  _env: Env,
): Promise<Record<string, unknown> | null> {
  if (!profileId) return null;

  try {
    const { LensClient } = await import('@degenfeed/lens-sdk');
    const client = new LensClient();
    await client.comment(profileId, text);
    return { ok: true, profileId, protocol: 'lens' };
  } catch (err) {
    console.warn('[cross-protocol-coin] Lens post failed:', String(err));
    return null;
  }
}

// ─── Threads ────────────────────────────────────────────────────────────────

async function postThreads(
  _userId: string,
  text: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const threadsToken = env.THREADS_APP_SECRET;
  const threadsUserId = env.THREADS_APP_ID;
  if (!threadsToken || !threadsUserId) return null;

  try {
    const { ThreadsClient } = await import('@degenfeed/threads-sdk');
    const client = new ThreadsClient(threadsToken, threadsUserId);
    const creationId = await client.createThread(text);
    const mediaId = await client.publishThread(creationId);
    return { ok: true, mediaId, protocol: 'threads' };
  } catch (err) {
    console.warn('[cross-protocol-coin] Threads post failed:', String(err));
    return null;
  }
}

// ─── Mastodon / ActivityPub ────────────────────────────────────────────────

async function postActivityPub(
  _accountId: string,
  text: string,
  env: Env,
): Promise<Record<string, unknown> | null> {
  const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = env.PREMIUM_WALLET_KEY;
  if (!accessToken) return null;

  try {
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instanceUrl, accessToken);
    const status = await client.publish(text, { visibility: 'public' });
    return { ok: true, statusId: status.id, url: status.url, protocol: 'mastodon' };
  } catch (err) {
    console.warn('[cross-protocol-coin] Mastodon post failed:', String(err));
    return null;
  }
}
