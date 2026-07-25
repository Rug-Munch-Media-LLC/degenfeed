/**
 * @degenfeed/api-worker — Cross-Platform Stream Announcement System
 *
 * When a creator goes live, announce it to ALL their linked protocols.
 * Each protocol runs independently — one failure never blocks others.
 *
 * Supports: ActivityPub (Mastodon/GoToSocial), AT Protocol (Bluesky),
 * Nostr (Kind 30311 live events via NostrLiveBridge), Farcaster,
 * Lens, Telegram, RSS, Threads (via GoToSocial ActivityPub federation).
 *
 * Threads integration works through our GoToSocial instance:
 * Threads users who follow @degenfeed@social.degenfeed.xyz see our
 * stream announcements in their Threads feed with plain-text URLs.
 *
 * Uses the existing @degenfeed/* SDKs for real API calls.
 */

import { IdentityHub } from '@degenfeed/auth';
import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import { recordBridgeOperation, withReliability } from './bridge-reliability';

// ─── Reliability Helper ────────────────────────────────────────────────────

/**
 * Execute a stream announcement with reliability (retry + circuit breaker).
 */
async function reliableAnnounce<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    await recordBridgeOperation(env, protocol, true, Math.round(performance.now() - start));
    return result;
  } catch (err) {
    await recordBridgeOperation(
      env,
      protocol,
      false,
      Math.round(performance.now() - start),
      String(err),
    );
    throw err;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────

export type StreamType = 'live' | 'scheduled' | 'prerecorded';

export interface StreamAnnouncement {
  streamId: string;
  creator: string;
  creatorHandle: string;
  title: string;
  streamType: StreamType;
  streamUrl: string;
  thumbnail?: string;
}

export interface AnnouncementResult {
  ok: boolean;
  protocol: string;
  id?: string;
  url?: string;
  error?: string;
}

export interface AnnouncementResults {
  [protocol: string]: AnnouncementResult;
}

interface AnnouncementTexts {
  activityPub: string;
  nostr: {
    kind: number;
    content: string;
    tags: string[][];
  };
  atProtocol: {
    text: string;
    embed: {
      $type: string;
      external: {
        uri: string;
        title: string;
        description: string;
        thumb?: string;
      };
    };
  };
  farcaster: string;
  lens: string;
  telegram: string;
  rss: {
    title: string;
    description: string;
    enclosureUrl: string;
    enclosureType: string;
  };
  threads: string;
}

interface ProtocolAuth {
  handle: string;
  identifier: string;
  displayName?: string;
  /** Plaintext credential for this protocol (decrypted from IdentityHub) */
  credential?: string;
  /** Instance URL for federated protocols (ActivityPub, AT Protocol) */
  instanceUrl?: string;
  /** Protocol-specific numeric/user identifiers */
  fid?: number;
  did?: string;
  chatId?: string;
}

interface ResolvedCreatorIdentity {
  wallet: string;
  handle: string;
  linkedProtocols: string[];
  activitypub?: ProtocolAuth;
  atproto?: ProtocolAuth;
  nostr?: ProtocolAuth;
  farcaster?: ProtocolAuth;
  lens?: ProtocolAuth;
  telegram?: ProtocolAuth;
  rss?: ProtocolAuth;
  threads?: ProtocolAuth;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────

/**
 * Announce a stream to ALL linked protocols for a creator.
 *
 * Resolves the creator's linked protocol identities, builds
 * protocol-formatted announcements, and dispatches to every
 * protocol in parallel. One protocol failing never blocks the others.
 *
 * Returns a map of protocol → { ok, id, url, error }.
 */
export async function announceStreamToAllProtocols(
  env: Env,
  stream: StreamAnnouncement,
): Promise<AnnouncementResults> {
  const results: AnnouncementResults = {};

  let identity: ResolvedCreatorIdentity;
  try {
    identity = await resolveIdentity(env, stream.creator);
  } catch (err) {
    // If we can't even resolve the identity, mark every protocol as failed
    const msg = err instanceof Error ? err.message : String(err);
    for (const proto of [
      'activitypub',
      'atproto',
      'nostr',
      'farcaster',
      'lens',
      'telegram',
      'rss',
      'threads',
    ]) {
      results[proto] = {
        ok: false,
        protocol: proto,
        error: `Identity resolution failed: ${msg}`,
      };
    }
    return results;
  }

  const announcement = buildAnnouncement(stream);

  // Build protocol tasks only for linked protocols with available auth
  const tasks: Array<{
    protocol: string;
    fn: () => Promise<AnnouncementResult>;
  }> = [];

  if (identity.activitypub) {
    tasks.push({
      protocol: 'activitypub',
      fn: () => announceToActivityPub(env, identity.activitypub!, announcement),
    });
  }
  if (identity.atproto) {
    tasks.push({
      protocol: 'atproto',
      fn: () => announceToAtProtocol(env, identity.atproto!, announcement),
    });
  }
  if (identity.nostr) {
    tasks.push({
      protocol: 'nostr',
      fn: () => announceToNostr(env, identity.nostr!, announcement),
    });
  }
  if (identity.farcaster) {
    tasks.push({
      protocol: 'farcaster',
      fn: () => announceToFarcaster(env, identity.farcaster!, announcement),
    });
  }
  if (identity.lens) {
    tasks.push({
      protocol: 'lens',
      fn: () => announceToLens(env, identity.lens!, announcement),
    });
  }
  if (identity.telegram) {
    tasks.push({
      protocol: 'telegram',
      fn: () => announceToTelegram(env, identity.telegram!, announcement),
    });
  }

  // RSS is always available
  if (identity.rss) {
    tasks.push({
      protocol: 'rss',
      fn: () => announceToRss(env, identity.rss!, announcement),
    });
  }

  // Threads (Meta's Threads platform via ActivityPub federation)
  // Actual posting goes through GoToSocial ActivityPub path, but we
  // add a separate protocol record for tracking and reply polling.
  if (identity.threads || identity.activitypub) {
    tasks.push({
      protocol: 'threads',
      fn: () => announceToThreads(env, identity.activitypub!, announcement),
    });
  }

  if (tasks.length === 0) {
    // No linked protocols — nothing to announce
    return results;
  }

  // Run ALL in parallel with individual error handling
  await Promise.allSettled(
    tasks.map(async ({ protocol, fn }) => {
      try {
        const result = await fn();
        results[protocol] = result;
      } catch (err) {
        results[protocol] = {
          ok: false,
          protocol,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  // ── Fire real-time sync events for stream announcements ──────────
  fireStreamSyncEvents(stream, results, env).catch((err) =>
    console.error('[stream-announcer] realtime sync event failed:', err),
  );

  // ── Start cross-protocol chat bridge ──────────────────────────────
  // Bridges comments/replies from external protocol posts back into
  // the DegenFeed stream chat, labeled with "via {Protocol}".
  try {
    const { startBridge } = await import('./cross-protocol-chat-bridge');
    startBridge(env, stream.streamId, results);
  } catch (err) {
    console.error('[stream-announcer] failed to start chat bridge:', err);
  }

  return results;
}

/**
 * Fire real-time sync events for a stream announcement.
 * Propagates the stream status to all linked protocols.
 */
async function fireStreamSyncEvents(
  stream: StreamAnnouncement,
  results: AnnouncementResults,
  env: Env,
): Promise<void> {
  try {
    const { createEvent, onEvent } = await import('./realtime-sync');

    // For each successful announcement, create a sync event
    for (const [protocol, result] of Object.entries(results)) {
      if (!result.ok) continue;

      const proto = normalizeProtocolForACL(protocol);
      const _eventType =
        stream.streamType === 'live' ? 'stream_started' : ('stream_started' as const);

      const event = createEvent(
        proto as Protocol,
        'stream',
        result.id ?? stream.streamId,
        {
          id: stream.creator,
          handle: stream.creatorHandle,
        },
        {
          text: `${stream.title}`,
          subjectId: stream.streamId,
          streamTitle: stream.title,
          streamUrl: stream.streamUrl,
          raw: { streamType: stream.streamType, thumbnail: stream.thumbnail },
        },
      );

      onEvent(proto as Protocol, event, env).catch((e) =>
        console.error(`[stream-announcer] sync event failed for ${protocol}:`, e),
      );
    }
  } catch (e) {
    console.error('[stream-announcer] fireStreamSyncEvents error:', e);
  }
}

function normalizeProtocolForACL(p: string): string {
  if (p === 'activitypub' || p === 'mastodon') return 'mastodon';
  if (p === 'atproto' || p === 'bluesky') return 'bluesky';
  return p;
}

// ─── Identity Resolution ──────────────────────────────────────────────────

/**
 * Resolve a creator wallet address to linked protocol identities.
 *
 * Uses the IdentityHub to:
 *   1. Look up which protocols this wallet has linked
 *   2. Fetch per-protocol credentials (access tokens, keys)
 *   3. Build ProtocolAuth objects for each linked protocol
 *
 * Falls back to env-level bot credentials when per-creator credentials
 * are not available (e.g., TELEGRAM_BOT_TOKEN, NOSTR_PRIVATE_KEY).
 */
async function resolveIdentity(env: Env, creator: string): Promise<ResolvedCreatorIdentity> {
  if (!env.IDENTITIES) {
    throw new Error('IDENTITIES KV namespace is not bound');
  }

  const hub = new IdentityHub({ kv: env.IDENTITIES });
  const resolved = await hub.resolveWallet(creator);

  const identity: ResolvedCreatorIdentity = {
    wallet: creator.toLowerCase(),
    handle: '',
    linkedProtocols: [],
  };

  // ── ActivityPub (Mastodon / GoToSocial) ──────────────────────────
  const apInfo = resolved.protocols.mastodon;
  if (apInfo?.linked) {
    identity.linkedProtocols.push('activitypub');
    const creds = await hub.getCredentials(creator, 'mastodon' as Protocol);
    identity.activitypub = {
      handle: apInfo.handle || '',
      identifier: apInfo.identifier || '',
      displayName: apInfo.displayName,
      credential: creds?.encrypted ?? undefined,
      instanceUrl: env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz',
    };
  }

  // ── AT Protocol (Bluesky) ────────────────────────────────────────
  const bskyInfo = resolved.protocols.bluesky || resolved.protocols.atproto;
  if (bskyInfo?.linked) {
    identity.linkedProtocols.push('atproto');
    const creds = await hub.getCredentials(creator, 'bluesky' as Protocol);
    identity.atproto = {
      handle: bskyInfo.handle || '',
      identifier: bskyInfo.identifier || '',
      displayName: bskyInfo.displayName,
      credential: creds?.encrypted ?? undefined,
      did: bskyInfo.identifier,
      instanceUrl: env.BSKY_SOCIAL_URL || 'https://bsky.social',
    };
  }

  // ── Nostr ────────────────────────────────────────────────────────
  const nostrInfo = resolved.protocols.nostr;
  if (nostrInfo?.linked) {
    identity.linkedProtocols.push('nostr');
    const creds = await hub.getCredentials(creator, 'nostr' as Protocol);
    // Prefer per-creator nsec, fall back to server key
    identity.nostr = {
      handle: nostrInfo.handle || '',
      identifier: nostrInfo.identifier || '',
      displayName: nostrInfo.displayName,
      credential: creds?.encrypted ?? env.NOSTR_PRIVATE_KEY,
    };
  }

  // ── Farcaster ────────────────────────────────────────────────────
  const fcInfo = resolved.protocols.farcaster;
  if (fcInfo?.linked) {
    identity.linkedProtocols.push('farcaster');
    const creds = await hub.getCredentials(creator, 'farcaster' as Protocol);
    identity.farcaster = {
      handle: fcInfo.handle || '',
      identifier: fcInfo.identifier || '',
      displayName: fcInfo.displayName,
      credential: creds?.encrypted ?? undefined,
      fid: Number(fcInfo.identifier) || undefined,
    };
  }

  // ── Lens ─────────────────────────────────────────────────────────
  const lensInfo = resolved.protocols.lens;
  if (lensInfo?.linked) {
    identity.linkedProtocols.push('lens');
    const creds = await hub.getCredentials(creator, 'lens' as Protocol);
    identity.lens = {
      handle: lensInfo.handle || '',
      identifier: lensInfo.identifier || '',
      displayName: lensInfo.displayName,
      credential: creds?.encrypted ?? undefined,
    };
  }

  // ── Telegram ─────────────────────────────────────────────────────
  const tgInfo = resolved.protocols.telegram;
  if (tgInfo?.linked) {
    identity.linkedProtocols.push('telegram');
    const creds = await hub.getCredentials(creator, 'telegram' as Protocol);
    identity.telegram = {
      handle: tgInfo.handle || '',
      identifier: tgInfo.identifier || '',
      displayName: tgInfo.displayName,
      credential: creds?.encrypted ?? undefined,
      chatId: tgInfo.identifier || creds?.keyHint,
    };
  }

  // ── RSS ─────────────────────────────────────────────────────────
  // RSS is always available — no per-creator auth needed. We use the
  // server-level DegenFeed RSS feed to publish live stream items.
  identity.linkedProtocols.push('rss');
  identity.rss = {
    handle: 'degenfeed',
    identifier: 'https://app.degenfeed.xyz/feed/live/rss.xml',
  };

  // ── Threads / ActivityPub auto-federation ───────────────────────
  // Threads (Meta's fediverse platform) is reached via ActivityPub
  // federation. If the creator has a Threads-linked identity, we mark
  // them for Threads bridge. Actual posting happens through the
  // existing ActivityPub path since Threads speaks ActivityPub.
  const threadsInfo = resolved.protocols.threads;
  if (threadsInfo?.linked) {
    identity.linkedProtocols.push('threads');
  }

  // Derive a display handle if we have one
  const firstLinked =
    identity.activitypub ??
    identity.atproto ??
    identity.nostr ??
    identity.farcaster ??
    identity.lens ??
    identity.telegram;
  identity.handle = firstLinked?.handle || firstLinked?.identifier || creator.slice(0, 10);

  return identity;
}

// ─── Announcement Builder ────────────────────────────────────────────────

/**
 * Build protocol-formatted announcement texts from a StreamAnnouncement.
 *
 * Each protocol gets a tailored format:
 *   - ActivityPub: plain text with hashtags
 *   - Nostr: Kind 30311 live event with metadata tags
 *   - AT Protocol: text + external embed card
 *   - Farcaster: short text (320-char limit)
 *   - Lens: text with emoji
 *   - Telegram: HTML-formatted message
 */
function buildAnnouncement(stream: StreamAnnouncement): AnnouncementTexts {
  const base = `🔴 LIVE: ${stream.title}\n${stream.creatorHandle} is streaming on DegenFeed\n\nWatch: ${stream.streamUrl}`;

  const hashtagLive = 'live';
  const hashtagType = stream.streamType;
  const hashtagDf = 'degenfeed';

  return {
    activityPub: `${base}\n\n#${hashtagLive} #${hashtagType} #${hashtagDf}`,

    nostr: {
      kind: 30311,
      content: base,
      tags: [
        ['d', `degenfeed-${stream.streamId}`],
        ['title', stream.title],
        ['summary', `${stream.creatorHandle} is streaming on DegenFeed`],
        ['streaming', stream.streamUrl],
        ['t', hashtagLive],
        ['t', hashtagType],
        ['t', 'liveshort'],
        ['t', 'degenfeed'],
        ['r', stream.streamUrl],
        ...(stream.thumbnail ? [['image', stream.thumbnail]] : []),
        ['status', 'live'],
        ['current_participants', '1'],
        ['duration', '60'],
        ['p', stream.creator],
        ['relays', 'wss://relay.degenfeed.xyz'],
      ],
    },

    atProtocol: {
      text: `🔴 ${stream.title}\n\n${stream.creatorHandle} is live on DegenFeed!\n\n${stream.streamUrl}`.slice(
        0,
        300,
      ),
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: stream.streamUrl,
          title: stream.title,
          description: `Live ${stream.streamType} by ${stream.creatorHandle} on DegenFeed`,
          ...(stream.thumbnail ? { thumb: stream.thumbnail } : {}),
        },
      },
    },

    farcaster:
      `🔴 LIVE SHORT: ${stream.title}\n\n${stream.creatorHandle} is live on DegenFeed!\n\n⏱ 60s\n\n${stream.streamUrl}`.slice(
        0,
        320,
      ),

    lens: `🔴 ${stream.title}\n${stream.creatorHandle} is streaming on DegenFeed 🎥\n\n${stream.streamUrl}`,

    telegram: `<b>🔴 LIVE NOW</b>\n\n<b>${stream.title}</b>\n${stream.creatorHandle} is streaming!\n\n<a href="${stream.streamUrl}">Watch here</a>`,

    rss: {
      title: `🔴 LIVE: ${stream.title} — ${stream.creatorHandle} on DegenFeed`,
      description: `${stream.creatorHandle} is ${stream.streamType} on DegenFeed. Watch live: ${stream.streamUrl}`,
      enclosureUrl: stream.thumbnail || stream.streamUrl,
      enclosureType: stream.thumbnail ? 'image/jpeg' : 'text/html',
    },

    threads: `🔴 LIVE NOW: ${stream.title}\n\n${stream.creatorHandle} is streaming ${stream.streamType}\n\n📺 Watch: ${stream.streamUrl}\n\n#Live #${stream.streamType} #DegenFeed`,
  };
}

// ─── Protocol: ActivityPub (Mastodon / GoToSocial) ───────────────────────

/**
 * Announce the stream on the creator's ActivityPub feed.
 *
 * Uses GtSClient from @degenfeed/mastodon-sdk to post a status
 * with the stream announcement text and public visibility.
 */
async function announceToActivityPub(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const { GtSClient } = await import('@degenfeed/mastodon-sdk');

  const instanceUrl =
    identity.instanceUrl || env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = identity.credential;

  if (!accessToken) {
    return {
      ok: false,
      protocol: 'activitypub',
      error: 'No ActivityPub access token available for this creator',
    };
  }

  try {
    const result = await reliableAnnounce(
      'activitypub',
      async () => {
        const client = new GtSClient(instanceUrl, accessToken);
        const publishResult = await client.publish(announcement.activityPub, {
          visibility: 'public',
        });
        return publishResult;
      },
      env,
    );

    return {
      ok: true,
      protocol: 'activitypub',
      id: result.id,
      url: result.url,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'activitypub',
      error: `ActivityPub publish failed: ${msg}`,
    };
  }
}

// ─── Protocol: Nostr (Kind 30311 Live Event) ─────────────────────────────

/**
 * Announce the stream as a Nostr Kind 30311 live event.
 *
 * Builds the live event with stream metadata tags, signs it using
 * the creator's nsec (or server key), and publishes to the relay pool.
 */
async function announceToNostr(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const nostr = await import('@degenfeed/nostr-sdk');

  const nsec = identity.credential;
  if (!nsec) {
    return {
      ok: false,
      protocol: 'nostr',
      error: 'No Nostr private key available for this creator',
    };
  }

  try {
    const signedEvent = await reliableAnnounce(
      'nostr',
      async () => {
        const pubkey = nostr.getPublicKey(nsec);

        // Build Kind 30311 live event — per NIP-93 (formerly NIP-53 live streaming)
        const unsigned = {
          pubkey,
          created_at: Math.floor(Date.now() / 1000),
          kind: announcement.nostr.kind,
          tags: announcement.nostr.tags,
          content: announcement.nostr.content,
        };

        const signed = nostr.signEvent(unsigned, nsec);

        // Publish to the configured relay pool
        const relayUrls = (
          env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
        )
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean);

        const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
        await pool.publish(signed);
        pool.disconnectAll();
        return signed;
      },
      env,
    );

    return {
      ok: true,
      protocol: 'nostr',
      id: signedEvent.id,
      url: `nostr:${signedEvent.id}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'nostr',
      error: `Nostr publish failed: ${msg}`,
    };
  }
}

// ─── Protocol: AT Protocol (Bluesky) ──────────────────────────────────────

/**
 * Announce the stream on Bluesky via the creator's PDS.
 *
 * Creates an authenticated PdsClient session, then posts with an
 * external embed card pointing to the stream URL.
 */
async function announceToAtProtocol(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const { PdsClient } = await import('@degenfeed/bluesky-sdk');

  const pdsUrl = identity.instanceUrl || env.BSKY_SOCIAL_URL || 'https://bsky.social';
  const accessJwt = identity.credential;
  const did = identity.did || identity.identifier;

  if (!accessJwt) {
    return {
      ok: false,
      protocol: 'atproto',
      error: 'No Bluesky access JWT available for this creator',
    };
  }
  if (!did) {
    return {
      ok: false,
      protocol: 'atproto',
      error: 'No Bluesky DID available for this creator',
    };
  }

  try {
    const result = await reliableAnnounce(
      'atproto',
      async () => {
        const client = new PdsClient(pdsUrl);
        // Set auth directly for pre-authenticated calls
        (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
        (client as unknown as { did: string }).did = did;

        const { text, embed } = announcement.atProtocol;

        return client.createPost({
          text,
          embed: embed as {
            $type: 'app.bsky.embed.external';
            external: { uri: string; title: string; description: string };
          },
          langs: ['en'],
        });
      },
      env,
    );

    return {
      ok: true,
      protocol: 'atproto',
      id: result.uri,
      url: `https://bsky.app/profile/${did}/post/${result.uri.split('/').pop()}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'atproto',
      error: `Bluesky publish failed: ${msg}`,
    };
  }
}

// ─── Protocol: Farcaster ─────────────────────────────────────────────────

/**
 * Announce the stream on Farcaster.
 *
 * Builds and signs a cast message using the creator's signer key + FID,
 * then submits it to the configured Farcaster Hub.
 */
async function announceToFarcaster(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const { HubClient, buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');

  const signerKeyHex = identity.credential;
  const fid = identity.fid || Number(identity.identifier);

  if (!signerKeyHex) {
    return {
      ok: false,
      protocol: 'farcaster',
      error: 'No Farcaster signer key available for this creator',
    };
  }
  if (!fid || Number.isNaN(fid)) {
    return {
      ok: false,
      protocol: 'farcaster',
      error: 'No Farcaster FID available for this creator',
    };
  }

  try {
    const castHash = await reliableAnnounce(
      'farcaster',
      async () => {
        // Build and sign the cast
        const signed = buildFarcasterCastMessage({
          signerKeyHex,
          fid,
          text: announcement.farcaster,
        });

        if (!signed.ok || !signed.messageHex) {
          throw new Error(signed.error ?? 'Failed to build Farcaster cast message');
        }

        // Submit to Hub
        const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
        const client = new HubClient(hubUrl);
        await client.submitMessage(signed.messageHex);

        // Extract hash from the signed message for the cast ID
        return signed.messageHex.slice(0, 40);
      },
      env,
    );

    return {
      ok: true,
      protocol: 'farcaster',
      id: castHash,
      url: `https://warpcast.com/${identity.handle}/0x${castHash}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'farcaster',
      error: `Farcaster publish failed: ${msg}`,
    };
  }
}

// ─── Protocol: Lens ──────────────────────────────────────────────────────

/**
 * Announce the stream on Lens Protocol.
 *
 * Uses the LensClient GraphQL API to create a post with the
 * stream announcement text. Requires a valid Lens API access token.
 */
async function announceToLens(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const { LensClient } = await import('@degenfeed/lens-sdk');

  const accessToken = identity.credential;

  if (!accessToken) {
    return {
      ok: false,
      protocol: 'lens',
      error: 'No Lens API access token available for this creator',
    };
  }

  try {
    const apiUrl = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
    const client = new LensClient(apiUrl);
    client.setAuth(accessToken);

    // Create post via the Lens API
    const data = await client.request(
      `mutation CreatePost($request: CreatePostRequest!) {
        post(request: $request) {
          ... on RelayResult { txHash }
          ... on RelayError { reason }
        }
      }`,
      {
        request: {
          content: announcement.lens,
          locale: 'en',
        },
      },
    );

    const result = (data as Record<string, unknown>)?.post as Record<string, unknown> | undefined;
    const txHash = result?.txHash as string | undefined;

    if (!txHash) {
      return {
        ok: true,
        protocol: 'lens',
        error: (result?.reason as string) ?? 'Lens post created but no txHash returned',
      };
    }

    return {
      ok: true,
      protocol: 'lens',
      id: txHash,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'lens',
      error: `Lens publish failed: ${msg}`,
    };
  }
}

// ─── Protocol: RSS Feed Enclosure ──────────────────────────────────────────

/**
 * Announce the stream as an RSS feed item with enclosure.
 *
 * Adds the stream to the DegenFeed master RSS feed so any RSS
 * reader can pick it up. The enclosure field allows podcast
 * apps to treat streams as episodes.
 */
async function announceToRss(
  env: Env,
  _identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  try {
    const rssKey = 'rss:live:items';
    const rssEntry = {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: announcement.rss.title,
      description: announcement.rss.description,
      enclosureUrl: announcement.rss.enclosureUrl,
      enclosureType: announcement.rss.enclosureType,
      pubDate: new Date().toISOString(),
    };

    // Append to a live RSS items list in KV
    const existing = await env.CONTENT_STORE?.get(rssKey).catch(() => null);
    const items: Array<typeof rssEntry> = existing ? JSON.parse(existing) : [];
    items.unshift(rssEntry);
    // Keep only the 50 most recent items
    const trimmed = items.slice(0, 50);

    await env.CONTENT_STORE?.put(rssKey, JSON.stringify(trimmed), {
      expirationTtl: 86400 * 7,
    }).catch(() => {});

    // Also update the standard RSS feed cache
    const rssFeedKey = 'feed:rss:live';
    await env.CONTENT_STORE?.put(rssFeedKey, JSON.stringify(trimmed), {
      expirationTtl: 86400,
    }).catch(() => {});

    return {
      ok: true,
      protocol: 'rss',
      id: rssEntry.id,
      url: `https://app.degenfeed.xyz/feed/live/rss.xml`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'rss',
      error: `RSS publish failed: ${msg}`,
    };
  }
}

// ─── Protocol: Telegram ──────────────────────────────────────────────────

/**
 * Announce the stream in a Telegram chat or channel.
 *
 * Sends an HTML-formatted message to the creator's designated
 * Telegram chat using the TGBotClient from @degenfeed/telegram-sdk.
 */
async function announceToTelegram(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const { TGBotClient } = await import('@degenfeed/telegram-sdk');

  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = identity.chatId || identity.identifier;

  if (!botToken) {
    return {
      ok: false,
      protocol: 'telegram',
      error: 'TELEGRAM_BOT_TOKEN env var is not configured',
    };
  }
  if (!chatId) {
    return {
      ok: false,
      protocol: 'telegram',
      error: 'No Telegram chat ID available for this creator',
    };
  }

  try {
    const bot = new TGBotClient(botToken);
    const result = await bot.sendMessage(chatId, announcement.telegram, {
      parseMode: 'HTML',
    });

    return {
      ok: true,
      protocol: 'telegram',
      id: String(result.messageId),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'telegram',
      error: `Telegram send failed: ${msg}`,
    };
  }
}

// ─── Protocol: Threads (Meta via ActivityPub Federation) ────────────────────

/**
 * Announce the stream to Threads users via ActivityPub federation.
 *
 * Threads is Meta's fediverse platform. Integration works through our
 * GoToSocial (GtS) instance:
 *   1. We post a status to GoToSocial with Threads-optimized text
 *   2. Threads users following @degenfeed@social.degenfeed.xyz see it
 *   3. Threads users can reply (replies appear in GtS context)
 *   4. We poll those replies via ThreadsStreamBridge.fetchThreadsReplies()
 *
 * Threads does NOT support rich embeds — links appear as plain text URLs.
 */
async function announceToThreads(
  env: Env,
  identity: ProtocolAuth,
  announcement: AnnouncementTexts,
): Promise<AnnouncementResult> {
  const { GtSClient } = await import('@degenfeed/mastodon-sdk');

  const instanceUrl =
    identity.instanceUrl || env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken =
    identity.credential || (env as Record<string, string | undefined>).GTS_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      ok: false,
      protocol: 'threads',
      error: 'No ActivityPub/GoToSocial access token available for Threads bridge',
    };
  }

  try {
    const result = await reliableAnnounce(
      'threads',
      async () => {
        const client = new GtSClient(instanceUrl, accessToken);

        // Post with Threads-optimized formatting (no rich embeds, clear URLs)
        const publishResult = await client.publish(announcement.threads, {
          visibility: 'public',
        });
        return publishResult;
      },
      env,
    );

    return {
      ok: true,
      protocol: 'threads',
      id: result.id,
      url: result.url,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      protocol: 'threads',
      error: `Threads bridge publish failed: ${msg}`,
    };
  }
}
