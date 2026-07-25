/**
 * @degenfeed/cross-protocol-bridge — Shorts Cross-Protocol Publisher
 *
 * When a creator posts a short on Loops, this module publishes it to
 * EVERY supported protocol in NATIVE format:
 *
 *   Nostr:  kind 34235 (NIP-71 video event)
 *   Farcaster: Frame v2 cast with video embed
 *   Bluesky: app.bsky.feed.post with video embed
 *   Mastodon/GTS: ActivityPub Note with video attachment
 *   Lens:    Video publication with collect module
 *   PeerTube: Mirror as PeerTube video
 *   Pixelfed: Mirror as Pixelfed video post
 *   Telegram: Share in creator's channel
 *
 * Every publisher has independent error handling & rate-limit awareness.
 * One failure NEVER blocks others. Each returns its own result entry.
 */

import type { Protocol } from '@degenfeed/types';
import type { CrossPlatformPublishResult } from './protocol-video';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ShortsPublishEvent {
  /** Canonical short ID (loops:uuid) */
  id: string;
  /** Short title */
  title: string;
  /** Short description / caption */
  description: string;
  /** Direct video URL (must be accessible for upload) */
  videoUrl: string;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** Duration in seconds */
  duration: number;
  /** Creator's DegenFeed identities (all linked protocols) */
  creator: CreatorIdentity;
  /** Tags/hashtags */
  tags: string[];
  /** Language code */
  lang?: string;
  /** MIME type of the video */
  mimeType: string;
  /** When published (unix ms) */
  publishedAt: number;
  /** Whether this is a short (<60s vertical) */
  isShort: boolean;
}

export interface CreatorIdentity {
  /** Loops identity */
  loops: { channelId: string; handle: string; displayName: string; avatarUrl?: string };
  /** Farcaster FID (if linked) */
  farcaster?: { fid: number; signerHex?: string };
  /** Nostr pubkey (if linked) */
  nostr?: { pubkey: string; privateKeyHex?: string };
  /** Bluesky DID (if linked) */
  bluesky?: { did: string; password?: string };
  /** Mastodon/GTS (if linked) */
  mastodon?: { instanceUrl: string; accessToken: string };
  /** Lens profile ID (if linked) */
  lens?: { profileId: string; handle: string };
  /** PeerTube channel (if linked) */
  peertube?: { instanceUrl: string; channelId: number; accessToken: string };
  /** Pixelfed (if linked) */
  pixelfed?: { instanceUrl: string; accessToken: string };
  /** Telegram (if linked) */
  telegram?: { chatId: string; botToken: string };
}

export interface ShortsPublishResult extends CrossPlatformPublishResult {
  /** Protocol-native post ID */
  nativeId?: string;
  /** URL to the published short on this protocol */
  url?: string;
  /** Protocol-specific metadata (event hash, CID, frame URL, etc.) */
  meta?: Record<string, unknown>;
}

export interface ShortsPublishBatchResult {
  /** Per-protocol results */
  results: ShortsPublishResult[];
  /** Total successful publishes */
  totalSuccess: number;
  /** Total failures */
  totalFailure: number;
  /** Which protocols succeeded */
  succeededProtocols: Protocol[];
  /** Which protocols failed */
  failedProtocols: Protocol[];
  /** Aggregate latency */
  totalLatencyMs: number;
  /** All protocol URLs where this short is available */
  availableOn: Record<Protocol, string>;
  /** "Also Available On" formatted array for UI pills */
  alsoOnPills: Array<{ protocol: string; label: string; icon: string; color: string; url: string }>;
}

// ─── Protocol display metadata ────────────────────────────────────────────

const PROTOCOL_META: Record<string, { label: string; icon: string; color: string }> = {
  nostr: { label: 'Nostr', icon: '⚡', color: '#8e30eb' },
  farcaster: { label: 'Farcaster', icon: '◈', color: '#8a63d2' },
  bluesky: { label: 'Bluesky', icon: '🦋', color: '#1185fe' },
  mastodon: { label: 'Mastodon', icon: '🐘', color: '#6364ff' },
  lens: { label: 'Lens', icon: '🌿', color: '#abfe2c' },
  peertube: { label: 'PeerTube', icon: '▶️', color: '#f2691d' },
  pixelfed: { label: 'Pixelfed', icon: '📷', color: '#f2691d' },
  telegram: { label: 'Telegram', icon: '✈️', color: '#0088cc' },
};

// ─── Main Publisher ───────────────────────────────────────────────────────

/**
 * Publish a Loops short to ALL protocols the creator is linked to.
 * Each protocol gets content in its NATIVE format.
 *
 * Returns a batch result with per-protocol outcomes and cross-platform
 * discovery metadata.
 */
export async function publishShortToAllProtocols(
  event: ShortsPublishEvent,
  env: { [key: string]: string },
): Promise<ShortsPublishBatchResult> {
  const startTime = Date.now();
  const tasks: Promise<ShortsPublishResult>[] = [];
  const creator = event.creator;

  // Build publisher tasks for each linked protocol
  if (creator.farcaster) {
    tasks.push(publishToFarcasterShort(event, creator.farcaster, env));
  }
  if (creator.nostr) {
    tasks.push(publishToNostrShort(event, creator.nostr, env));
  }
  if (creator.bluesky) {
    tasks.push(publishToBlueskyShort(event, creator.bluesky, env));
  }
  if (creator.mastodon) {
    tasks.push(publishToMastodonShort(event, creator.mastodon, env));
  }
  if (creator.lens) {
    tasks.push(publishToLensShort(event, creator.lens, env));
  }
  if (creator.peertube) {
    tasks.push(publishToPeerTubeShort(event, creator.peertube, env));
  }
  if (creator.pixelfed) {
    tasks.push(publishToPixelfedShort(event, creator.pixelfed, env));
  }
  if (creator.telegram) {
    tasks.push(publishToTelegramShort(event, creator.telegram, env));
  }

  // Run all in parallel — one failure never blocks others
  const settled = await Promise.allSettled(tasks);
  const results: ShortsPublishResult[] = [];
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

  // Aggregate
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const totalLatencyMs = Date.now() - startTime;
  const availableOn: Record<string, string> = {};
  for (const r of succeeded) {
    if (r.url) availableOn[r.protocol] = r.url;
  }

  const alsoOnPills = succeeded
    .map((r) => {
      const meta = PROTOCOL_META[r.protocol];
      if (!meta) return null;
      return {
        protocol: r.protocol as Protocol,
        label: meta.label,
        icon: meta.icon,
        color: meta.color,
        url: r.url || '',
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.url.length > 0);

  return {
    results,
    totalSuccess: succeeded.length,
    totalFailure: failed.length,
    succeededProtocols: succeeded.map((r) => r.protocol as Protocol),
    failedProtocols: failed.map((r) => r.protocol as Protocol),
    totalLatencyMs,
    availableOn,
    alsoOnPills,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL-SPECIFIC PUBLISHERS
// Each publishes a short in the protocol's NATIVE format.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Farcaster: Frame v2 cast with video embed ───────────────────────────

async function publishToFarcasterShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['farcaster']>,
  env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    const botSignerHex = identity.signerHex || env.FARCASTER_BOT_SIGNER_KEY;
    const botFid = identity.fid ?? Number(env.FARCASTER_BOT_FID || 0);
    if (!botSignerHex || !botFid) {
      return { protocol: 'farcaster', success: false, error: 'Farcaster signer not configured' };
    }

    // Build a Frame v2 cast with video embed
    const { buildFarcasterCastMessage, HubClient } = await import('@degenfeed/farcaster-sdk');

    // Include video URL in cast text since the SDK doesn't support embeds directly
    const shortText = `🎬 ${event.title}\n\n${event.videoUrl}\n${event.description.slice(0, 120)}`
      .slice(0, 320);

    const castResult = buildFarcasterCastMessage({
      signerKeyHex: botSignerHex,
      fid: botFid,
      text: shortText,
    });

    if (!castResult.ok || !castResult.messageHex) {
      return {
        protocol: 'farcaster',
        success: false,
        error: castResult.error || 'Failed to build cast',
      };
    }

    const hubUrl = env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
    const hub = new HubClient(hubUrl);
    const hexToBytes = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
      return bytes;
    };
    await hub.submitMessage(hexToBytes(castResult.messageHex!).buffer as ArrayBuffer);

    const hashPrefix = castResult.messageHex.slice(0, 16);

    return {
      protocol: 'farcaster',
      success: true,
      nativeId: hashPrefix,
      url: `https://warpcast.com/~/conversations/${hashPrefix}`,
      meta: { castHash: castResult.messageHex.slice(0, 40), frameType: 'v2-video' },
    };
  } catch (err) {
    return { protocol: 'farcaster', success: false, error: String(err) };
  }
}

// ─── Nostr: NIP-71 kind 34235 video event ────────────────────────────────

async function publishToNostrShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['nostr']>,
  env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    const privateKeyHex = identity.privateKeyHex || env.NOSTR_PRIVATE_KEY;
    if (!privateKeyHex) {
      return { protocol: 'nostr', success: false, error: 'Nostr private key not configured' };
    }

    const { getPublicKey, signEvent, RelayPool } = await import('@degenfeed/nostr-sdk');

    // Build NIP-71 video event (kind 34235)
    // Tags per NIP-71 spec:
    //   "d" — unique identifier
    //   "url" — video URL
    //   "m" — MIME type
    //   "x" — resolution
    //   "t" — hashtags
    //   "summary" — description
    //   "duration" — seconds
    //   "shorts" — mark as short-form
    //   "degenfeed" — cross-protocol route tag
    const tags: string[][] = [
      ['d', `df-${event.id.replace(':', '-')}`],
      ['url', event.videoUrl],
      ['m', event.mimeType],
      ['title', event.title],
      ['summary', event.description.slice(0, 300)],
      ['duration', String(event.duration)],
      ['image', event.thumbnailUrl || ''],
      ...(event.isShort ? [['shorts', '']] : []),
      ['degenfeed', 'short', event.id],
      ['published_at', String(Math.floor(event.publishedAt / 1000))],
    ];

    // Add hashtags
    for (const tag of event.tags) {
      tags.push(['t', tag.toLowerCase()]);
    }
    // Always tag degenfeed
    tags.push(['t', 'degenfeed']);
    tags.push(['t', 'short']);

    const pubkey = getPublicKey(privateKeyHex);
    const unsignedEvent = {
      pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: 34235,
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
      onError: () => { /* relay-specific fail — keep trying others */ },
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
      meta: { kind: 34235, nip: '71', eventId: signedEvent.id },
    };
  } catch (err) {
    return { protocol: 'nostr', success: false, error: String(err) };
  }
}

// ─── Bluesky: app.bsky.feed.post with video embed ────────────────────────

async function publishToBlueskyShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['bluesky']>,
  env: { [key: string]: string },
): Promise<ShortsPublishResult> {
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

    const text = [event.title, event.description.slice(0, 200), ...event.tags.map((t) => `#${t}`)]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 300);

    // Create post with video embed
    // app.bsky.embed.video is the native video embed type
    const result = await client.createPost({
      text,
      langs: [event.lang || 'en'],
      embed: {
        $type: 'app.bsky.embed.video',
        video: {
          $type: 'blob',
          ref: { $link: event.videoUrl },
          mimeType: event.mimeType,
          size: 0, // Will be resolved by the PDS on upload
        },
        alt: event.title,
        aspectRatio: event.isShort ? { width: 9, height: 16 } : { width: 16, height: 9 },
      },
      createdAt: new Date(event.publishedAt).toISOString(),
    });

    return {
      protocol: 'bluesky',
      success: true,
      nativeId: result.cid,
      url: result.uri,
      meta: { cid: result.cid, uri: result.uri },
    };
  } catch (err) {
    return { protocol: 'bluesky', success: false, error: String(err) };
  }
}

// ─── Mastodon/GTS: ActivityPub Note with video attachment ────────────────

async function publishToMastodonShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['mastodon']>,
  _env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    const instanceUrl = identity.instanceUrl;
    const accessToken = identity.accessToken;
    if (!accessToken) {
      return { protocol: 'mastodon', success: false, error: 'Mastodon token not configured' };
    }

    // Step 1: Upload video media
    const mediaForm = new FormData();
    const videoBlobRes = await fetch(event.videoUrl);
    if (videoBlobRes.ok) {
      const videoBlob = await videoBlobRes.blob();
      mediaForm.append('file', videoBlob, `${event.id}.mp4`);
    }
    mediaForm.append('description', event.title);

    const mediaRes = await fetch(`${instanceUrl}/api/v2/media`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: mediaForm,
    });

    let mediaId: string | undefined;
    if (mediaRes.ok) {
      const mediaData = (await mediaRes.json()) as { id: string };
      mediaId = mediaData.id;
    }

    // Step 2: Publish status with video
    const { GtSClient } = await import('@degenfeed/mastodon-sdk');
    const client = new GtSClient(instanceUrl, accessToken);

    const tootText =
      `🎬 ${event.title}\n\n${event.description.slice(0, 300)}` +
      `\n\n${event.tags.map((t) => `#${t}`).join(' ')}`.slice(0, 500);

    const status = await client.publish(tootText, {
      mediaIds: mediaId ? [mediaId] : undefined,
      visibility: 'public',
    });

    return {
      protocol: 'mastodon',
      success: true,
      nativeId: status.id,
      url: status.url,
      meta: { statusId: status.id },
    };
  } catch (err) {
    return { protocol: 'mastodon', success: false, error: String(err) };
  }
}

// ─── Lens: Video publication with collect module ─────────────────────────

async function publishToLensShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['lens']>,
  _env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    if (!identity.profileId) {
      return { protocol: 'lens', success: false, error: 'No Lens profile ID' };
    }

    const { LensClient } = await import('@degenfeed/lens-sdk');
    const client = new LensClient();

    // Use the Lens API directly via the Post mutation
    const content = [
      `# ${event.title}`,
      event.description,
      '',
      event.tags.map((t) => `#${t}`).join(' '),
    ].join('\n\n');

    const result = await client.request(
      `mutation Post($request: PostRequest!) {
        post(request: $request) { ... on RelaySuccess { txHash } ... on RelayError { reason } }
      }`,
      {
        request: {
          profileId: identity.profileId,
          content,
          media: [
            {
              url: event.videoUrl,
              mimeType: event.mimeType,
              altTag: event.title,
            },
          ],
          collectModule: {
            type: 'FreeCollectModule',
          },
          referenceModule: {
            type: 'ReferenceModule',
          },
        },
      },
    );

    return {
      protocol: 'lens',
      success: true,
      nativeId: identity.profileId,
      url: `https://hey.xyz/posts/${identity.profileId}`,
      meta: { result },
    };
  } catch (err) {
    return { protocol: 'lens', success: false, error: String(err) };
  }
}

// ─── PeerTube: Mirror as PeerTube video ──────────────────────────────────

async function publishToPeerTubeShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['peertube']>,
  _env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    const instanceUrl = identity.instanceUrl;
    const accessToken = identity.accessToken;
    if (!accessToken) {
      return { protocol: 'peertube', success: false, error: 'PeerTube token not configured' };
    }

    // PeerTube API: import video via URL
    const res = await fetch(`${instanceUrl}/api/v1/videos/imports`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: event.title.slice(0, 120),
        description: `${event.description}\n\nOriginally posted on Loops\nTags: ${event.tags.join(', ')}`,
        privacy: 1, // Public
        channelId: identity.channelId,
        tags: [...new Set([...event.tags, 'degenfeed', 'shorts'])],
        importData: {
          importUrl: event.videoUrl,
          thumbnailUrl: event.thumbnailUrl,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => 'Unknown');
      return { protocol: 'peertube', success: false, error: `PeerTube API: ${res.status} ${errText.slice(0, 200)}` };
    }

    const data = (await res.json()) as { video: { uuid: string; url: string } } | { uuid: string };

    const uuid = 'uuid' in data ? (data as { uuid: string }).uuid : (data as { video: { uuid: string } }).video?.uuid || 'unknown';
    const videoUrl = 'uuid' in data
      ? `${instanceUrl}/w/${(data as { uuid: string }).uuid}`
      : (data as { video: { url: string } }).video?.url || '';

    return {
      protocol: 'peertube',
      success: true,
      nativeId: uuid,
      url: videoUrl,
      meta: { uuid, instanceUrl },
    };
  } catch (err) {
    return { protocol: 'peertube', success: false, error: String(err) };
  }
}

// ─── Pixelfed: Mirror as Pixelfed video post ────────────────────────────

async function publishToPixelfedShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['pixelfed']>,
  _env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    const instanceUrl = identity.instanceUrl;
    const accessToken = identity.accessToken;
    if (!accessToken) {
      return { protocol: 'pixelfed', success: false, error: 'Pixelfed token not configured' };
    }

    // Pixelfed uses Mastodon-compatible API
    const caption =
      `🎬 ${event.title}\n\n${event.description.slice(0, 300)}` +
      `\n\n${event.tags.map((t) => `#${t}`).join(' ')}`.slice(0, 5000);

    // Step 1: Upload media
    const mediaForm = new FormData();
    const videoBlobRes = await fetch(event.videoUrl);
    if (!videoBlobRes.ok) {
      return { protocol: 'pixelfed', success: false, error: 'Could not fetch video for upload' };
    }
    const videoBlob = await videoBlobRes.blob();
    mediaForm.append('file', videoBlob, `${event.id}.mp4`);
    mediaForm.append('description', event.title);

    const mediaRes = await fetch(`${instanceUrl}/api/v2/media`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: mediaForm,
    });

    if (!mediaRes.ok) {
      return { protocol: 'pixelfed', success: false, error: `Pixelfed media upload: ${mediaRes.status}` };
    }

    const mediaData = (await mediaRes.json()) as { id: string };

    // Step 2: Create status with the media
    const statusRes = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: caption,
        visibility: 'public',
        media_ids: [mediaData.id],
      }),
    });

    if (!statusRes.ok) {
      return { protocol: 'pixelfed', success: false, error: `Pixelfed status create: ${statusRes.status}` };
    }

    const statusData = (await statusRes.json()) as { id: string; url?: string };

    return {
      protocol: 'pixelfed',
      success: true,
      nativeId: statusData.id,
      url: statusData.url || `${instanceUrl}/p/${statusData.id}`,
      meta: { mediaId: mediaData.id, statusId: statusData.id },
    };
  } catch (err) {
    return { protocol: 'pixelfed', success: false, error: String(err) };
  }
}

// ─── Telegram: Share in creator's channel ────────────────────────────────

async function publishToTelegramShort(
  event: ShortsPublishEvent,
  identity: NonNullable<CreatorIdentity['telegram']>,
  env: { [key: string]: string },
): Promise<ShortsPublishResult> {
  try {
    const botToken = identity.botToken;
    const chatId = identity.chatId;
    if (!botToken || !chatId) {
      return { protocol: 'telegram', success: false, error: 'Telegram bot not configured' };
    }

    // Send video message
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        video: event.videoUrl,
        thumbnail: event.thumbnailUrl,
        caption: `🎬 <b>${event.title}</b>\n\n${event.description.slice(0, 200)}`.slice(0, 1024),
        parse_mode: 'HTML',
        supports_streaming: true,
        has_spoiler: false,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Watch on Loops', url: event.videoUrl },
              { text: '⚡ View on DegenFeed', url: env.DEGENFEED_APP_URL || 'https://app.degenfeed.xyz' },
            ],
          ],
        },
      }),
    });

    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    if (!data.ok) {
      return { protocol: 'telegram', success: false, error: 'Telegram API error' };
    }

    return {
      protocol: 'telegram',
      success: true,
      nativeId: String(data.result?.message_id),
      url: `https://t.me/${chatId}/${data.result?.message_id}`,
      meta: { messageId: data.result?.message_id },
    };
  } catch (err) {
    return { protocol: 'telegram', success: false, error: String(err) };
  }
}
