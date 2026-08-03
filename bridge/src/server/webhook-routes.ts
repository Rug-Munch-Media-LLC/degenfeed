// ═══════════════════════════════════════════════════════════════════════════
// Owncast Webhook Receiver — Live Video Phase 2
//
// Receives Owncast stream lifecycle webhooks and orchestrates the auto-
// restream pipeline:
//
//   STREAM_STARTED
//     1. Authenticate to PeerTube (OAuth2 password grant)
//     2. Create a PeerTube live video → get streamKey + rtmpUrl
//     3. Create a Restreamer process (Owncast HLS input → PeerTube RTMP
//        output, autostart: true) so the live stream is re-published
//
//   STREAM_STOPPED
//     1. Stop + delete the Restreamer process
//     2. End the PeerTube live video
//     3. Publish a Nostr status event ("ended") — best effort
//
// Owncast webhook payload (confirmed from owncast/owncast source):
//   { type: "STREAM_STARTED" | "STREAM_STOPPED",
//     eventData: { id, name, summary, streamTitle, status, serverURL, timestamp } }
//
// Restreamer API (datarhei core, confirmed from docs.datarhei.com):
//   POST /api/v3/process            — create process
//   PUT   /api/v3/process/{id}/command  — {"command": "start"|"stop"}
//   DELETE /api/v3/process/{id}     — delete process
//   Auth: Authorization: Bearer <RS_TOKEN>
//
// PeerTube API (confirmed from peertube source):
//   POST /api/v1/users/token        — OAuth2 password grant → { access_token }
//   GET  /api/v1/users/me           — → { videoChannels: [{ id }] }
//   POST /api/v1/videos/live        — → { video: { id, uuid, rtmpUrl, streamKey } }
//   DELETE /api/v1/videos/{id}      — ends + removes live video
//   Auth: Authorization: Bearer <access_token>
// ═══════════════════════════════════════════════════════════════════════════

import type http from 'node:http';
import { getPublicKey, signEvent } from '@degenfeed/nostr-sdk';
import WebSocket from 'ws';

// ─── Types ───────────────────────────────────────────────────────────────

interface OwncastWebhookEvent {
  type?: string;
  eventData?: {
    id?: string;
    name?: string;
    streamTitle?: string;
    serverURL?: string;
    timestamp?: string;
  };
}

interface LiveProcessState {
  processId: string;
  videoId: string;
  videoUuid: string;
  streamTitle: string;
  startedAt: number;
}

// ─── In-Memory State (streamId → live process) ───────────────────────────
// Owncast sends a shortid in eventData.id that stays stable for the duration
// of a stream, so we key on it. Falls back to a derived key when absent.

const liveProcesses = new Map<string, LiveProcessState>();

// ─── Configuration ───────────────────────────────────────────────────────

const HTTP_TIMEOUT_MS = 10_000;

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function config() {
  return {
    owncastUrl: env('OWNCAST_URL', 'http://127.0.0.1:8092'),
    restreamerUrl: env('RESTREAMER_URL', 'http://127.0.0.1:8088'),
    rsToken: env('RS_TOKEN', ''),
    peertubeBaseUrl: env('PEERTUBE_BASE_URL', 'http://127.0.0.1:9011'),
    peertubeClientId: env('PEERTUBE_CLIENT_ID', ''),
    peertubeClientSecret: env('PEERTUBE_CLIENT_SECRET', ''),
    peertubeUsername: env('PEERTUBE_USERNAME', 'root'),
    peertubePassword: env('PEERTUBE_PASSWORD', ''),
    nostrRelayUrl: env('NOSTR_RELAY_URL', 'ws://127.0.0.1:8085'),
    nostrPrivateKeyHex: env('NOSTR_PRIVATE_KEY_HEX', ''),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function jsonError(res: http.ServerResponse, status: number, code: string, message: string) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: { code, message } }));
}

function jsonOk(res: http.ServerResponse, data: unknown) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Derive a stable stream id. Owncast provides a shortid in eventData.id that
 * is unique per stream session; fall back to a hash of serverURL+streamTitle.
 */
function deriveStreamId(ev: OwncastWebhookEvent): string {
  const id = ev.eventData?.id;
  if (id && /^[a-zA-Z0-9_-]{1,64}$/.test(id)) return `owncast-${id}`;
  const title = ev.eventData?.streamTitle || 'stream';
  const server = ev.eventData?.serverURL || 'owncast';
  const base = `${server}|${title}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }
  return `owncast-${Math.abs(hash).toString(36)}`;
}

/**
 * Rewrite a host:port URL so it is reachable from inside the Restreamer
 * container. Restreamer reaches the Docker host via host.docker.internal.
 */
function toContainerAddress(rawUrl: string, fallbackHost: string, fallbackPort: string): string {
  try {
    const u = new URL(rawUrl);
    u.hostname = 'host.docker.internal';
    return u.toString().replace(/\/$/, '');
  } catch {
    return `${fallbackHost}:${fallbackPort}`;
  }
}

// ─── Restreamer API ──────────────────────────────────────────────────────

async function restreamerApi(
  cfg: ReturnType<typeof config>,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  if (!cfg.rsToken) {
    return { ok: false, status: 503, data: { message: 'RS_TOKEN not configured' } };
  }
  try {
    const res = await fetch(`${cfg.restreamerUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${cfg.rsToken}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const text = await res.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // keep raw text
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { message: err instanceof Error ? err.message : 'Restreamer request failed' },
    };
  }
}

/**
 * Create a Restreamer process: Owncast HLS input → PeerTube RTMP output.
 * autostart: true so the ffmpeg process begins pulling HLS immediately.
 */
async function createRestreamProcess(
  cfg: ReturnType<typeof config>,
  streamId: string,
  streamTitle: string,
  streamKey: string,
  peertubeRtmpUrl: string,
): Promise<{ ok: boolean; processId?: string; error?: string }> {
  const hlsUrl = `${cfg.owncastUrl.replace(/\/$/, '')}/hls/stream.m3u8`;
  const rtmpAddress = toContainerAddress(
    peertubeRtmpUrl,
    'rtmp://host.docker.internal:1935/live',
    '',
  );
  const outputAddress = `${rtmpAddress}/${streamKey}`;

  const processDef = {
    id: streamId,
    reference: `degenfeed-live:${streamTitle.slice(0, 80)}`,
    options: ['-loglevel', 'error'],
    input: [
      {
        id: 'owncast',
        address: toContainerAddress(hlsUrl, 'http://host.docker.internal:8092/hls/stream.m3u8', ''),
        options: ['-re'],
      },
    ],
    output: [
      {
        id: 'peertube',
        address: outputAddress,
        options: [
          '-codec:v',
          'libx264',
          '-preset:v',
          'veryfast',
          '-tune:v',
          'zerolatency',
          '-b:v',
          '2M',
          '-maxrate',
          '2.5M',
          '-bufsize',
          '4M',
          '-codec:a',
          'aac',
          '-b:a',
          '128k',
          '-ar',
          '44100',
          '-f',
          'flv',
        ],
      },
    ],
    autostart: true,
    reconnect: true,
    reconnect_delay_seconds: 10,
    stale_timeout_seconds: 30,
  };

  const { ok, status, data } = await restreamerApi(cfg, 'POST', '/api/v3/process', processDef);
  if (!ok) {
    return {
      ok: false,
      error: `Restreamer process create failed (HTTP ${status}): ${JSON.stringify(data).slice(0, 200)}`,
    };
  }
  const created = (data as { id?: string }) || {};
  return { ok: true, processId: created.id || streamId };
}

async function stopAndDeleteRestreamProcess(
  cfg: ReturnType<typeof config>,
  processId: string,
): Promise<void> {
  // Stop first (graceful), then delete so the process is fully removed.
  await restreamerApi(cfg, 'PUT', `/api/v3/process/${processId}/command`, { command: 'stop' });
  await restreamerApi(cfg, 'DELETE', `/api/v3/process/${processId}`);
}

// ─── PeerTube API ────────────────────────────────────────────────────────

interface PeerTubeToken {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * OAuth2 password grant — POST /api/v1/users/token (form-encoded).
 */
async function getPeerTubeToken(cfg: ReturnType<typeof config>): Promise<string> {
  if (!cfg.peertubeClientId || !cfg.peertubeClientSecret || !cfg.peertubePassword) {
    throw new Error(
      'PEERTUBE_CLIENT_ID / PEERTUBE_CLIENT_SECRET / PEERTUBE_PASSWORD not configured',
    );
  }
  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: cfg.peertubeClientId,
    client_secret: cfg.peertubeClientSecret,
    username: cfg.peertubeUsername,
    password: cfg.peertubePassword,
  });
  const res = await fetch(`${cfg.peertubeBaseUrl}/api/v1/users/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as PeerTubeToken;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `PeerTube token failed (HTTP ${res.status}): ${data.error || data.error_description || 'no token'}`,
    );
  }
  return data.access_token;
}

/**
 * Find the first channel id for the authenticated user.
 */
async function getPeerTubeChannelId(
  cfg: ReturnType<typeof config>,
  token: string,
): Promise<number> {
  const res = await fetch(`${cfg.peertubeBaseUrl}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`PeerTube /users/me failed (HTTP ${res.status})`);
  }
  const me = (await res.json()) as { videoChannels?: { id: number }[] };
  const channel = me.videoChannels?.[0];
  if (!channel?.id) {
    throw new Error('PeerTube user has no video channels');
  }
  return channel.id;
}

interface PeerTubeLiveVideo {
  id?: number | string;
  uuid?: string;
  rtmpUrl?: string;
  streamKey?: string;
}

/**
 * Create a permanent live video on PeerTube. Returns the video id + stream key.
 */
async function createPeerTubeLive(
  cfg: ReturnType<typeof config>,
  token: string,
  channelId: number,
  streamTitle: string,
): Promise<{ videoId: string; videoUuid: string; streamKey: string; rtmpUrl: string }> {
  const res = await fetch(`${cfg.peertubeBaseUrl}/api/v1/videos/live`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      name: streamTitle.slice(0, 120),
      channelId,
      saveReplay: false,
      permanentLive: true,
      privacy: 1, // PUBLIC
      latencyMode: 3, // default latency
    }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as { video?: PeerTubeLiveVideo };
  const video = data.video;
  if (!res.ok || !video?.streamKey || !video?.rtmpUrl) {
    throw new Error(
      `PeerTube live create failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return {
    videoId: String(video.id ?? video.uuid ?? ''),
    videoUuid: video.uuid || String(video.id || ''),
    streamKey: video.streamKey,
    rtmpUrl: video.rtmpUrl,
  };
}

/**
 * End a PeerTube live video. PeerTube has no explicit "end live" REST verb;
 * deleting the live video both ends the session and cleans up the resource.
 * Falls back to flipping the video to non-permanent if delete fails.
 */
async function endPeerTubeLive(
  cfg: ReturnType<typeof config>,
  token: string,
  videoId: string,
): Promise<void> {
  const del = await fetch(`${cfg.peertubeBaseUrl}/api/v1/videos/${videoId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (del.ok || del.status === 404) return;

  // Fallback: mark non-permanent so the live is not left waiting for a stream.
  const put = await fetch(`${cfg.peertubeBaseUrl}/api/v1/videos/live/${videoId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ permanentLive: false }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!put.ok) {
    throw new Error(`PeerTube live end failed (DELETE HTTP ${del.status}, PUT HTTP ${put.status})`);
  }
}

// ─── Nostr status event (best effort) ────────────────────────────────────

/**
 * Publish a kind 1 Nostr note announcing the live stream status.
 * Requires NOSTR_PRIVATE_KEY_HEX; skipped with a warning when not configured.
 */
function publishNostrStatus(
  cfg: ReturnType<typeof config>,
  status: 'started' | 'ended',
  streamTitle: string,
): void {
  if (!cfg.nostrPrivateKeyHex) {
    console.warn('[webhook] Nostr status publish skipped — NOSTR_PRIVATE_KEY_HEX not configured');
    return;
  }
  try {
    const pubkey = getPublicKey(cfg.nostrPrivateKeyHex);
    const content =
      status === 'started'
        ? `🔴 LIVE now on DegenFeed: ${streamTitle}`
        : `🔚 Stream ended: ${streamTitle}`;
    const signed = signEvent(
      {
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [
          ['t', 'degenfeed-live'],
          ['status', status],
        ],
        content,
      },
      cfg.nostrPrivateKeyHex,
    );
    const ws = new WebSocket(cfg.nostrRelayUrl);
    const timer = setTimeout(() => {
      ws.close();
    }, 5000);
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(['EVENT', signed]));
      console.log(`[webhook] Nostr ${status} event sent (${signed.id.slice(0, 8)})`);
      clearTimeout(timer);
      ws.close();
    });
    ws.addEventListener('error', () => {
      clearTimeout(timer);
      ws.close();
    });
  } catch (err) {
    console.warn(
      '[webhook] Nostr status publish failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────

async function handleStreamStarted(
  ev: OwncastWebhookEvent,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cfg = config();
  const streamId = deriveStreamId(ev);
  const streamTitle = ev.eventData?.streamTitle || 'DegenFeed Live';

  // Guard: don't double-create if a process for this stream is already active.
  const existing = liveProcesses.get(streamId);
  if (existing) {
    return {
      status: 200,
      body: {
        ok: true,
        reused: true,
        streamId,
        processId: existing.processId,
        videoId: existing.videoId,
      },
    };
  }

  try {
    // 1. PeerTube auth
    const token = await getPeerTubeToken(cfg);

    // 2. Create PeerTube live → streamKey
    const channelId = await getPeerTubeChannelId(cfg, token);
    const live = await createPeerTubeLive(cfg, token, channelId, streamTitle);

    // 3. Create Restreamer process (Owncast HLS → PeerTube RTMP, autostart)
    const proc = await createRestreamProcess(
      cfg,
      streamId,
      streamTitle,
      live.streamKey,
      live.rtmpUrl,
    );
    if (!proc.ok || !proc.processId) {
      // Clean up the PeerTube live if the restream process could not be created.
      try {
        await endPeerTubeLive(cfg, token, live.videoId);
      } catch {
        // ignore cleanup error — primary error is more useful
      }
      throw new Error(proc.error || 'Restream process create failed');
    }

    liveProcesses.set(streamId, {
      processId: proc.processId,
      videoId: live.videoId,
      videoUuid: live.videoUuid,
      streamTitle,
      startedAt: Date.now(),
    });

    publishNostrStatus(cfg, 'started', streamTitle);

    return {
      status: 200,
      body: {
        ok: true,
        streamId,
        processId: proc.processId,
        videoId: live.videoId,
        videoUuid: live.videoUuid,
        restreamTarget: 'peertube',
      },
    };
  } catch (err) {
    return {
      status: 502,
      body: {
        ok: false,
        streamId,
        error: {
          code: 'RESTREAM_START_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      },
    };
  }
}

async function handleStreamStopped(
  ev: OwncastWebhookEvent,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const cfg = config();
  const streamId = deriveStreamId(ev);
  const streamTitle = ev.eventData?.streamTitle || 'DegenFeed Live';
  const state = liveProcesses.get(streamId);

  const errors: string[] = [];

  // 1. Stop + delete restreamer process (if we know it)
  if (state?.processId) {
    try {
      await stopAndDeleteRestreamProcess(cfg, state.processId);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'restreamer stop failed');
    }
  } else {
    console.warn(`[webhook] No restream process for ${streamId} — skipping stop`);
  }

  // 2. End PeerTube live (if we know it)
  if (state?.videoId) {
    try {
      const token = await getPeerTubeToken(cfg);
      await endPeerTubeLive(cfg, token, state.videoId);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'peertube end failed');
    }
  }

  // 3. Nostr status = ended (best effort)
  publishNostrStatus(cfg, 'ended', streamTitle);

  liveProcesses.delete(streamId);

  return {
    status: errors.length === 0 ? 200 : 207,
    body: {
      ok: errors.length === 0,
      streamId,
      ended: true,
      ...(errors.length > 0 ? { errors } : {}),
    },
  };
}

// ─── Route entry ─────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/owncast — Owncast stream lifecycle webhook.
 * Returns true if the path belongs to this handler.
 */
export async function handleWebhookRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (!path.startsWith('/api/webhooks')) return false;

  // GET /api/webhooks/status — debug endpoint for active restreams
  if (path === '/api/webhooks/status' && method === 'GET') {
    return (
      jsonOk(res, {
        ok: true,
        active: Array.from(liveProcesses.entries()).map(([streamId, s]) => ({
          streamId,
          processId: s.processId,
          videoId: s.videoId,
          streamTitle: s.streamTitle,
          startedAt: s.startedAt,
        })),
      }),
      true
    );
  }

  if (path !== '/api/webhooks/owncast') return false;
  if (method !== 'POST') {
    jsonError(res, 405, 'METHOD_NOT_ALLOWED', 'Use POST for Owncast webhooks');
    return true;
  }

  let body: OwncastWebhookEvent;
  try {
    body = (await parseBody(req)) as OwncastWebhookEvent;
  } catch (err) {
    jsonError(res, 400, 'INVALID_BODY', err instanceof Error ? err.message : 'Invalid JSON body');
    return true;
  }

  const type = body.type;
  if (type !== 'STREAM_STARTED' && type !== 'STREAM_STOPPED') {
    jsonError(res, 400, 'UNKNOWN_EVENT', `Unsupported webhook type: ${type}`);
    return true;
  }

  const result =
    type === 'STREAM_STARTED' ? await handleStreamStarted(body) : await handleStreamStopped(body);

  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
  return true;
}

export { liveProcesses };
