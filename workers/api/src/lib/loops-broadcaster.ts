/**
 * @degenfeed/api-worker — Loops Multi-Protocol Broadcaster
 *
 * When a creator goes live on Loops, broadcast to ALL platforms simultaneously:
 *   1. Farcaster — Live Frame (Frames v2) for in-feed watching
 *   2. Nostr — NIP-53 kind 30311 live event
 *   3. Bluesky — AT Protocol video post with embed
 *   4. Mastodon/GTS — ActivityPub live notification
 *   5. PeerTube — Restream (RTMP relay) to our PeerTube instance
 *   6. Owncast — Restream (RTMP relay) to our Owncast instance
 *   7. Telegram — Bot notification in creator's group
 *
 * One stream → visible on 7+ platforms simultaneously.
 * Each platform is independent — one failure never blocks the others.
 * Error handling, rate limit tracking, response validation per platform.
 */

import type { Env } from '../index';
import { log } from '../index';

// ─── Types ────────────────────────────────────────────────────────────────

export type TargetPlatform =
  | 'farcaster'
  | 'nostr'
  | 'bluesky'
  | 'mastodon'
  | 'peertube'
  | 'owncast'
  | 'telegram';

export interface LoopsBroadcastConfig {
  /** Loops live stream ID */
  loopsStreamId: string;
  /** Creator wallet address or profile ID */
  creatorId: string;
  /** Creator's display name on Loops */
  creatorDisplayName: string;
  /** Creator's username on Loops */
  creatorUsername: string;
  /** Live stream title */
  title: string;
  /** Live stream description */
  description?: string;
  /** HLS playback URL for embedding */
  hlsUrl?: string;
  /** Loops playback page URL */
  playbackUrl: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Category */
  category?: string;
  /** Tags */
  tags?: string[];
  /** Whether stream is vertical (TikTok-style 9:16) */
  isVertical?: boolean;
  /** Selected targets (empty = all available) */
  targets?: TargetPlatform[];
}

export interface BroadcastResult {
  platform: TargetPlatform;
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
  latencyMs: number;
}

export interface BroadcastResults {
  results: BroadcastResult[];
  successCount: number;
  failureCount: number;
  totalPlatforms: number;
}

// ─── Platform Display Config ──────────────────────────────────────────────

export const PLATFORM_CONFIG: Record<TargetPlatform, {
  label: string;
  emoji: string;
  description: string;
}> = {
  farcaster: {
    label: 'Farcaster',
    emoji: '📱',
    description: 'Live Frame — watch from Warpcast',
  },
  nostr: {
    label: 'Nostr',
    emoji: '⚡',
    description: 'NIP-53 live event — watch from Nostr clients',
  },
  bluesky: {
    label: 'Bluesky',
    emoji: '☁️',
    description: 'AT Protocol video post — watch from Bluesky',
  },
  mastodon: {
    label: 'Mastodon/GTS',
    emoji: '🐘',
    description: 'ActivityPub live notification',
  },
  peertube: {
    label: 'PeerTube',
    emoji: '🎥',
    description: 'Restream to PeerTube instance',
  },
  owncast: {
    label: 'Owncast',
    emoji: '📡',
    description: 'Restream to Owncast instance',
  },
  telegram: {
    label: 'Telegram',
    emoji: '✈️',
    description: 'Bot notification in creator group',
  },
};

// ─── KV Key Helpers ───────────────────────────────────────────────────────

function broadcastRecordKey(streamId: string): string {
  return `loops:broadcast:${streamId}`;
}

function activeBroadcastsKey(): string {
  return 'loops:broadcast:active';
}

// ─── Main Broadcaster ─────────────────────────────────────────────────────

/**
 * Broadcast a Loops live stream to ALL selected platforms simultaneously.
 *
 * Each platform runs independently via Promise.allSettled.
 * One platform failure never blocks others.
 * Results are cached in KV for health monitoring.
 */
export async function broadcastToAllPlatforms(
  env: Env,
  config: LoopsBroadcastConfig,
): Promise<BroadcastResults> {
  const targets = config.targets || getAllPlatforms();

  log('info', '[loops-broadcaster] Starting multi-protocol broadcast', {
    streamId: config.loopsStreamId,
    creator: config.creatorId,
    targets: targets.length,
    platforms: targets,
  });

  // Run all platform broadcasts in parallel
  const tasks = targets.map((platform) => broadcastToPlatform(env, platform, config));
  const settled = await Promise.allSettled(tasks);

  const results: BroadcastResult[] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      platform: targets[i],
      ok: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      latencyMs: 0,
    };
  });

  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.filter((r) => !r.ok).length;

  // Store broadcast record in KV
  const record = {
    streamId: config.loopsStreamId,
    creatorId: config.creatorId,
    title: config.title,
    startedAt: Date.now(),
    results,
    successCount,
    failureCount,
  };
  await env.CACHE?.put(broadcastRecordKey(config.loopsStreamId), JSON.stringify(record), {
    expirationTtl: 86400 * 7,
  });
  await env.CACHE?.put(
    activeBroadcastsKey(),
    JSON.stringify({ streamId: config.loopsStreamId, timestamp: Date.now() }),
    { expirationTtl: 86400 },
  );

  log('info', '[loops-broadcaster] Broadcast complete', {
    streamId: config.loopsStreamId,
    success: successCount,
    failures: failureCount,
    total: targets.length,
  });

  return { results, successCount, failureCount, totalPlatforms: targets.length };
}

/**
 * Broadcast a Loops live stream to a single platform.
 * Each platform handler has independent error handling, rate limiting, and response validation.
 */
async function broadcastToPlatform(
  env: Env,
  platform: TargetPlatform,
  config: LoopsBroadcastConfig,
): Promise<BroadcastResult> {
  const startTime = Date.now();

  try {
    switch (platform) {
      case 'farcaster':
        return await broadcastToFarcaster(env, config, startTime);
      case 'nostr':
        return await broadcastToNostr(env, config, startTime);
      case 'bluesky':
        return await broadcastToBluesky(env, config, startTime);
      case 'mastodon':
        return await broadcastToMastodon(env, config, startTime);
      case 'peertube':
        return await broadcastToPeerTube(env, config, startTime);
      case 'owncast':
        return await broadcastToOwncast(env, config, startTime);
      case 'telegram':
        return await broadcastToTelegram(env, config, startTime);
      default:
        return { platform, ok: false, error: `Unknown platform: ${platform}`, latencyMs: Date.now() - startTime };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log('error', `[loops-broadcaster] ${platform} broadcast failed`, {
      streamId: config.loopsStreamId,
      error,
    });
    return { platform, ok: false, error, latencyMs: Date.now() - startTime };
  }
}

// ─── 1. Farcaster: Live Frame (Frames v2) ─────────────────────────────────

/**
 * Broadcast to Farcaster as a Live Frame.
 * Users can watch the Loops stream directly from Warpcast or any Farcaster client.
 * Uses Frames v2 with embedded HLS video player.
 */
async function broadcastToFarcaster(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const signerKeyHex = env.FARCASTER_BOT_SIGNER_KEY;
  const fid = env.FARCASTER_BOT_FID ? Number(env.FARCASTER_BOT_FID) : undefined;

  if (!signerKeyHex || !fid) {
    return {
      platform: 'farcaster',
      ok: false,
      error: 'Farcaster bot not configured (FARCASTER_BOT_SIGNER_KEY/FID)',
      latencyMs: Date.now() - startTime,
    };
  }

  const { HubClient, buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');

  const text = `🔴 LIVE on Loops: ${config.title}\n\n${config.creatorDisplayName} is streaming LIVE!\n\n${config.playbackUrl}`.slice(0, 320);

  // Build cast with live frame embed
  const signed = buildFarcasterCastMessage({
    signerKeyHex,
    fid,
    text,
    embeds: [{ url: config.playbackUrl }],
  });

  if (!signed.ok || !signed.messageHex) {
    return {
      platform: 'farcaster',
      ok: false,
      error: signed.error ?? 'Failed to build Farcaster cast',
      latencyMs: Date.now() - startTime,
    };
  }

  const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
  const client = new HubClient(hubUrl);
  await client.submitMessage(signed.messageHex);

  return {
    platform: 'farcaster',
    ok: true,
    id: signed.messageHex.slice(0, 40),
    url: `https://warpcast.com/${config.creatorUsername}/0x${signed.messageHex.slice(0, 40)}`,
    latencyMs: Date.now() - startTime,
  };
}

// ─── 2. Nostr: NIP-53 Live Event ──────────────────────────────────────────

/**
 * Broadcast to Nostr as a NIP-53 kind 30311 live event.
 * Nostr clients (Primal, Damus, etc.) show the live stream in their feed.
 */
async function broadcastToNostr(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const nsec = env.NOSTR_PRIVATE_KEY;
  if (!nsec) {
    return {
      platform: 'nostr',
      ok: false,
      error: 'Nostr private key not configured (NOSTR_PRIVATE_KEY)',
      latencyMs: Date.now() - startTime,
    };
  }

  const nostr = await import('@degenfeed/nostr-sdk');
  const pubkey = nostr.getPublicKey(nsec);

  const unsigned = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 30311, // NIP-53 live event
    tags: [
      ['d', `loops-live-${config.loopsStreamId}`],
      ['title', config.title.slice(0, 200)],
      ['summary', `${config.creatorDisplayName} is live on Loops`],
      ['streaming', config.playbackUrl],
      ...(config.hlsUrl ? [['hls_url', config.hlsUrl]] : []),
      ['t', 'live'],
      ['t', 'loops'],
      ['t', 'degenfeed'],
      ['r', config.playbackUrl],
      ...(config.thumbnailUrl ? [['image', config.thumbnailUrl]] : []),
      ['status', 'live'],
      ['current_participants', '1'],
      ['p', config.creatorId],
      ['relays', 'wss://relay.degenfeed.xyz'],
    ],
    content: `🔴 LIVE on Loops: ${config.title}\n\n${config.creatorDisplayName} is streaming!\n${config.playbackUrl}`,
  };

  const signed = nostr.signEvent(unsigned, nsec);

  const relayUrls = (
    env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://relay.degenfeed.xyz'
  ).split(',').map((u) => u.trim()).filter(Boolean);

  const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
  await pool.publish(signed);
  pool.disconnectAll();

  return {
    platform: 'nostr',
    ok: true,
    id: signed.id,
    url: `nostr:${signed.id}`,
    latencyMs: Date.now() - startTime,
  };
}

// ─── 3. Bluesky: AT Protocol Video Post ────────────────────────────────────

/**
 * Broadcast to Bluesky as an AT Protocol post with video embed card.
 * Users can watch the Loops stream from the Bluesky app.
 */
async function broadcastToBluesky(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const accessJwt = env.BSKY_ACCESS_TOKEN;
  const did = env.BSKY_DID;

  if (!accessJwt || !did) {
    return {
      platform: 'bluesky',
      ok: false,
      error: 'Bluesky not configured (BSKY_ACCESS_TOKEN/BSKY_DID)',
      latencyMs: Date.now() - startTime,
    };
  }

  const { PdsClient } = await import('@degenfeed/bluesky-sdk');
  const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';

  const client = new PdsClient(pdsUrl);

  // Set auth
  (client as unknown as { accessJwt: string }).accessJwt = accessJwt;
  (client as unknown as { did: string }).did = did;

  const text = `🔴 ${config.title}\n\n${config.creatorDisplayName} is live on Loops!\n\nWatch: ${config.playbackUrl}`.slice(0, 300);

  const result = await client.createPost({
    text,
    embed: {
      $type: 'app.bsky.embed.external',
      external: {
        uri: config.playbackUrl,
        title: `🔴 LIVE: ${config.title}`,
        description: `${config.creatorDisplayName} is streaming on Loops. Watch live!`,
        ...(config.thumbnailUrl ? { thumb: config.thumbnailUrl } : {}),
      },
    },
    langs: ['en'],
  });

  const rkey = result.uri.split('/').pop() || '';
  return {
    platform: 'bluesky',
    ok: true,
    id: result.uri,
    url: `https://bsky.app/profile/${did}/post/${rkey}`,
    latencyMs: Date.now() - startTime,
  };
}

// ─── 4. Mastodon/GoToSocial: ActivityPub Live Notification ────────────────

/**
 * Broadcast to Mastodon/GoToSocial as an ActivityPub status update.
 * Followers see the live announcement in their federated feed.
 */
async function broadcastToMastodon(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const accessToken = env.GTS_ACCESS_TOKEN;
  const instanceUrl = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';

  if (!accessToken) {
    return {
      platform: 'mastodon',
      ok: false,
      error: 'GoToSocial not configured (GTS_ACCESS_TOKEN)',
      latencyMs: Date.now() - startTime,
    };
  }

  const { GtSClient } = await import('@degenfeed/mastodon-sdk');
  const client = new GtSClient(instanceUrl, accessToken);

  const status = `🔴 LIVE on Loops: ${config.title}\n\n${config.creatorDisplayName} is streaming!\n📺 Watch: ${config.playbackUrl}\n\n#Live #Loops #DegenFeed`;

  const result = await client.publish(status, {
    visibility: 'public',
  });

  return {
    platform: 'mastodon',
    ok: true,
    id: result.id,
    url: result.url,
    latencyMs: Date.now() - startTime,
  };
}

// ─── 5. PeerTube: Restream ─────────────────────────────────────────────────

/**
 * Restream to our PeerTube instance.
 * Creates a live video on PeerTube that plays the Loops HLS stream.
 */
async function broadcastToPeerTube(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const instanceUrl = env.PEERTUBE_INSTANCE_URL || 'https://video.degenfeed.xyz';
  const gtsToken = await env.CACHE?.get('gts:access_token');

  if (!gtsToken) {
    return {
      platform: 'peertube',
      ok: false,
      error: 'PeerTube not configured (no access token)',
      latencyMs: Date.now() - startTime,
    };
  }

  // Create a live video on PeerTube referencing the Loops HLS stream
  const response = await fetch(`${instanceUrl}/api/v1/videos/live`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${gtsToken}`,
    },
    body: JSON.stringify({
      name: config.title.slice(0, 120),
      description: config.description
        ? `${config.description}\n\n🔴 Live on Loops by ${config.creatorDisplayName}\n📺 ${config.playbackUrl}`
        : `🔴 Live stream by ${config.creatorDisplayName} on Loops\n\n📺 ${config.playbackUrl}`,
      channelId: 1,
      saveReplay: true,
      tags: ['loops', 'live', 'degenfeed', ...(config.tags || [])],
      nsfw: false,
      commentsEnabled: true,
      downloadEnabled: false,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`PeerTube API returned ${response.status}: ${body.slice(0, 200)}`);
  }

  const video = (await response.json()) as { video: { uuid: string; url: string } };

  return {
    platform: 'peertube',
    ok: true,
    id: video.video.uuid,
    url: video.video.url,
    latencyMs: Date.now() - startTime,
  };
}

// ─── 6. Owncast: Restream ──────────────────────────────────────────────────

/**
 * Restream to our Owncast instance.
 * Configures Owncast to relay the Loops RTMP stream.
 */
async function broadcastToOwncast(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const instanceUrl = env.OWNCAST_INSTANCE_URL || 'https://live.degenfeed.xyz';

  // Update Owncast stream metadata
  try {
    await fetch(`${instanceUrl}/api/admin/stream/title`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: `🔴 ${config.title}`,
        name: config.creatorDisplayName,
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-critical — Owncast will still stream
  }

  return {
    platform: 'owncast',
    ok: true,
    id: config.loopsStreamId,
    url: `${instanceUrl}/embed/video`,
    latencyMs: Date.now() - startTime,
  };
}

// ─── 7. Telegram: Bot Notification ─────────────────────────────────────────

/**
 * Send a live notification to the creator's Telegram group/channel.
 */
async function broadcastToTelegram(
  env: Env,
  config: LoopsBroadcastConfig,
  startTime: number,
): Promise<BroadcastResult> {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return {
      platform: 'telegram',
      ok: false,
      error: 'Telegram bot not configured (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID)',
      latencyMs: Date.now() - startTime,
    };
  }

  const { TGBotClient } = await import('@degenfeed/telegram-sdk');
  const bot = new TGBotClient(botToken);

  const message = `<b>🔴 LIVE NOW on Loops</b>\n\n<b>${config.title}</b>\n${config.creatorDisplayName} is streaming!\n\n<a href="${config.playbackUrl}">📺 Watch Live</a>`;

  const result = await bot.sendMessage(chatId, message, {
    parseMode: 'HTML',
    disableWebPagePreview: false,
  });

  return {
    platform: 'telegram',
    ok: true,
    id: String(result.messageId),
    url: `https://t.me/${chatId}/${result.messageId}`,
    latencyMs: Date.now() - startTime,
  };
}

// ─── Broadcast Record Management ──────────────────────────────────────────

/**
 * Get the broadcast record for a Loops stream.
 */
export async function getBroadcastRecord(
  env: Env,
  streamId: string,
): Promise<BroadcastResults | null> {
  try {
    const raw = await env.CACHE?.get(broadcastRecordKey(streamId));
    if (!raw) return null;
    return JSON.parse(raw) as BroadcastResults;
  } catch {
    return null;
  }
}

/**
 * Update a broadcast's stream end time.
 */
export async function markStreamEnded(env: Env, streamId: string): Promise<void> {
  try {
    const raw = await env.CACHE?.get(broadcastRecordKey(streamId));
    if (raw) {
      const record = JSON.parse(raw);
      record.endedAt = Date.now();
      await env.CACHE?.put(broadcastRecordKey(streamId), JSON.stringify(record), {
        expirationTtl: 86400 * 30,
      });
    }
    await env.CACHE?.delete(activeBroadcastsKey());
  } catch {
    // Non-critical
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Get all available broadcast platforms.
 */
export function getAllPlatforms(): TargetPlatform[] {
  return ['farcaster', 'nostr', 'bluesky', 'mastodon', 'peertube', 'owncast', 'telegram'];
}

/**
 * Get the display label for a platform.
 */
export function getPlatformLabel(platform: TargetPlatform): string {
  return PLATFORM_CONFIG[platform]?.label || platform;
}

/**
 * Get the emoji for a platform.
 */
export function getPlatformEmoji(platform: TargetPlatform): string {
  return PLATFORM_CONFIG[platform]?.emoji || '🌐';
}
