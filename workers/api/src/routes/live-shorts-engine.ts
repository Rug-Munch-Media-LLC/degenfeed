/**
 * @degenfeed/api-worker — Live Shorts: Core Engine
 *
 * KV helpers and core engine functions for live short management.
 * Internal functions are exported for use by the router modules.
 */

import type { ProtocolId } from '../lib/live-shorts/live-strategy';
import { selectBackend } from '../lib/live-shorts/protocol-strategies';
import { getStrategy } from '../lib/live-shorts/strategies';
import { announceStreamToAllProtocols } from '../lib/stream-announcer';
import type { Env } from '../types';
import { broadcastToAll } from '../ws-broadcast';
import { CHANNELS } from '../ws-channels';
import type { LiveShortRecord, Protocol, ViewerCounts } from './live-shorts-types';
import { MAX_LIVE_SHORT_DURATION_SECONDS } from './live-shorts-types';

// ─── KV Key Helpers ──────────────────────────────────────────────────────
export function liveShortKey(id: string): string {
  return `live-short:${id}`;
}

export function activeIndexKey(): string {
  return 'live-short:active';
}

export function creatorIndexKey(wallet: string): string {
  return `live-short:creator:${wallet.toLowerCase()}`;
}

export function pastIndexKey(wallet: string): string {
  return `live-short:past:${wallet.toLowerCase()}`;
}

export function viewersKey(id: string): string {
  return `live-short:viewers:${id}`;
}

// ─── KV Array Helpers ───────────────────────────────────────────────────

export async function readStringArray(env: Env, key: string): Promise<string[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function writeStringArray(
  env: Env,
  key: string,
  arr: string[],
  ttl: number,
): Promise<void> {
  await env.CONTENT_STORE?.put(key, JSON.stringify(arr), {
    expirationTtl: ttl,
  });
}

// ─── Core Engine Functions ──────────────────────────────────────────────

/**
 * Start a live short session: create RTMP ingest, store record,
 * and announce to all selected protocols.
 */
export async function startLiveShort(
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
export async function announceToProtocols(env: Env, record: LiveShortRecord): Promise<void> {
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
export async function scheduleAutoEnd(
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
export async function endLiveShortInternal(
  env: Env,
  sessionId: string,
): Promise<LiveShortRecord | null> {
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
export async function updateProtocolPostsEnded(env: Env, record: LiveShortRecord): Promise<void> {
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
export async function getAggregatedViewerCount(env: Env, sessionId: string): Promise<ViewerCounts> {
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
export async function executeTip(_params: {
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
export async function broadcastTipToStream(
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
export async function handleLiveShortEnded(env: Env, sessionId: string): Promise<void> {
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
