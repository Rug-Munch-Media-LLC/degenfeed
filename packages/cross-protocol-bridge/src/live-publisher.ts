/**
 * @degenfeed/cross-protocol-bridge — Live Cross-Protocol Publisher
 *
 * When a creator goes live on Loops, this module announces/mirrors the
 * stream on EVERY supported protocol in NATIVE format:
 *
 *   Farcaster: Live Frame — watch from Farcaster
 *   Nostr:     NIP-53 kind 30311 live event — watch from Nostr clients
 *   Bluesky:   AT Protocol live post with link card
 *   Mastodon/GTS: ActivityPub live notification
 *   PeerTube:  PeerTube live stream
 *   Owncast:   Owncast live stream
 *
 * Every publisher has independent error handling. One failure NEVER
 * blocks others. Each returns its own result entry.
 */

import type { Protocol } from '@degenfeed/types';
import type { CrossPlatformPublishResult } from './protocol-video';

// ─── Types ────────────────────────────────────────────────────────────────

export interface LivePublishEvent {
  /** Canonical stream ID */
  id: string;
  /** Stream title */
  title: string;
  /** Stream description */
  description: string;
  /** HLS stream URL (playable in most players) */
  streamUrl: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Creator's DegenFeed identities */
  creator: LiveCreatorIdentity;
  /** Tags */
  tags: string[];
  /** Language */
  lang?: string;
  /** Stream status */
  status: 'live' | 'scheduled' | 'ended';
  /** When the stream started/scheduled (unix ms) */
  scheduledAt?: number;
}

export interface LiveCreatorIdentity {
  /** Loops identity */
  loops: { channelId: string; handle: string; displayName: string };
  /** Farcaster FID (if linked) */
  farcaster?: { fid: number; signerHex?: string };
  /** Nostr pubkey (if linked) */
  nostr?: { pubkey: string; privateKeyHex?: string };
  /** Bluesky DID (if linked) */
  bluesky?: { did: string; password?: string };
  /** Mastodon/GTS (if linked) */
  mastodon?: { instanceUrl: string; accessToken: string };
  /** PeerTube channel (if linked) */
  peertube?: { instanceUrl: string; channelId: number; accessToken: string };
  /** Owncast instance (if linked) */
  owncast?: { instanceUrl: string; adminToken: string };
}

export interface LivePublishResult extends CrossPlatformPublishResult {
  /** Protocol-native stream event ID */
  nativeId?: string;
  /** URL to watch the stream on this protocol */
  watchUrl?: string;
  /** Protocol-specific metadata */
  meta?: Record<string, unknown>;
}

export interface LivePublishBatchResult {
  results: LivePublishResult[];
  totalSuccess: number;
  totalFailure: number;
  succeededProtocols: Protocol[];
  failedProtocols: Protocol[];
  totalLatencyMs: number;
  watchOn: Record<string, string>;
  /** "Also Available On" formatted for UI pills */
  alsoOnPills: Array<{ protocol: string; label: string; icon: string; color: string; url: string; watchUrl: string }>;
}

const LIVE_PROTOCOL_META: Record<string, { label: string; icon: string; color: string }> = {
  farcaster: { label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  nostr: { label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#1185fe' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  peertube: { label: 'PeerTube', icon: '▶️', color: '#f2691d' },
  owncast: { label: 'Owncast', icon: '📡', color: '#e9591d' },
};

// ─── Main Live Publisher ──────────────────────────────────────────────────

/**
 * Publish a Loops live stream event to ALL protocols the creator is linked to.
 * Each protocol gets a NATIVE live event format.
 */
export async function publishLiveToAllProtocols(
  event: LivePublishEvent,
  env: { [key: string]: string },
): Promise<LivePublishBatchResult> {
  const startTime = Date.now();
  const tasks: Promise<LivePublishResult>[] = [];
  const creator = event.creator;

  if (creator.farcaster) {
    tasks.push(publishToFarcasterLive(event, creator.farcaster, env));
  }
  if (creator.nostr) {
    tasks.push(publishToNostrLive(event, creator.nostr, env));
  }
  if (creator.bluesky) {
    tasks.push(publishToBlueskyLive(event, creator.bluesky, env));
  }
  if (creator.mastodon) {
    tasks.push(publishToMastodonLive(event, creator.mastodon, env));
  }
  if (creator.peertube) {
    tasks.push(publishToPeerTubeLive(event, creator.peertube, env));
  }
  if (creator.owncast) {
    tasks.push(publishToOwncastLive(event, creator.owncast, env));
  }

  const settled = await Promise.allSettled(tasks);
  const results: LivePublishResult[] = [];
  for (const s of settled) {
    if (s.status === 'fulfilled') {
      results.push(s.value);
    } else {
      results.push({
        protocol: 'unknown' as Protocol,
        success: false,
        error: `Publisher threw: ${s.reason instanceof Error ? s.reason.message : String(s.reason)}`,
      });
    }
  }

  const succeeded = results.filter((r) => r.success);
  const totalLatencyMs = Date.now() - startTime;
  const watchOn: Record<string, string> = {};
  for (const r of succeeded) {
    if (r.watchUrl) watchOn[r.protocol] = r.watchUrl;
    else if (r.url) watchOn[r.protocol] = r.url;
  }

  const alsoOnPills = succeeded
    .map((r) => {
      const meta = LIVE_PROTOCOL_META[r.protocol];
      if (!meta) return null;
      return {
        protocol: r.protocol as Protocol,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        url: r.url || '',
        watchUrl: r.watchUrl || r.url || '',
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.watchUrl.length > 0);

  return {
    results,
    totalSuccess: succeeded.length,
    totalFailure: results.filter((r) => !r.success).length,
    succeededProtocols: succeeded.map((r) => r.protocol as Protocol),
    failedProtocols: results.filter((r) => !r.success).map((r) => r.protocol as Protocol),
    totalLatencyMs,
    watchOn,
    alsoOnPills,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL-SPECIFIC LIVE PUBLISHERS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Farcaster: Live Frame — watch from Farcaster ────────────────────────

async function publishToFarcasterLive(
  event: LivePublishEvent,
  identity: NonNullable<LiveCreatorIdentity['farcaster']>,
  env: { [key: string]: string },
): Promise<LivePublishResult> {
  try {
    const botSignerHex = identity.signerHex || env.FARCASTER_BOT_SIGNER_KEY;
    const botFid = identity.fid ?? Number(env.FARCASTER_BOT_FID || 0);
    if (!botSignerHex || !botFid) {
      return { protocol: 'farcaster', success: false, error: 'Farcaster signer not configured' };
    }

    const { buildFarcasterCastMessage, HubClient } = await import('@degenfeed/farcaster-sdk');

    // Build a cast announcing the live stream
    const statusTag = event.status === 'live' ? '🔴 LIVE' : event.status === 'scheduled' ? '📅 SCHEDULED' : '⏹️ ENDED';
    const liveText = `${statusTag} ${event.title}\n\n${event.streamUrl}\n${event.description.slice(0, 120)}`
      .slice(0, 320);

    const castResult = buildFarcasterCastMessage({
      signerKeyHex: botSignerHex,
      fid: botFid,
      text: liveText,
    });

    if (!castResult.ok || !castResult.messageHex) {
      return { protocol: 'farcaster', success: false, error: castResult.error || 'Failed to build cast' };
    }

    const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
    const hub = new HubClient(hubUrl);
    const hexToBytes = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
      return bytes;
    };
    await hub.submitMessage(hexToBytes(castResult.messageHex!).buffer as ArrayBuffer);

    return {
      protocol: 'farcaster',
      success: true,
      nativeId: castResult.messageHex.slice(0, 16),
      url: `https://warpcast.com/~/conversations/${castResult.messageHex.slice(0, 16)}`,
      watchUrl: event.streamUrl,
      meta: { castHash: castResult.messageHex.slice(0, 40), frameType: 'live-video' },
    };
  } catch (err) {
    return { protocol: 'farcaster', success: false, error: String(err) };
  }
}

// ─── Nostr: NIP-53 kind 30311 live event ─────────────────────────────────

async function publishToNostrLive(
  event: LivePublishEvent,
  identity: NonNullable<LiveCreatorIdentity['nostr']>,
  env: { [key: string]: string },
): Promise<LivePublishResult> {
  try {
    const privateKeyHex = identity.privateKeyHex || env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      return { protocol: 'nostr', success: false, error: 'Nostr private key not configured' };
    }

    const { getPublicKey, signEvent, RelayPool } = await import('@degenfeed/nostr-sdk');

    // Build NIP-53 live event (kind 30311)
    // Per NIP-53 spec:
    //   "d" — unique identifier
    //   "title" — stream title
    //   "summary" — description
    //   "streaming" — URL to watch
    //   "status" — live/scheduled/ended
    //   "starts" — scheduled start time
    //   "t" — hashtags
    //   "p" — participants
    const tags: string[][] = [
      ['d', `df-live-${event.id.replace(':', '-')}`],
      ['title', event.title],
      ['summary', event.description.slice(0, 300)],
      ['streaming', event.streamUrl],
      ['status', event.status],
      ['content-warning', ''],
    ];

    if (event.scheduledAt) {
      tags.push(['starts', String(Math.floor(event.scheduledAt / 1000))]);
    }

    if (event.thumbnailUrl) {
      tags.push(['image', event.thumbnailUrl]);
    }

    for (const tag of event.tags) {
      tags.push(['t', tag.toLowerCase()]);
    }
    tags.push(['t', 'degenfeed']);
    tags.push(['t', 'live']);

    const pubkey = getPublicKey(privateKeyHex);
    const unsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 30311,
      tags,
      content: event.description,
    };
    const signedEvent = signEvent(unsignedEvent, privateKeyHex);

    // Publish to relays
    const relayUrls = [
      ...(env.RELAY_URLS?.split(',').map((u: string) => u.trim()) || []),
      'wss://relay.damus.io',
      'wss://nos.lol',
      'wss://relay.primal.net',
      'wss://relay.nostr.band',
    ].filter(Boolean);

    let published = false;
    const pool = new RelayPool(relayUrls, {
      connectTimeout: 3000,
      eoseTimeout: 2000,
      maxReconnects: 0,
      logLevel: 'error',
    });

    await new Promise<void>((resolve) => {
      const check = () => {
        if (pool.getConnectedRelays().length > 0) resolve();
        else setTimeout(check, 200);
      };
      setTimeout(check, 300);
    });

    pool.publish(signedEvent, {
      onOk: () => { published = true; },
      onError: () => {},
    });

    await new Promise((r) => setTimeout(r, 2000));
    for (const url of pool.getConnectedRelays()) {
      pool.removeRelay(url);
    }

    return {
      protocol: 'nostr',
      success: published,
      nativeId: signedEvent.id,
      url: signedEvent.id ? `nostr:${signedEvent.id}` : undefined,
      watchUrl: event.streamUrl,
      meta: { kind: 30311, nip: '53', eventId: signedEvent.id, status: event.status },
    };
  } catch (err) {
    return { protocol: 'nostr', success: false, error: String(err) };
  }
}

// ─── Bluesky: AT Protocol live post with link card ────────────────────────

async function publishToBlueskyLive(
  event: LivePublishEvent,
  identity: NonNullable<LiveCreatorIdentity['bluesky']>,
  env: { [key: string]: string },
): Promise<LivePublishResult> {
  try {
    const did = identity.did || env.BSKY_DID;
    const password = identity.password || env.BSKY_APP_PASSWORD;
    if (!did || !password) {
      return { protocol: 'bluesky', success: false, error: 'Bluesky credentials not configured' };
    }

    const { PdsClient } = await import('@degenfeed/bluesky-sdk');
    const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
    const client = new PdsClient(pdsUrl);
    await client.createSession(did, password);

    const statusEmoji = event.status === 'live' ? '🔴 LIVE' : event.status === 'scheduled' ? '📅 SCHEDULED' : '⏹️ ENDED';
    const text =
      `${statusEmoji} ${event.title}\n\n${event.description.slice(0, 200)}` +
      `\n\n${event.tags.map((t) => `#${t}`).join(' ')}`.slice(0, 300);

    // Create post with a link card embed pointing to the stream
    const result = await client.createPost({
      text,
      langs: [event.lang || 'en'],
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: event.streamUrl,
          title: `🔴 LIVE: ${event.title}`,
          description: event.description.slice(0, 200),
          thumb: event.thumbnailUrl || '',
        },
      },
      createdAt: new Date(event.scheduledAt || Date.now()).toISOString(),
    });

    return {
      protocol: 'bluesky',
      success: true,
      nativeId: result.cid,
      url: result.uri,
      watchUrl: event.streamUrl,
      meta: { cid: result.cid, uri: result.uri },
    };
  } catch (err) {
    return { protocol: 'bluesky', success: false, error: String(err) };
  }
}

// ─── Mastodon/GTS: ActivityPub live notification ─────────────────────────

async function publishToMastodonLive(
  event: LivePublishEvent,
  identity: NonNullable<LiveCreatorIdentity['mastodon']>,
  _env: { [key: string]: string },
): Promise<LivePublishResult> {
  try {
    const instanceUrl = identity.instanceUrl;
    const accessToken = identity.accessToken;
    if (!accessToken) {
      return { protocol: 'mastodon', success: false, error: 'Mastodon token not configured' };
    }

    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instanceUrl, accessToken);

    const statusEmoji = event.status === 'live' ? '🔴 LIVE' : event.status === 'scheduled' ? '📅 UPCOMING' : '⏹️ ENDED';
    const tootText =
      `${statusEmoji} ${event.title}\n\n${event.description.slice(0, 300)}` +
      `\n\nWatch: ${event.streamUrl}` +
      `\n\n${event.tags.map((t) => `#${t}`).join(' ')}`.slice(0, 500);

    const status = await client.publish(tootText, {
      visibility: 'public',
      sensitive: false,
    });

    return {
      protocol: 'mastodon',
      success: true,
      nativeId: status.id,
      url: status.url,
      watchUrl: event.streamUrl,
      meta: { statusId: status.id },
    };
  } catch (err) {
    return { protocol: 'mastodon', success: false, error: String(err) };
  }
}

// ─── PeerTube: PeerTube live stream ───────────────────────────────────────

async function publishToPeerTubeLive(
  event: LivePublishEvent,
  identity: NonNullable<LiveCreatorIdentity['peertube']>,
  _env: { [key: string]: string },
): Promise<LivePublishResult> {
  try {
    const instanceUrl = identity.instanceUrl;
    const accessToken = identity.accessToken;
    if (!accessToken) {
      return { protocol: 'peertube', success: false, error: 'PeerTube token not configured' };
    }

    // PeerTube API: Create or update a live video
    if (event.status === 'live') {
      // Create a temporary live video entry linking back to the Loops stream
      const res = await fetch(`${instanceUrl}/api/v1/videos/live`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: event.title.slice(0, 120),
          description: `${event.description}\n\n🔴 Watch live from Loops: ${event.streamUrl}\n\nTags: ${event.tags.join(', ')}`,
          channelId: identity.channelId,
          privacy: 1, // Public
          tags: [...new Set([...event.tags, 'degenfeed', 'live'])],
          // Set the live stream as a redirect to the Loops stream
          saveReplay: false,
          permanentLive: false,
          thumbnailUrl: event.thumbnailUrl,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown');
        return { protocol: 'peertube', success: false, error: `PeerTube live create: ${res.status} ${errText.slice(0, 200)}` };
      }

      const data = (await res.json()) as { video: { uuid: string; url: string } };

      return {
        protocol: 'peertube',
        success: true,
        nativeId: data.video.uuid,
        url: data.video.url,
        watchUrl: event.streamUrl,
        meta: { uuid: data.video.uuid, type: 'live-redirect' },
      };
    }

    // For scheduled/ended, just post an announcement
    const statusLabel = event.status === 'scheduled' ? '📅 UPCOMING LIVE' : '⏹️ STREAM ENDED';
    const res = await fetch(`${instanceUrl}/api/v1/videos`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: `${statusLabel}: ${event.title}`.slice(0, 120),
        description: `${event.description}\n\n${event.streamUrl}\n\nTags: ${event.tags.join(', ')}`,
        channelId: identity.channelId,
        privacy: 1,
        tags: ['degenfeed', event.status === 'scheduled' ? 'upcoming' : 'vod', ...event.tags],
      }),
    });

    if (!res.ok) {
      return { protocol: 'peertube', success: false, error: `PeerTube announce: ${res.status}` };
    }

    return {
      protocol: 'peertube',
      success: true,
      url: `${instanceUrl}/search?search=${encodeURIComponent(event.title)}`,
      watchUrl: event.streamUrl,
      meta: { type: 'announcement' },
    };
  } catch (err) {
    return { protocol: 'peertube', success: false, error: String(err) };
  }
}

// ─── Owncast: Owncast live stream ────────────────────────────────────────

async function publishToOwncastLive(
  event: LivePublishEvent,
  identity: NonNullable<LiveCreatorIdentity['owncast']>,
  _env: { [key: string]: string },
): Promise<LivePublishResult> {
  try {
    const instanceUrl = identity.instanceUrl;
    const adminToken = identity.adminToken;
    if (!adminToken) {
      return { protocol: 'owncast', success: false, error: 'Owncast admin token not configured' };
    }

    // Owncast API: Set stream status/social post with the Loops stream link
    const res = await fetch(`${instanceUrl}/api/admin/chat/social`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: event.status === 'live' ? 'live' : 'message',
        body: `🔴 ${event.title}\n${event.description.slice(0, 300)}\n\nWatch: ${event.streamUrl}`,
      }),
    });

    if (!res.ok) {
      return { protocol: 'owncast', success: false, error: `Owncast API: ${res.status}` };
    }

    // Also set the stream title
    await fetch(`${instanceUrl}/api/admin/stream/name`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${adminToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: event.title.slice(0, 100) }),
    }).catch(() => {});

    return {
      protocol: 'owncast',
      success: true,
      nativeId: event.id,
      url: instanceUrl,
      watchUrl: event.streamUrl,
      meta: { instanceUrl, type: 'social-post' },
    };
  } catch (err) {
    return { protocol: 'owncast', success: false, error: String(err) };
  }
}
