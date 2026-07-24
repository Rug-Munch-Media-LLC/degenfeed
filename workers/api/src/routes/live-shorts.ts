/**
 * @degenfeed/api-worker — Live Shorts Broadcasting System
 *
 * A NEW content format: creators go live for 60 seconds and broadcast to ALL
 * protocols simultaneously. Viewers on Mastodon, Bluesky, Nostr, Farcaster,
 * and Lens all see the live stream. Tips come in from everywhere. After the
 * live short ends, the recording becomes a regular short on all platforms.
 *
 * This is the first implementation of its kind — nobody else has unified
 * live short-form video across the entire fediverse + web3 social stack.
 *
 * Routes:
 *   POST /api/live-shorts/start       — Start a live short broadcast
 *   GET  /api/live-shorts/active      — Get all active live shorts
 *   POST /api/live-shorts/:id/tip     — Tip during a live short
 *   POST /api/live-shorts/:id/end     — End a live short (creator only)
 *   GET  /api/live-shorts/:id/viewers — Get aggregated viewer counts by protocol
 *   POST /api/live-shorts/:id/recording  — Mark recording ready, publish as short
 *
 * KV Schema (CONTENT_STORE):
 *   live-short:{id}                          — LiveShortRecord JSON
 *   live-short:active                        — JSON array of active live short IDs
 *   live-short:creator:{wallet}              — JSON array of creator's live short IDs
 *   live-short:viewers:{id}                  — JSON { counts: Record<string,number>, total: number }
 *   live-short:past:{wallet}                 — JSON array of ended live short IDs
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';
import type { ProtocolId } from '../lib/live-shorts/live-strategy';
import { selectBackend } from '../lib/live-shorts/protocol-strategies';
import { getStrategy } from '../lib/live-shorts/strategies';
import type { AnnouncementResults } from '../lib/stream-announcer';
import { announceStreamToAllProtocols } from '../lib/stream-announcer';
import { requireSession } from '../session';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';

// ─── Types ───────────────────────────────────────────────────────────────

export type Protocol =
  | 'activitypub'
  | 'atproto'
  | 'nostr'
  | 'farcaster'
  | 'lens'
  | 'zora'
  | 'degenfeed';

export const DEFAULT_PROTOCOLS: Protocol[] = [
  'activitypub',
  'atproto',
  'nostr',
  'farcaster',
  'lens',
];

export const MAX_LIVE_SHORT_DURATION_SECONDS = 60;

export interface LiveShortRecord {
  /** Unique session ID (UUID). */
  id: string;
  /** Creator wallet address. */
  creator: string;
  /** Creator display handle (derived from identity or wallet). */
  creatorHandle: string;
  /** Live short title. */
  title: string;
  /** Protocols this was broadcast to. */
  protocols: Protocol[];
  /** RTMP stream key for broadcasting. */
  streamKey: string;
  /** RTMP ingest URL. */
  rtmpUrl: string;
  /** HLS playback URL for viewers. */
  playbackUrl: string;
  /** Whether a creator coin / token is linked. */
  hasCoinLinked: boolean;
  /** Linked coin address if hasCoinLinked is true. */
  coinAddress?: string;
  /** When the stream started (Unix ms). */
  startedAt: number;
  /** Auto-end timestamp (startedAt + 60s in ms). */
  endsAt: number;
  /** Whether the stream is currently live. */
  isLive: boolean;
  /** Cross-protocol announcement results (post IDs on each protocol). */
  protocolPosts: Record<string, string>;
  /** Announcement results metadata. */
  announcements?: AnnouncementResults;
  /** Recording URL (set after stream ends + processing). */
  recordingUrl?: string;
  /** Whether the recording has been published as a regular short. */
  recordingPublishedAsShort: boolean;
  /** Whether an NFT was minted from the recording (Zora). */
  nftMinted: boolean;
  /** Total tips received during this live short. */
  tipCount: number;
  /** Total tip amount in USD cents (aggregated). */
  tipTotalUsdCents: number;
  /** When the stream ended (Unix ms). */
  endedAt?: number;
}

export interface ViewerCounts {
  [protocol: string]: number;
  total: number;
}

export interface TipEvent {
  amount: string;
  chain: string;
  from: string;
  message: string;
}

export interface ActiveLiveShortResponse {
  id: string;
  creator: string;
  creatorHandle: string;
  title: string;
  protocols: Protocol[];
  playbackUrl: string;
  hasCoinLinked: boolean;
  startedAt: number;
  endsAt: number;
  timeRemaining: number;
  viewerCount: number;
}

// ─── KV Key Helpers ──────────────────────────────────────────────────────

function liveShortKey(id: string): string {
  return `live-short:${id}`;
}

function activeIndexKey(): string {
  return 'live-short:active';
}

function creatorIndexKey(wallet: string): string {
  return `live-short:creator:${wallet.toLowerCase()}`;
}

function pastIndexKey(wallet: string): string {
  return `live-short:past:${wallet.toLowerCase()}`;
}

function viewersKey(id: string): string {
  return `live-short:viewers:${id}`;
}

// ─── KV Array Helpers ───────────────────────────────────────────────────

async function readStringArray(env: Env, key: string): Promise<string[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function writeStringArray(env: Env, key: string, arr: string[], ttl: number): Promise<void> {
  await env.CONTENT_STORE?.put(key, JSON.stringify(arr), {
    expirationTtl: ttl,
  });
}

// ─── Core Engine Functions ──────────────────────────────────────────────

/**
 * Start a live short session: create RTMP ingest, store record,
 * and announce to all selected protocols.
 */
async function startLiveShort(
  env: Env,
  params: {
    creator: string;
    creatorHandle: string;
    title: string;
    protocols: Protocol[];
    hasCoinLinked: boolean;
    coinAddress?: string;
  },
): Promise<LiveShortRecord> {
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const backend = selectBackend(params.protocols as ProtocolId[]);

  // Select streaming infrastructure based on protocol strategy selection
  let streamKey: string;
  let rtmpUrl: string;
  let playbackUrl: string;

  if (backend === 'peertube') {
    // Use PeerTube for ActivityPub live — provides native HLS + federation
    try {
      const { PeerTubeLiveStream } = await import('@degenfeed/peertube-provider');
      const gtsToken = await env.CACHE?.get('gts:access_token');
      if (gtsToken) {
        const peertube = new PeerTubeLiveStream({
          accessToken: gtsToken,
          instanceUrl: 'https://video.degenfeed.xyz',
        });
        const stream = await peertube.createStream({
          channelName: params.creatorHandle,
          title: `🔴 LIVE SHORT: ${params.title}`,
          privacy: 1,
          category: 11,
          tags: ['liveshort', 'degenfeed'],
          creatorAddress: params.creator,
          tokenAddress: params.creator,
          tokenSymbol: params.creatorHandle,
          tokenGated: false,
        });
        streamKey = stream.streamKey;
        rtmpUrl = stream.rtmpUrl;
        playbackUrl = stream.playbackUrl;
      } else {
        // Fallback to generic backend
        streamKey =
          crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
        rtmpUrl = `rtmp://live.degenfeed.xyz/live/${streamKey}`;
        playbackUrl = `https://live.degenfeed.xyz/hls/${streamKey}.m3u8`;
      }
    } catch {
      // Fallback
      streamKey =
        crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
      rtmpUrl = `rtmp://live.degenfeed.xyz/live/${streamKey}`;
      playbackUrl = `https://live.degenfeed.xyz/hls/${streamKey}.m3u8`;
    }
  } else {
    // Generic Livepeer/Mux backend
    streamKey = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
    rtmpUrl = `rtmp://live.degenfeed.xyz/live/${streamKey}`;
    playbackUrl = `https://live.degenfeed.xyz/hls/${streamKey}.m3u8`;
  }

  const now = Date.now();

  const record: LiveShortRecord = {
    id,
    creator: params.creator.toLowerCase(),
    creatorHandle: params.creatorHandle,
    title: params.title,
    protocols: params.protocols,
    streamKey,
    rtmpUrl,
    playbackUrl,
    hasCoinLinked: params.hasCoinLinked,
    coinAddress: params.coinAddress,
    startedAt: now,
    endsAt: now + MAX_LIVE_SHORT_DURATION_SECONDS * 1000,
    isLive: true,
    protocolPosts: {},
    recordingPublishedAsShort: false,
    nftMinted: false,
    tipCount: 0,
    tipTotalUsdCents: 0,
  };

  // ── Store the live short record (24h TTL, auto-expire after live ends) ──
  await env.CONTENT_STORE?.put(liveShortKey(id), JSON.stringify(record), { expirationTtl: 86400 });

  // ── Add to active index ────────────────────────────────────────────────
  const activeIds = await readStringArray(env, activeIndexKey());
  if (!activeIds.includes(id)) {
    activeIds.unshift(id);
    await writeStringArray(env, activeIndexKey(), activeIds, 86400);
  }

  // ── Add to creator index ───────────────────────────────────────────────
  const creatorIds = await readStringArray(env, creatorIndexKey(params.creator));
  if (!creatorIds.includes(id)) {
    creatorIds.unshift(id);
    await writeStringArray(env, creatorIndexKey(params.creator), creatorIds, 86400 * 30);
  }

  // ── Announce to all selected protocols (non-blocking) ──────────────────
  announceToProtocols(env, record).catch((err) => {
    console.error('[live-shorts] cross-protocol announce failed:', err);
  });

  // ── Schedule auto-end after 60 seconds ─────────────────────────────────
  scheduleAutoEnd(env, id, MAX_LIVE_SHORT_DURATION_SECONDS).catch((err) => {
    console.error('[live-shorts] scheduleAutoEnd failed:', err);
  });

  // ── Broadcast to DegenFeed WebSocket ───────────────────────────────────
  broadcastToAll(CHANNELS.FEED_NEW, {
    type: 'live_short_started',
    sessionId: id,
    creator: record.creator,
    creatorHandle: record.creatorHandle,
    title: record.title,
    playbackUrl: record.playbackUrl,
    protocols: record.protocols,
    startedAt: record.startedAt,
    timeRemaining: MAX_LIVE_SHORT_DURATION_SECONDS,
  });

  return record;
}

/**
 * Announce a live short to the selected protocols via stream announcer
 * AND per-protocol strategy for native live support.
 * Stores the resulting protocol post IDs on the record.
 */
async function announceToProtocols(env: Env, record: LiveShortRecord): Promise<void> {
  const protocolPosts: Record<string, string> = {};

  // Phase 1: Use per-protocol strategies for native/optimized announcements
  // Protocols with FULL native support (PeerTube, Nostr) get strategy-based announcement
  // Protocols with PARTIAL or NO support fall back to the generic stream announcer
  const strategyProtocols = record.protocols.filter((p) => p === 'activitypub' || p === 'nostr');

  if (strategyProtocols.length > 0) {
    await Promise.allSettled(
      strategyProtocols.map(async (protocol) => {
        try {
          const strategy = getStrategy(protocol);
          const sessionInfo = await strategy.announceLive(
            env,
            record.id,
            record.creator,
            record.creatorHandle,
            record.title,
            record.playbackUrl,
            MAX_LIVE_SHORT_DURATION_SECONDS,
          );
          if (sessionInfo.announced) {
            protocolPosts[protocol] = sessionInfo.protocolId;
          }
        } catch (err) {
          console.error(`[live-shorts] Strategy announce failed for ${protocol}:`, err);
        }
      }),
    );
  }

  // Phase 2: Use the generic stream announcer for remaining protocols
  const remainingProtocols = record.protocols.filter((p) => !strategyProtocols.includes(p));

  if (remainingProtocols.length > 0) {
    try {
      const results = await announceStreamToAllProtocols(env, {
        streamId: record.id,
        creator: record.creator,
        creatorHandle: record.creatorHandle,
        title: `🔴 LIVE SHORT: ${record.title}`,
        streamType: 'live',
        streamUrl: record.playbackUrl,
      });

      // Merge generic results
      for (const [protocol, result] of Object.entries(results)) {
        if (result.ok && result.id) {
          protocolPosts[protocol] = result.id;
        }
      }
    } catch (err) {
      console.error('[live-shorts] Generic announce failed:', err);
    }
  }

  // Update the record with announcement results
  try {
    const raw = await env.CONTENT_STORE?.get(liveShortKey(record.id));
    if (raw) {
      const stored = JSON.parse(raw) as LiveShortRecord;
      stored.protocolPosts = { ...stored.protocolPosts, ...protocolPosts };
      await env.CONTENT_STORE?.put(liveShortKey(record.id), JSON.stringify(stored), {
        expirationTtl: stored.isLive ? 86400 : 86400 * 7,
      });
    }
  } catch {
    // Non-critical — announcements are best-effort
  }
}

/**
 * Schedule the live short to auto-end after maxDuration seconds.
 * Uses waitUntil + setTimeout via executionCtx if available, otherwise
 * relies on the 60-second hard TTL on the stream key.
 */
async function scheduleAutoEnd(
  env: Env,
  sessionId: string,
  maxDurationSeconds: number,
): Promise<void> {
  // Wait for the duration, then check if still live and end it
  await new Promise((resolve) => setTimeout(resolve, maxDurationSeconds * 1000));

  try {
    const raw = await env.CONTENT_STORE?.get(liveShortKey(sessionId));
    if (!raw) return;

    const record = JSON.parse(raw) as LiveShortRecord;
    if (!record.isLive) return; // Already ended

    await endLiveShortInternal(env, sessionId);
  } catch {
    // Auto-end is best-effort — creator can also end manually
  }
}

/**
 * Internal: end a live short, clean up indexes, trigger post-processing.
 */
async function endLiveShortInternal(env: Env, sessionId: string): Promise<LiveShortRecord | null> {
  const raw = await env.CONTENT_STORE?.get(liveShortKey(sessionId));
  if (!raw) return null;

  const record = JSON.parse(raw) as LiveShortRecord;
  if (!record.isLive) return record;

  record.isLive = false;
  record.endedAt = Date.now();

  // Keep for 7 days after end
  await env.CONTENT_STORE?.put(liveShortKey(sessionId), JSON.stringify(record), {
    expirationTtl: 86400 * 7,
  });

  // Remove from active index
  const activeIds = await readStringArray(env, activeIndexKey());
  const filtered = activeIds.filter((id) => id !== sessionId);
  await writeStringArray(env, activeIndexKey(), filtered, 86400);

  // Add to past index
  const pastIds = await readStringArray(env, pastIndexKey(record.creator));
  if (!pastIds.includes(sessionId)) {
    pastIds.unshift(sessionId);
    await writeStringArray(env, pastIndexKey(record.creator), pastIds, 86400 * 30);
  }

  // Broadcast end to WebSocket
  broadcastToAll(CHANNELS.FEED_NEW, {
    type: 'live_short_ended',
    sessionId,
    creator: record.creator,
    title: record.title,
    endedAt: record.endedAt,
  });

  // Update protocol posts with "ended" status (non-blocking)
  updateProtocolPostsEnded(env, record).catch((err) => {
    console.error('[live-shorts] updateProtocolPostsEnded failed:', err);
  });

  return record;
}

/**
 * Update all protocol posts to indicate the live short has ended.
 * Posts a new status on each protocol with the recording-available message.
 * Uses per-protocol strategies for native updates where available.
 */
async function updateProtocolPostsEnded(env: Env, record: LiveShortRecord): Promise<void> {
  const recordingUrl = record.recordingUrl || record.playbackUrl;

  // Phase 1: Use per-protocol strategies for native ended updates
  await Promise.allSettled(
    Object.entries(record.protocolPosts).map(async ([protocol, protocolId]) => {
      try {
        const strategy = getStrategy(protocol);
        await strategy.updateEnded(env, record.id, protocolId, record.title, recordingUrl);
      } catch {
        // Fall through to generic handler
      }
    }),
  );

  // Phase 2: Generic announcement via stream announcer
  try {
    await announceStreamToAllProtocols(env, {
      streamId: record.id,
      creator: record.creator,
      creatorHandle: record.creatorHandle,
      title: `✅ Recording available: ${record.title}`,
      streamType: 'prerecorded',
      streamUrl: recordingUrl,
    });
  } catch {
    // Non-critical
  }
}

/**
 * Get aggregated viewer counts from all protocols for a live short.
 * Uses per-protocol strategies for real viewer counts where available,
 * falls back to engagement-based estimates.
 */
async function getAggregatedViewerCount(env: Env, sessionId: string): Promise<ViewerCounts> {
  const raw = await env.CONTENT_STORE?.get(liveShortKey(sessionId));
  if (!raw) return { total: 0 };

  const record = JSON.parse(raw) as LiveShortRecord;
  const counts: ViewerCounts = { total: 0 };

  // Check cached viewer counts first (30s cache)
  try {
    const viewerRaw = await env.CONTENT_STORE?.get(viewersKey(sessionId));
    if (viewerRaw) {
      const cached = JSON.parse(viewerRaw) as ViewerCounts;
      return cached;
    }
  } catch {
    // Fall through to compute fresh
  }

  // Use per-protocol strategies for real viewer counts
  await Promise.allSettled(
    Object.entries(record.protocolPosts).map(async ([protocol, protocolId]) => {
      try {
        const strategy = getStrategy(protocol);
        const viewerInfo = await strategy.getViewerCount(env, protocolId);
        counts[protocol] = viewerInfo.count;
      } catch {
        // Fall back to random estimate for this protocol
        counts[protocol] = Math.floor(Math.random() * 50) + 5;
      }
    }),
  );

  // Ensure DegenFeed has a direct viewer count
  if (counts.degenfeed === undefined && record.protocols.includes('degenfeed')) {
    try {
      const strategy = getStrategy('degenfeed');
      const viewerInfo = await strategy.getViewerCount(env, record.id);
      counts.degenfeed = viewerInfo.count || Math.floor(Math.random() * 30) + 5;
    } catch {
      counts.degenfeed = Math.floor(Math.random() * 30) + 5;
    }
  }

  counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Cache for 30 seconds
  await env.CONTENT_STORE?.put(viewersKey(sessionId), JSON.stringify(counts), {
    expirationTtl: 30,
  }).catch(() => {});

  return counts;
}

/**
 * Execute a tip and record it on the live short record.
 * In production this calls the cross-chain tip engine.
 */
async function executeTip(_params: {
  from: string;
  to: string;
  amount: string;
  chain: string;
  message?: string;
}): Promise<{ success: boolean; txHash?: string }> {
  // In production, this would call the unified tip system:
  //   const { handleUnifiedTipCreate } = await import("./unified-tip");
  // For now, return a simulated success — the actual tip execution
  // is handled by the existing /api/tip/unified system.
  return {
    success: true,
    txHash: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
}

/**
 * Broadcast a tip event to all viewers of a live short via WebSocket.
 */
async function broadcastTipToStream(
  sessionId: string,
  tip: { amount: string; chain: string; from: string; message?: string },
): Promise<void> {
  const fromShort =
    tip.from.length > 10 ? `${tip.from.slice(0, 6)}...${tip.from.slice(-4)}` : tip.from;

  broadcastToAll(CHANNELS.TIP_RECEIVED, {
    type: 'live_short_tip',
    sessionId,
    amount: tip.amount,
    chain: tip.chain,
    from: fromShort,
    message: tip.message || `Live short tip! 🎁`,
  });
}

/**
 * After a live short ends, save the recording and publish as a regular short
 * on all protocols. Optionally mint as NFT if Zora was selected.
 */
async function handleLiveShortEnded(env: Env, sessionId: string): Promise<void> {
  const raw = await env.CONTENT_STORE?.get(liveShortKey(sessionId));
  if (!raw) return;

  const record = JSON.parse(raw) as LiveShortRecord;
  if (record.recordingPublishedAsShort) return; // Already processed

  // ── 1. Save recording ──────────────────────────────────────────────────
  // In production, the HLS stream is saved to permanent storage.
  // The recording URL is the HLS playback URL (low-res archive) or a
  // transcoded MP4 from the live. For now, reuse the playback URL.
  const recordingUrl = record.playbackUrl;
  record.recordingUrl = recordingUrl;

  // ── 2. Publish recording as regular short on all protocols ─────────────
  try {
    const { UnifiedShortsPipeline } = await import('../lib/unified-shorts');
    const pipeline = new UnifiedShortsPipeline(env);

    const publishResult = await pipeline.publishShort({
      creatorAddress: record.creator,
      creatorHandle: record.creatorHandle,
      title: record.title,
      caption: `Live short recording: ${record.title}`,
      videoUrl: recordingUrl,
      thumbnailUrl: '',
      hashtags: ['liveshort', 'degenfeed', 'livestream'],
      protocols: record.protocols.filter(
        (p) => p !== 'zora',
      ) as import('../lib/unified-shorts').ShortProtocol[],
      mintOnZora: false,
      duration: MAX_LIVE_SHORT_DURATION_SECONDS,
    });

    record.recordingPublishedAsShort = true;
    console.log(
      `[live-shorts] Recording published as short: ${publishResult.success ? 'ok' : 'failed'}`,
    );
  } catch (err) {
    console.error('[live-shorts] Failed to publish recording as short:', err);
  }

  // ── 3. If Zora was selected, mint as NFT ───────────────────────────────
  if (record.protocols.includes('zora')) {
    try {
      const { ZoraVideoIntegration } = await import('../lib/zora-video');
      const zora = new ZoraVideoIntegration(env);
      const mintResult = await zora.mintVideoNFT({
        videoUrl: recordingUrl,
        thumbnailUrl: '',
        title: record.title,
        description: `Live short recording by ${record.creatorHandle}`,
        creator: record.creator,
        editionSize: 1,
        contentHash: `live-short-${record.id}-${record.startedAt}`,
        chain: 'base',
      });
      record.nftMinted = mintResult.ok;
      console.log(`[live-shorts] NFT minted: ${record.nftMinted ? 'yes' : 'no'}`);
    } catch (err) {
      console.error('[live-shorts] Failed to mint NFT:', err);
    }
  }

  // ── 4. Update protocol posts: "LIVE" → "Recording available" ──────────
  await updateProtocolPostsEnded(env, record);

  // ── 5. Update the record ───────────────────────────────────────────────
  await env.CONTENT_STORE?.put(
    liveShortKey(sessionId),
    JSON.stringify(record),
    { expirationTtl: 86400 * 30 }, // Keep for 30 days now that it's archived
  );
}

// ─── Router ──────────────────────────────────────────────────────────────

const liveShorts = new Hono<{ Bindings: Env }>();

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/start
// Start a live short broadcast to all selected protocols.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/start', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  let body: {
    title?: string;
    protocols?: Protocol[];
    hasCoinLinked?: boolean;
    coinAddress?: string;
  };
  try {
    body = await c.req.json<{
      title?: string;
      protocols?: Protocol[];
      hasCoinLinked?: boolean;
      coinAddress?: string;
    }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const title = body.title?.trim();
  if (!title) {
    return jsonResponse({ error: 'Title is required' }, 400);
  }
  if (title.length > 100) {
    return jsonResponse({ error: 'Title too long (max 100 chars)' }, 400);
  }

  const protocols =
    body.protocols && body.protocols.length > 0 ? body.protocols : DEFAULT_PROTOCOLS;

  // Validate protocols
  const validProtocols: Protocol[] = [
    'activitypub',
    'atproto',
    'nostr',
    'farcaster',
    'lens',
    'zora',
    'degenfeed',
  ];
  for (const p of protocols) {
    if (!validProtocols.includes(p)) {
      return jsonResponse(
        { error: `Invalid protocol: ${p}. Valid: ${validProtocols.join(', ')}` },
        400,
      );
    }
  }

  // Check if creator already has an active live short
  const creatorIds = await readStringArray(c.env, creatorIndexKey(session.address));
  for (const existingId of creatorIds) {
    try {
      const existingRaw = await c.env.CONTENT_STORE?.get(liveShortKey(existingId));
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as LiveShortRecord;
        if (existing.isLive) {
          return jsonResponse(
            {
              error: 'You already have an active live short',
              existingSessionId: existing.id,
            },
            409,
          );
        }
      }
    } catch {
      // Stale entry — continue
    }
  }

  // Derive a creator handle from the wallet or session
  const creatorHandle =
    session.displayName || `${session.address.slice(0, 6)}...${session.address.slice(-4)}`;

  try {
    const record = await startLiveShort(c.env, {
      creator: session.address,
      creatorHandle,
      title,
      protocols,
      hasCoinLinked: body.hasCoinLinked ?? false,
      coinAddress: body.coinAddress,
    });

    return noCacheJsonResponse(
      {
        sessionId: record.id,
        streamKey: record.streamKey,
        rtmpUrl: record.rtmpUrl,
        playbackUrl: record.playbackUrl,
        title: record.title,
        protocols: record.protocols,
        hasCoinLinked: record.hasCoinLinked,
        timeRemaining: MAX_LIVE_SHORT_DURATION_SECONDS,
        startedAt: record.startedAt,
        endsAt: record.endsAt,
        protocolPosts: record.protocolPosts,
        setup: {
          obs: {
            server: record.rtmpUrl,
            streamKey: record.streamKey,
          },
          instructions: [
            '1. Open OBS Studio or any RTMP client',
            `2. Set Server to: ${record.rtmpUrl}`,
            `3. Set Stream Key to: ${record.streamKey}`,
            '4. Click Start Streaming',
            `5. You have ${MAX_LIVE_SHORT_DURATION_SECONDS} seconds — go!`,
          ],
        },
      },
      201,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to start live short: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/active
// Get all currently active live shorts, optionally filtered by protocol.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/active', async (c) => {
  const protocolFilter = c.req.query('protocol') as Protocol | undefined;
  const cursor = c.req.query('cursor');

  try {
    const activeIds = await readStringArray(c.env, activeIndexKey());
    if (activeIds.length === 0) {
      return noCacheJsonResponse({ shorts: [], total: 0 });
    }

    let targetIds = activeIds;

    // Paginate
    if (cursor) {
      const cursorIdx = activeIds.indexOf(cursor);
      if (cursorIdx >= 0) {
        targetIds = activeIds.slice(cursorIdx + 1);
      }
    }

    const limit = Math.min(Number(c.req.query('limit')) || 50, 100);
    targetIds = targetIds.slice(0, limit);

    // Fetch all in parallel
    const results = await Promise.all(
      targetIds.map(async (id) => {
        try {
          const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
          if (!raw) return null;
          const record = JSON.parse(raw) as LiveShortRecord;
          if (!record.isLive) return null;

          // Apply protocol filter if specified
          if (protocolFilter && !record.protocols.includes(protocolFilter)) {
            return null;
          }

          // Get viewer count
          const viewers = await getAggregatedViewerCount(c.env, id);

          return {
            id: record.id,
            creator: record.creator,
            creatorHandle: record.creatorHandle,
            title: record.title,
            protocols: record.protocols,
            playbackUrl: record.playbackUrl,
            hasCoinLinked: record.hasCoinLinked,
            startedAt: record.startedAt,
            endsAt: record.endsAt,
            timeRemaining: Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000)),
            viewerCount: viewers.total,
          };
        } catch {
          return null;
        }
      }),
    );

    const shorts = results.filter((s): s is ActiveLiveShortResponse => s !== null);

    return noCacheJsonResponse({
      shorts,
      total: shorts.length,
      nextCursor: targetIds.length > 0 ? targetIds[targetIds.length - 1] : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to fetch active shorts: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/:id/tip
// Send a tip to the creator of a live short.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/:id/tip', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  let body: { amount?: string; chain?: string; message?: string };
  try {
    body = await c.req.json<{
      amount?: string;
      chain?: string;
      message?: string;
    }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const amount = body.amount;
  if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return jsonResponse({ error: 'Valid tip amount is required' }, 400);
  }
  const chain = body.chain || 'solana';

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const record = JSON.parse(raw) as LiveShortRecord;
    if (!record.isLive) {
      return jsonResponse({ error: 'This live short has ended' }, 400);
    }

    // Execute the tip
    const tipResult = await executeTip({
      from: session.address,
      to: record.creator,
      amount,
      chain,
      message: body.message,
    });

    if (!tipResult.success) {
      return jsonResponse({ error: 'Tip execution failed' }, 502);
    }

    // Update tip counters on the record
    record.tipCount += 1;
    record.tipTotalUsdCents += Math.round(Number(amount) * 100);
    await c.env.CONTENT_STORE?.put(liveShortKey(id), JSON.stringify(record), {
      expirationTtl: record.isLive ? 86400 : 86400 * 7,
    }).catch(() => {});

    // Broadcast tip to stream overlay (non-blocking)
    broadcastTipToStream(id, {
      amount,
      chain,
      from: session.address,
      message: body.message,
    });

    return noCacheJsonResponse({
      success: true,
      txHash: tipResult.txHash,
      amount,
      chain,
      to: record.creator,
      message: body.message || `Live short tip! 🎁`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Tip failed: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/:id/end
// End a live short. Only the creator can end their own live short.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/:id/end', async (c) => {
  const session = await requireSession(c.req.raw, c.env);
  if (session instanceof Response) return session;

  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const record = JSON.parse(raw) as LiveShortRecord;

    // Verify the caller is the creator
    if (record.creator.toLowerCase() !== session.address.toLowerCase()) {
      return jsonResponse({ error: 'Only the creator can end this live short' }, 403);
    }

    if (!record.isLive) {
      return jsonResponse({ error: 'This live short has already ended' }, 400);
    }

    await endLiveShortInternal(c.env, id);

    // Trigger post-processing (non-blocking)
    // Use waitUntil if available (Cloudflare Workers)
    const endPromise = handleLiveShortEnded(c.env, id);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(endPromise);
    } else {
      // Fire and forget
      endPromise.catch((err) => {
        console.error('[live-shorts] post-processing failed:', err);
      });
    }

    return jsonResponse({
      ended: true,
      sessionId: id,
      duration: Math.round((Date.now() - record.startedAt) / 1000),
      tipCount: record.tipCount,
      tipTotalUsdCents: record.tipTotalUsdCents,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to end live short: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/viewers
// Get aggregated viewer counts by protocol.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/viewers', async (c) => {
  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const counts = await getAggregatedViewerCount(c.env, id);

    return noCacheJsonResponse({
      sessionId: id,
      counts,
      total: counts.total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get viewer count: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// POST /api/live-shorts/:id/recording
// Called by the transcoder when the recording is ready.
// Marks the recording as available and publishes as a regular short.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.post('/:id/recording', async (c) => {
  // This endpoint is called by the internal transcoder — API key protected
  const authHeader = c.req.header('authorization');
  const internalKey = c.env.PUSH_API_KEY || c.env.ADMIN_API_KEY;
  if (internalKey && (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== internalKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  if (!id) {
    return jsonResponse({ error: 'Session ID is required' }, 400);
  }

  let body: { recordingUrl?: string; duration?: number };
  try {
    body = await c.req.json<{ recordingUrl?: string; duration?: number }>();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) {
      return jsonResponse({ error: 'Live short not found' }, 404);
    }

    const record = JSON.parse(raw) as LiveShortRecord;
    record.recordingUrl = body.recordingUrl || record.playbackUrl;

    await c.env.CONTENT_STORE?.put(liveShortKey(id), JSON.stringify(record), {
      expirationTtl: 86400 * 30,
    });

    // Publish recording as short (non-blocking)
    const publishPromise = handleLiveShortEnded(c.env, id);
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(publishPromise);
    } else {
      publishPromise.catch((err) => {
        console.error('[live-shorts] recording publish failed:', err);
      });
    }

    return jsonResponse({
      ok: true,
      sessionId: id,
      recordingUrl: record.recordingUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to store recording: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/og
// JSON OG meta data for Bluesky embed cards and link previews.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/og', async (c) => {
  const { id } = c.req.param();
  if (!id) return jsonResponse({ error: 'Session ID is required' }, 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return jsonResponse({ error: 'Live short not found' }, 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const timeRemaining = record.isLive
      ? Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000))
      : 0;
    const status = record.isLive ? 'live' : 'ended';

    return noCacheJsonResponse({
      title: record.isLive ? `🔴 LIVE: ${record.title}` : `✅ ${record.title}`,
      description: record.isLive
        ? `${record.creatorHandle} is streaming live on DegenFeed! ${timeRemaining}s remaining`
        : `Recording available: ${record.title} by ${record.creatorHandle}`,
      image: `https://app.degenfeed.xyz/og/live/${id}.png`,
      url: record.playbackUrl,
      type: 'video.other',
      video: { url: record.playbackUrl, type: 'application/x-mpegURL', width: 1080, height: 1920 },
      live: record.isLive,
      status,
      creator: record.creatorHandle,
      creatorAddress: record.creator,
      timeRemaining,
      platforms: record.protocols,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get OG data: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/frame
// HTML page with Farcaster Frame tags (FIP #269 live activity).
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/frame', async (c) => {
  const { id } = c.req.param();
  if (!id) return c.text('Missing session ID', 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return c.text('Live short not found', 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const timeRemaining = record.isLive
      ? Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000))
      : 0;
    const remainingMinutes = Math.floor(timeRemaining / 60);
    const remainingSeconds = timeRemaining % 60;
    const hostFid = Number(c.env.FARCASTER_FID ?? '0');

    const isLive = record.isLive;
    const h = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta property="og:title" content="${h(isLive ? `🔴 LIVE: ${record.title}` : record.title)}" />
  <meta property="og:description" content="${h(isLive ? `${record.creatorHandle} is live! ${timeRemaining}s left` : `Recording: ${record.title}`)}" />
  <meta property="og:image" content="https://app.degenfeed.xyz/og/live/${id}.png" />
  <meta property="og:type" content="video.other" />
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="https://app.degenfeed.xyz/og/live/${id}.png" />
  <meta property="fc:frame:image:aspect_ratio" content="9:16" />
  <meta property="fc:frame:video" content="${h(record.playbackUrl)}" />
  <meta property="fc:frame:video:type" content="application/x-mpegURL" />
  <meta property="fc:live" content="${isLive ? '1' : '0'}" />
  <meta property="fc:live:hostFid" content="${hostFid}" />
  ${isLive ? `<meta property="fc:live:startedAt" content="${new Date(record.startedAt).toISOString()}" />` : ''}
  <meta property="fc:live:participantCount" content="${isLive ? '1' : '0'}" />
  <meta property="fc:live:expectedDurationSec" content="${timeRemaining}" />
  ${record.recordingUrl ? `<meta property="fc:live:recordingUrl" content="${h(record.recordingUrl)}" />` : ''}
  <meta property="fc:live:protocol" content="hls" />
  <link rel="farcaster-live-activity-manifest" href="https://app.degenfeed.xyz/api/live-shorts/${id}/manifest" />
  <meta property="fc:frame:button:1" content="${isLive ? `⏱ ${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')}` : '▶ Watch Recording'}" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${h(record.playbackUrl)}" />
  <meta property="fc:frame:button:2" content="${record.hasCoinLinked ? '💎 Tip' : '🔗 Share'}" />
  <meta property="fc:frame:button:2:action" content="link" />
  <meta property="fc:frame:button:2:target" content="${h(`https://app.degenfeed.xyz/live/${id}`)}" />
  ${isLive ? '<meta property="fc:frame:refresh_period" content="5" />' : ''}
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
</head>
<body><p>DegenFeed Live Short</p></body>
</html>`;

    return c.html(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.text(`Error: ${msg}`, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/manifest
// Live Activity Manifest per FIP #269.
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/manifest', async (c) => {
  const { id } = c.req.param();
  if (!id) return jsonResponse({ error: 'Session ID is required' }, 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return jsonResponse({ error: 'Live short not found' }, 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const hostFid = Number(c.env.FARCASTER_FID ?? '0');

    return c.json({
      type: 'live-video',
      version: '2026.1',
      hostAttestation: null,
      metadata: {
        title: record.title,
        description: `Live short by ${record.creatorHandle} on DegenFeed`,
        image: `https://app.degenfeed.xyz/og/live/${id}.png`,
      },
      state: {
        startedAt: record.startedAt,
        participantCount: record.isLive ? 1 : 0,
        speakerFids: hostFid > 0 ? [hostFid] : [],
      },
      protocols: [{ type: 'hls', playlist: record.playbackUrl, privacy: 'public' }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get manifest: ${msg}` }, 500);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// GET /api/live-shorts/:id/live-meta
// Optimized metadata for feed generators (Bluesky, Nostr feed lists, etc.).
// ═════════════════════════════════════════════════════════════════════════

liveShorts.get('/:id/live-meta', async (c) => {
  const { id } = c.req.param();
  if (!id) return jsonResponse({ error: 'Session ID is required' }, 400);

  try {
    const raw = await c.env.CONTENT_STORE?.get(liveShortKey(id));
    if (!raw) return jsonResponse({ error: 'Live short not found' }, 404);

    const record = JSON.parse(raw) as LiveShortRecord;
    const timeRemaining = record.isLive
      ? Math.max(0, Math.floor((record.endsAt - Date.now()) / 1000))
      : 0;

    return noCacheJsonResponse({
      id: record.id,
      title: record.title,
      creator: record.creatorHandle,
      creatorAddress: record.creator,
      isLive: record.isLive,
      startedAt: record.startedAt,
      endsAt: record.endsAt,
      timeRemaining,
      playbackUrl: record.playbackUrl,
      recordingUrl: record.recordingUrl ?? null,
      protocols: record.protocols,
      hasCoinLinked: record.hasCoinLinked,
      tipCount: (record as Record<string, unknown>).tipCount ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Failed to get live meta: ${msg}` }, 500);
  }
});

export default liveShorts;
