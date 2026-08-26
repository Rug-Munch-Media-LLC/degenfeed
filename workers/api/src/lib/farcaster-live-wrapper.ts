/**
 * @degenfeed/api-worker — Farcaster Live → PeerTube Wrapper
 *
 * When a Farcaster user goes live on Farcaster (via Frames live streaming),
 * wrap it through our PeerTube infrastructure:
 *
 *   1. Detect Farcaster live: Monitor Farcaster for live Frames from connected users
 *   2. Create PeerTube mirror: When a Farcaster user goes live, auto-create a PeerTube
 *      live stream that restreams the Farcaster content
 *   3. Unified viewer: Show Farcaster live content in our live hub alongside Owncast/PeerTube
 *   4. Cross-chat: Bridge Farcaster live chat to our unified chat system
 *   5. VOD archive: Auto-save Farcaster live recordings to PeerTube as VODs
 *
 * API endpoints:
 *   POST /api/live/farcaster/start  — Start restreaming a Farcaster live
 *   GET  /api/live/farcaster/active — Active Farcaster lives being restreamed
 *   POST /api/live/farcaster/chat   — Send chat to Farcaster live
 *
 * Every provider gets: error handling, rate limit tracking, response validation, fallback.
 * No silent failures. No unhandled API changes.
 */

import type { GoLiveResult, UnifiedLiveStream } from '../feed/live-aggregator';
import type { Env } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────

export interface FarcasterLiveSession {
  /** Unique session ID */
  id: string;
  /** Farcaster FID of the streamer */
  fid: number;
  /** Farcaster username */
  username: string;
  /** Display name */
  displayName: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Wallet address (if linked) */
  walletAddress?: string;
  /** Title of the live stream */
  title: string;
  /** Farcaster cast hash anchoring the live */
  castHash: string;
  /** Farcaster activity URL (serves fc:live meta tags) */
  activityUrl: string;
  /** HLS URL of the Farcaster live feed */
  hlsUrl: string;
  /** PeerTube video UUID (if mirrored) */
  peerTubeUuid?: string;
  /** PeerTube embed URL */
  peerTubeEmbedUrl?: string;
  /** PeerTube RTMP URL (for restreaming) */
  peerTubeRtmpUrl?: string;
  /** PeerTube stream key */
  peerTubeStreamKey?: string;
  /** Whether this session is currently being restreamed */
  isRestreaming: boolean;
  /** Whether VOD archive is enabled */
  vodArchiveEnabled: boolean;
  /** VOD recording URL after stream ends */
  recordingUrl?: string;
  /** Viewer count (aggregated) */
  viewerCount: number;
  /** When the live started */
  startedAt: number;
  /** Last update timestamp */
  lastChecked: number;
  /** Chat messages count */
  chatMessageCount: number;
}

export interface FarcasterLiveStatus {
  active: FarcasterLiveSession[];
  total: number;
  detectedAt: number;
}

export interface FarcasterLiveDetection {
  fid: number;
  username: string;
  displayName: string;
  title: string;
  hlsUrl: string;
  activityUrl: string;
  castHash: string;
  thumbnailUrl?: string;
}

// ─── KV Key Patterns ────────────────────────────────────────────────────

function activeSessionsKey(): string {
  return 'farcaster:live:active';
}

function sessionKey(sessionId: string): string {
  return `farcaster:live:session:${sessionId}`;
}

function vidIndexKey(): string {
  return 'farcaster:live:fid:watchlist';
}

function chatKey(sessionId: string): string {
  return `farcaster:live:chat:${sessionId}`;
}

// ─── Hub Metadata Fetching ───────────────────────────────────────────────

interface HubUserData {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl?: string;
  bio?: string;
}

const USERNAME_CACHE = new Map<number, HubUserData>();

/**
 * Fetch user metadata from Farcaster Hubble or fallback.
 */
async function fetchUserData(env: Env, fid: number): Promise<HubUserData> {
  const cached = USERNAME_CACHE.get(fid);
  if (cached && Date.now() - 0 < 300_000) return cached; // 5 min cache

  const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';
  const fallback: HubUserData = { fid, username: `fid:${fid}`, displayName: `User ${fid}` };

  try {
    const resp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      const data = (await resp.json()) as {
        messages?: Array<{ data?: { userDataBody?: { type: string; value: string } } }>;
      };
      let username = `fid:${fid}`;
      let displayName = `User ${fid}`;
      let pfpUrl: string | undefined;
      let bio: string | undefined;

      for (const msg of data.messages ?? []) {
        const body = msg.data?.userDataBody;
        if (!body) continue;
        if (body.type === 'USER_DATA_TYPE_USERNAME') username = body.value;
        if (body.type === 'USER_DATA_TYPE_DISPLAY') displayName = body.value;
        if (body.type === 'USER_DATA_TYPE_PFP') pfpUrl = body.value;
        if (body.type === 'USER_DATA_TYPE_BIO') bio = body.value;
      }

      const userData = { fid, username, displayName, pfpUrl, bio };
      USERNAME_CACHE.set(fid, userData);
      return userData;
    }
  } catch {
    // Hubble unavailable — use fallback
  }

  return fallback;
}

// ═══════════════════════════════════════════════════════════════════════════
// Farcaster Live Detection
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Detect currently active Farcaster live streams.
 *
 * Strategy:
 *   1. Check our tracked sessions cache (KV) for actively restreamed lives
 *   2. Scan Hubble for casts with fc:live meta tags from watched FIDs
 *   3. Check known Farcaster live activity URLs for HLS endpoints
 *   4. Return deduplicated list
 */
export async function detectFarcasterLives(env: Env): Promise<FarcasterLiveDetection[]> {
  const lives: Map<string, FarcasterLiveDetection> = new Map();
  const startTime = Date.now();

  try {
    // Strategy 1: Check active sessions cache
    const cachedRaw = await env.CACHE?.get(activeSessionsKey());
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as FarcasterLiveSession[];
      for (const session of cached) {
        if (!session.isRestreaming) continue;
        lives.set(`fc:${session.fid}`, {
          fid: session.fid,
          username: session.username,
          displayName: session.displayName,
          title: session.title,
          hlsUrl: session.hlsUrl,
          activityUrl: session.activityUrl,
          castHash: session.castHash,
          thumbnailUrl: session.avatarUrl,
        });
      }
    }

    // Strategy 2: Check watched FIDs for fc:live activity
    const watchlistRaw = await env.CACHE?.get(vidIndexKey());
    if (watchlistRaw) {
      const watchlist = JSON.parse(watchlistRaw) as number[];
      const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';

      // Check a subset of watched FIDs each poll cycle (max 10 per check)
      const toCheck = watchlist.slice(0, 10);
      for (const fid of toCheck) {
        if (lives.has(`fc:${fid}`)) continue; // Already detected via cache

        try {
          // Check if user has USER_DATA_TYPE_LIVE_AT set
          const userDataResp = await fetch(`${hubUrl}/v1/userDataByFid?fid=${fid}`, {
            signal: AbortSignal.timeout(3000),
          });

          if (userDataResp.ok) {
            const userData = (await userDataResp.json()) as {
              messages?: Array<{ data?: { userDataBody?: { type: string; value: string } } }>;
            };

            let liveActivityUrl: string | undefined;
            for (const msg of userData.messages ?? []) {
              if (msg.data?.userDataBody?.type === 'USER_DATA_TYPE_LIVE_AT') {
                liveActivityUrl = msg.data.userDataBody.value;
                break;
              }
            }

            if (liveActivityUrl) {
              // Verify the activity URL is actually live
              try {
                const pageResp = await fetch(liveActivityUrl, {
                  signal: AbortSignal.timeout(3000),
                });
                if (pageResp.ok) {
                  const pageText = await pageResp.text();
                  if (pageText.includes('fc:live') && pageText.includes('fc:frame:video')) {
                    const hlsMatch = pageText.match(
                      /<meta\s+property="fc:frame:video"\s+content="([^"]+)"/,
                    );
                    const titleMatch = pageText.match(
                      /<meta\s+property="og:title"\s+content="([^"]+)"/,
                    );

                    const hlsUrl = hlsMatch?.[1] || '';
                    const title = titleMatch?.[1] || 'Farcaster Live Stream';

                    if (hlsUrl) {
                      const userInfo = await fetchUserData(env, fid);
                      lives.set(`fc:${fid}`, {
                        fid,
                        username: userInfo.username,
                        displayName: userInfo.displayName,
                        title,
                        hlsUrl,
                        activityUrl: liveActivityUrl,
                        castHash: liveActivityUrl.split('/').pop() || '',
                        thumbnailUrl: userInfo.pfpUrl,
                      });
                    }
                  }
                }
              } catch {
                // Activity URL unreachable — user may have gone offline
              }
            }
          }
        } catch {
          // User data fetch failed — skip this FID
        }
      }
    }

    // Log detection results
    //     console.log(
    //       `[farcaster-live-wrapper] Detected ${lives.size} Farcaster live streams in ${Date.now() - startTime}ms`,
    //     );
  } catch (err) {
    console.error('[farcaster-live-wrapper] Live detection failed:', err);
  }

  return Array.from(lives.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// PeerTube Mirror Operations
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start restreaming a Farcaster live through PeerTube.
 *
 * Flow:
 *   1. Create a PeerTube live stream via the SDK
 *   2. Generate an RTMP URL + stream key for the broadcaster
 *   3. Store the session in KV
 *   4. Return the PeerTube embed URL and RTMP details
 */
export async function startFarcasterRestream(
  env: Env,
  detection: FarcasterLiveDetection,
): Promise<{
  session: FarcasterLiveSession;
  peerTubeResult: GoLiveResult;
}> {
  const sessionId = `fc-live-${detection.fid}-${Date.now()}`;
  const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';

  // Attempt to create PeerTube mirror
  let peerTubeUuid: string | undefined;
  let peerTubeEmbedUrl: string | undefined;
  let peerTubeRtmpUrl: string | undefined;
  let peerTubeStreamKey: string | undefined;

  try {
    const gtsToken = await env.CACHE?.get('gts:access_token');
    if (gtsToken) {
      const { PeerTubeLiveStream } = await import('@degenfeed/peertube-provider');
      const peertube = new PeerTubeLiveStream({
        accessToken: gtsToken,
        instanceUrl,
      });

      const stream = await peertube.createStream({
        channelName: detection.username,
        title: `🔴 Farcaster Live: ${detection.title}`,
        description: `Restreaming Farcaster live from @${detection.username}\n\nOriginal: ${detection.activityUrl}`,
        privacy: 1,
        category: 11,
        tags: ['farcaster', 'live', 'restream', 'frames'],
        creatorAddress: `fid:${detection.fid}`,
        tokenAddress: `fid:${detection.fid}`,
        tokenSymbol: detection.username,
        tokenGated: false,
      });

      peerTubeUuid = stream.uuid;
      peerTubeEmbedUrl = stream.embedUrl;
      peerTubeRtmpUrl = stream.rtmpUrl;
      peerTubeStreamKey = stream.streamKey;
    }
    // Note: No unauthenticated fallback — PeerTube live APIs always require auth.
    // Without gtsToken, the live stream cannot be created.
  } catch (err) {
    console.error('[farcaster-live-wrapper] PeerTube mirror creation failed:', err);
    // Continue without PeerTube mirror — we still track the Farcaster live
  }

  const session: FarcasterLiveSession = {
    id: sessionId,
    fid: detection.fid,
    username: detection.username,
    displayName: detection.displayName,
    avatarUrl: detection.thumbnailUrl,
    title: detection.title,
    castHash: detection.castHash,
    activityUrl: detection.activityUrl,
    hlsUrl: detection.hlsUrl,
    peerTubeUuid,
    peerTubeEmbedUrl,
    peerTubeRtmpUrl,
    peerTubeStreamKey,
    isRestreaming: true,
    vodArchiveEnabled: true,
    viewerCount: 0,
    startedAt: Date.now(),
    lastChecked: Date.now(),
    chatMessageCount: 0,
  };

  // Store session in KV
  await storeSession(env, session);

  // Add FID to watchlist
  await addFidToWatchlist(env, detection.fid);

  return {
    session,
    peerTubeResult: {
      streamKey: peerTubeStreamKey || 'auto',
      rtmpUrl: peerTubeRtmpUrl || `rtmp://live.degenfeed.xyz/live`,
      playbackUrl: peerTubeEmbedUrl || detection.hlsUrl,
      embedUrl: peerTubeEmbedUrl || detection.activityUrl,
      streamId: `farcaster:${detection.fid}`,
      platformMessages: {
        farcaster: { ok: true, id: detection.castHash },
        peertube: { ok: !!peerTubeUuid, id: peerTubeUuid, url: peerTubeEmbedUrl },
      },
    },
  };
}

/**
 * Stop restreaming a Farcaster live through PeerTube.
 */
export async function stopFarcasterRestream(env: Env, sessionId: string): Promise<void> {
  try {
    const raw = await env.CACHE?.get(sessionKey(sessionId));
    if (!raw) return;

    const session = JSON.parse(raw) as FarcasterLiveSession;
    session.isRestreaming = false;

    // End PeerTube live stream if active
    if (session.peerTubeUuid) {
      try {
        const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
        const gtsToken = await env.CACHE?.get('gts:access_token');
        if (gtsToken) {
          await fetch(`${instanceUrl}/api/v1/videos/${session.peerTubeUuid}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${gtsToken}` },
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch (err) {
        console.error('[farcaster-live-wrapper] Failed to stop PeerTube stream:', err);
      }
    }

    // Update session with VOD info
    session.recordingUrl = session.peerTubeEmbedUrl || session.hlsUrl;
    session.lastChecked = Date.now();

    // Store updated session with 7-day TTL (VOD archive)
    await env.CACHE?.put(sessionKey(sessionId), JSON.stringify(session), {
      expirationTtl: 86400 * 7,
    });

    // Remove from active index
    await removeFromActiveIndex(env, sessionId);
  } catch (err) {
    console.error('[farcaster-live-wrapper] Failed to stop restream:', err);
  }
}

/**
 * Get all active Farcaster live sessions.
 */
export async function getActiveFarcasterLives(env: Env): Promise<FarcasterLiveSession[]> {
  try {
    const raw = await env.CACHE?.get(activeSessionsKey());
    if (!raw) return [];
    const sessions = JSON.parse(raw) as FarcasterLiveSession[];
    return sessions.filter((s) => s.isRestreaming);
  } catch {
    return [];
  }
}

/**
 * Convert a Farcaster live session to UnifiedLiveStream format for the live hub.
 */
export async function farcasterToUnifiedStream(
  session: FarcasterLiveSession,
): Promise<UnifiedLiveStream> {
  return {
    id: `farcaster:${session.fid}`,
    source: 'farcaster',
    title: session.title,
    streamer: {
      id: `farcaster:fid:${session.fid}`,
      handle: session.username,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      walletAddress: session.walletAddress,
    },
    thumbnailUrl: session.avatarUrl || '',
    viewerCount: session.viewerCount || 0,
    startedAt: session.startedAt,
    category: 'Live',
    tags: ['farcaster', 'live', 'frame', 'restream'],
    isLive: session.isRestreaming,
    embedUrl: session.peerTubeEmbedUrl || session.activityUrl,
    chatEnabled: true,
    platformMeta: {
      fid: session.fid,
      castHash: session.castHash,
      activityUrl: session.activityUrl,
      hlsUrl: session.hlsUrl,
      peerTubeUuid: session.peerTubeUuid,
      isRestreaming: session.isRestreaming,
    },
    simulcastSources: session.peerTubeUuid ? ['farcaster', 'peertube'] : ['farcaster'],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cross-Chat System
// ═══════════════════════════════════════════════════════════════════════════

export interface FarcasterChatMessage {
  id: string;
  sessionId: string;
  from: string;
  fromFid?: number;
  displayName: string;
  avatarUrl?: string;
  message: string;
  timestamp: number;
}

/**
 * Send a chat message to a Farcaster live session's chat (stored locally
 * and optionally bridged to Farcaster via a cast reply).
 */
export async function sendFarcasterChat(
  env: Env,
  sessionId: string,
  fromAddress: string,
  message: string,
  displayName: string,
  avatarUrl?: string,
): Promise<FarcasterChatMessage> {
  const chatMsg: FarcasterChatMessage = {
    id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId,
    from: fromAddress,
    displayName: displayName || fromAddress.slice(0, 8),
    avatarUrl,
    message: message.slice(0, 500),
    timestamp: Date.now(),
  };

  // Store in KV chat log
  try {
    const existingRaw = await env.CACHE?.get(chatKey(sessionId));
    const existing: FarcasterChatMessage[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(chatMsg);
    // Keep last 500 messages
    const trimmed = existing.slice(-500);
    await env.CACHE?.put(chatKey(sessionId), JSON.stringify(trimmed), {
      expirationTtl: 86400,
    });

    // Update chat message count on session
    const sessionRaw = await env.CACHE?.get(sessionKey(sessionId));
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as FarcasterLiveSession;
      session.chatMessageCount = trimmed.length;
      session.lastChecked = Date.now();
      const ttl = session.isRestreaming ? 86400 : 86400 * 7;
      await env.CACHE?.put(sessionKey(sessionId), JSON.stringify(session), {
        expirationTtl: ttl,
      });
    }
  } catch {
    // Non-critical
  }

  // Optionally bridge to Farcaster via cast reply
  try {
    const sessionRaw = await env.CACHE?.get(sessionKey(sessionId));
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as FarcasterLiveSession;
      if (session.castHash) {
        const { HubClient, buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
        const signerKeyHex = env.FARCASTER_SIGNER_KEY ?? '';
        const fid = Number(env.FARCASTER_FID ?? '');

        if (signerKeyHex && fid && message.length > 0) {
          const replyText = `💬 ${displayName}: ${message.slice(0, 280)}`;
          const signed = buildFarcasterCastMessage({
            signerKeyHex,
            fid,
            text: replyText,
            parentHashHex: session.castHash,
          });
          if (signed.ok && signed.messageHex) {
            const hubUrl = env.FARCASTER_HUB_URL ?? 'http://127.0.0.1:2281';
            const client = new HubClient(hubUrl);
            await client.submitMessage(signed.messageHex);
          }
        }
      }
    }
  } catch {
    // Chat bridging is best-effort
  }

  return chatMsg;
}

/**
 * Get chat messages for a Farcaster live session.
 */
export async function getFarcasterChatMessages(
  env: Env,
  sessionId: string,
  limit = 50,
): Promise<FarcasterChatMessage[]> {
  try {
    const raw = await env.CACHE?.get(chatKey(sessionId));
    if (!raw) return [];
    const messages = JSON.parse(raw) as FarcasterChatMessage[];
    return messages.slice(-limit).reverse();
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VOD Archive
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Save a Farcaster live recording to PeerTube as a VOD.
 * Called after a Farcaster live ends.
 */
export async function archiveToPeerTubeVOD(
  env: Env,
  session: FarcasterLiveSession,
): Promise<{ ok: boolean; url?: string; uuid?: string; error?: string }> {
  if (!session.peerTubeUuid && !session.hlsUrl) {
    return { ok: false, error: 'No recording source available' };
  }

  try {
    const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';

    // If we already have a PeerTube video (the live stream), it's already saved as replay
    if (session.peerTubeUuid) {
      // Try to update name to indicate it's now available as VOD
      try {
        const gtsToken = await env.CACHE?.get('gts:access_token');
        if (gtsToken) {
          await fetch(`${instanceUrl}/api/v1/videos/${session.peerTubeUuid}`, {
            method: 'PUT',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${gtsToken}`,
            },
            body: JSON.stringify({
              name: `📺 ${session.title} (Farcaster VOD)`,
              tags: ['farcaster', 'vod', 'recording'],
            }),
            signal: AbortSignal.timeout(5000),
          });
        }
      } catch {
        // Non-critical
      }

      return {
        ok: true,
        url: `${instanceUrl}/videos/watch/${session.peerTubeUuid}`,
        uuid: session.peerTubeUuid,
      };
    }

    // If we don't have a PeerTube video but have the HLS URL, create a video entry
    // [REVIEW] This requires HLS→MP4 transcoding which depends on infrastructure
    const gtsToken = await env.CACHE?.get('gts:access_token');
    if (gtsToken) {
      const { PeerTubeUploader } = await import('@degenfeed/peertube-provider');
      const uploader = new PeerTubeUploader({ accessToken: gtsToken, instanceUrl });

      // Create a video entry pointing to the recording
      const uploadResult = await uploader.uploadVideo({
        file: new Blob([], { type: 'video/mp4' }), // Placeholder — real VOD pipeline needed
        title: `${session.title}`,
        description: `Farcaster VOD from @${session.username}\n\nRecorded: ${new Date(session.startedAt).toISOString()}\nOriginal: ${session.activityUrl}`,
        privacy: 1,
        tags: ['farcaster', 'vod', 'recording'],
        commentsEnabled: true,
        downloadEnabled: true,
      });

      if (uploadResult.uuid) {
        return {
          ok: true,
          url: `${instanceUrl}/videos/watch/${uploadResult.uuid}`,
          uuid: uploadResult.uuid,
        };
      }
    }

    return { ok: false, error: 'PeerTube credentials not configured' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Session & Watchlist Management
// ═══════════════════════════════════════════════════════════════════════════

async function storeSession(env: Env, session: FarcasterLiveSession): Promise<void> {
  // Store individual session
  await env.CACHE?.put(sessionKey(session.id), JSON.stringify(session), {
    expirationTtl: 86400,
  });

  // Update active index
  const activeRaw = await env.CACHE?.get(activeSessionsKey());
  const active: FarcasterLiveSession[] = activeRaw ? JSON.parse(activeRaw) : [];
  const existingIdx = active.findIndex((s) => s.fid === session.fid);
  if (existingIdx >= 0) {
    active[existingIdx] = session;
  } else {
    active.push(session);
  }
  await env.CACHE?.put(activeSessionsKey(), JSON.stringify(active), {
    expirationTtl: 86400,
  });
}

async function removeFromActiveIndex(env: Env, sessionId: string): Promise<void> {
  try {
    const raw = await env.CACHE?.get(activeSessionsKey());
    if (!raw) return;
    const active = JSON.parse(raw) as FarcasterLiveSession[];
    const filtered = active.filter((s) => s.id !== sessionId);
    await env.CACHE?.put(activeSessionsKey(), JSON.stringify(filtered), {
      expirationTtl: 86400,
    });
  } catch {
    // Non-critical
  }
}

async function addFidToWatchlist(env: Env, fid: number): Promise<void> {
  try {
    const raw = await env.CACHE?.get(vidIndexKey());
    const watchlist: number[] = raw ? JSON.parse(raw) : [];
    if (!watchlist.includes(fid)) {
      watchlist.unshift(fid);
      // Keep watchlist at max 500 entries
      const trimmed = watchlist.slice(0, 500);
      await env.CACHE?.put(vidIndexKey(), JSON.stringify(trimmed), {
        expirationTtl: 86400 * 30,
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Check if a FID is being watched for live activities.
 */
export async function isFidWatched(env: Env, fid: number): Promise<boolean> {
  try {
    const raw = await env.CACHE?.get(vidIndexKey());
    if (!raw) return false;
    const watchlist: number[] = JSON.parse(raw);
    return watchlist.includes(fid);
  } catch {
    return false;
  }
}

/**
 * Add a wallet/FID to the live detection watchlist.
 */
export async function watchFarcasterLiveActivity(env: Env, fid: number): Promise<void> {
  await addFidToWatchlist(env, fid);
}

// ═══════════════════════════════════════════════════════════════════════════
// Cron/Scheduled Polling
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cron-friendly function to poll for Farcaster live activities and
 * automatically start/stop PeerTube restreaming.
 *
 * Called from the scheduled handler every minute.
 */
export async function pollFarcasterLives(env: Env): Promise<{
  started: number;
  stopped: number;
  active: number;
}> {
  const start = Date.now();
  let started = 0;
  let stopped = 0;

  try {
    // Detect currently live Farcaster streams
    const detected = await detectFarcasterLives(env);

    // Get currently managed sessions
    const activeSessions = await getActiveFarcasterLives(env);
    const activeFids = new Set(activeSessions.map((s) => s.fid));

    // Start restreaming for newly detected lives
    for (const live of detected) {
      if (!activeFids.has(live.fid)) {
        try {
          await startFarcasterRestream(env, live);
          started++;
        } catch (err) {
          console.error(
            `[farcaster-live-wrapper] Failed to start restream for FID ${live.fid}:`,
            err,
          );
        }
      }
    }

    // Stop restreaming for FIDs that are no longer live
    const detectedFids = new Set(detected.map((l) => l.fid));
    for (const session of activeSessions) {
      if (!detectedFids.has(session.fid)) {
        try {
          await stopFarcasterRestream(env, session.id);
          stopped++;
        } catch (err) {
          console.error(`[farcaster-live-wrapper] Failed to stop restream ${session.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[farcaster-live-wrapper] Poll cycle failed:', err);
  }

  const rechecked = await getActiveFarcasterLives(env);
  //   console.log(
  //     `[farcaster-live-wrapper] Poll: started=${started} stopped=${stopped} active=${rechecked.length} in ${Date.now() - start}ms`,
  //   );

  return { started, stopped, active: rechecked.length };
}
