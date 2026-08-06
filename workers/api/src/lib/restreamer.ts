/**
 * @degenfeed/api-worker — Restreamer Client
 *
 * Client for the self-hosted Restreamer (datarhei core) that performs
 * multi-platform RTMP push orchestration (Owncast HLS → Twitch/Kick/YouTube).
 *
 * The worker cannot reach 127.0.0.1:8088 directly (Restreamer runs on Talos),
 * so production calls go through the bridge service (BRIDGE_INTERNAL_URL),
 * which mirrors this logic in bridge/src/server/webhook-routes.ts.
 *
 * For local dev with direct access, set RESTREAMER_URL + RS_ADMIN_USER +
 * RS_ADMIN_PASSWORD and this module will talk to Restreamer directly.
 *
 * Restreamer API (datarhei core):
 *   POST /api/login                    → { access_token }
 *   GET  /api/v3/process               → list processes
 *   POST /api/v3/process               → create process
 *   PUT  /api/v3/process/{id}/command  → { command: "start"|"stop" }
 *   DELETE /api/v3/process/{id}        → delete process
 */

import type { Env } from '../types';

const RESTREAMER_TIMEOUT = 10_000;

export interface RestreamerTarget {
  platform: string;
  rtmpUrl: string;
  streamKey: string;
}

export interface RestreamStartResult {
  ok: boolean;
  processId?: string;
  error?: string;
  viaBridge?: boolean;
}

export interface RestreamStatusResult {
  ok: boolean;
  processes: Array<{
    id?: string;
    reference?: string;
    state?: string;
  }>;
  error?: string;
}

// ─── Config ─────────────────────────────────────────────────────────────

function getRestreamerUrl(env: Env): string {
  return (env as Record<string, string>).RESTREAMER_URL || 'http://127.0.0.1:8088';
}

function getBridgeUrl(env: Env): string {
  return (env as Record<string, string>).BRIDGE_INTERNAL_URL || 'https://bridge.degenfeed.xyz';
}

function getBridgeApiKey(env: Env): string {
  return (env as Record<string, string>).BRIDGE_API_KEY || '';
}

// ─── Direct Restreamer API (local dev) ──────────────────────────────────

let restreamerJwtCache: { token: string; expiresAt: number } | null = null;

async function restreamerLogin(env: Env): Promise<string | null> {
  if (restreamerJwtCache && Date.now() < restreamerJwtCache.expiresAt) {
    return restreamerJwtCache.token;
  }
  const username = (env as Record<string, string>).RS_ADMIN_USER || '';
  const password = (env as Record<string, string>).RS_ADMIN_PASSWORD || '';
  if (!username || !password) return null;

  try {
    const res = await fetch(`${getRestreamerUrl(env)}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(RESTREAMER_TIMEOUT),
    });
    const data = (await res.json().catch(() => ({}))) as { access_token?: string };
    if (!res.ok || !data.access_token) return null;
    restreamerJwtCache = { token: data.access_token, expiresAt: Date.now() + 6 * 60 * 1000 };
    return data.access_token;
  } catch {
    return null;
  }
}

async function restreamerApi(
  env: Env,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const token = await restreamerLogin(env);
  if (!token) {
    return { ok: false, status: 503, data: { message: 'Restreamer auth not configured' } };
  }
  try {
    const res = await fetch(`${getRestreamerUrl(env)}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(RESTREAMER_TIMEOUT),
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
 * Convert a container-internal host:port URL so Restreamer (which runs in a
 * container) can reach the Docker host via host.docker.internal.
 */
function toContainerAddress(rawUrl: string, fallbackHost: string): string {
  try {
    const u = new URL(rawUrl);
    u.hostname = 'host.docker.internal';
    return u.toString().replace(/\/$/, '');
  } catch {
    return fallbackHost;
  }
}

/**
 * Create a Restreamer process that pulls the Owncast HLS stream and pushes
 * to one or more RTMP targets (Twitch/Kick/YouTube/PeerTube).
 */
export async function startRestreamProcess(
  env: Env,
  opts: {
    streamId: string;
    title: string;
    owncastHlsUrl: string;
    targets: RestreamerTarget[];
  },
): Promise<RestreamStartResult> {
  // Production path: the bridge performs the Restreamer orchestration.
  const bridgeKey = getBridgeApiKey(env);
  if (bridgeKey) {
    try {
      const res = await fetch(`${getBridgeUrl(env)}/api/live/go-live`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bridgeKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          style: 'horizontal',
          platforms: ['owncast', ...new Set(opts.targets.map((t) => t.platform))],
          title: opts.title,
          description: '',
          category: 'talk',
          tags: ['degenfeed'],
          creatorId: opts.streamId,
          creatorName: 'DegenFeed Creator',
        }),
        signal: AbortSignal.timeout(RESTREAMER_TIMEOUT),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        streamId?: string;
        rtmpUrl?: string;
        streamKey?: string;
        error?: { message?: string };
      };
      if (res.ok && data.ok) {
        return {
          ok: true,
          processId: data.streamId,
          viaBridge: true,
          ...(data.rtmpUrl && data.streamKey
            ? { error: undefined }
            : {}),
        };
      }
      return {
        ok: false,
        viaBridge: true,
        error: data.error?.message || `Bridge go-live failed (HTTP ${res.status})`,
      };
    } catch (err) {
      return {
        ok: false,
        viaBridge: true,
        error: `Bridge unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Local dev path: talk to Restreamer directly.
  if (opts.targets.length === 0) {
    return { ok: false, error: 'No RTMP targets provided for Restreamer' };
  }

  const hlsUrl = toContainerAddress(opts.owncastHlsUrl, 'http://host.docker.internal:8092/hls/stream.m3u8');
  const output = opts.targets.map((target, idx) => ({
    id: `target-${idx}-${target.platform}`,
    address: `${target.rtmpUrl.replace(/\/$/, '')}/${target.streamKey}`,
    options: [
      '-codec:v', 'libx264',
      '-preset:v', 'veryfast',
      '-tune:v', 'zerolatency',
      '-b:v', '2M',
      '-maxrate', '2.5M',
      '-bufsize', '4M',
      '-codec:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-f', 'flv',
    ],
  }));

  const processDef = {
    id: opts.streamId,
    reference: `degenfeed-live:${opts.title.slice(0, 80)}`,
    options: ['-loglevel', 'error'],
    input: [
      {
        id: 'owncast',
        address: hlsUrl,
        options: ['-re'],
      },
    ],
    output,
    autostart: true,
    reconnect: true,
    reconnect_delay_seconds: 10,
    stale_timeout_seconds: 30,
  };

  const { ok, status, data } = await restreamerApi(env, 'POST', '/api/v3/process', processDef);
  if (!ok) {
    return {
      ok: false,
      error: `Restreamer process create failed (HTTP ${status}): ${JSON.stringify(data).slice(0, 200)}`,
    };
  }
  const created = (data as { id?: string }) || {};
  return { ok: true, processId: created.id || opts.streamId };
}

/**
 * Stop and delete a Restreamer process.
 */
export async function stopRestreamProcess(env: Env, processId: string): Promise<{ ok: boolean; error?: string }> {
  // Production path: bridge owns the Restreamer lifecycle. For direct
  // restreams the bridge's /api/webhooks/owncast STREAM_STOPPED flow handles
  // cleanup automatically. Here we only support direct Restreamer access.
  const bridgeKey = getBridgeApiKey(env);
  if (bridgeKey) {
    // No bridge endpoint for explicit stop — the Owncast webhook flow cleans up.
    return { ok: true };
  }
  await restreamerApi(env, 'PUT', `/api/v3/process/${encodeURIComponent(processId)}/command`, {
    command: 'stop',
  });
  await restreamerApi(env, 'DELETE', `/api/v3/process/${encodeURIComponent(processId)}`);
  return { ok: true };
}

/**
 * List active Restreamer processes (status / debug).
 */
export async function listRestreamProcesses(env: Env): Promise<RestreamStatusResult> {
  const { ok, data } = await restreamerApi(env, 'GET', '/api/v3/process');
  if (!ok) return { ok: false, processes: [] };
  const processes = Array.isArray(data)
    ? (data as Array<{ id?: string; reference?: string; state?: string }>)
    : [];
  return {
    ok: true,
    processes: processes.map((p) => ({
      id: p.id,
      reference: p.reference,
      state: p.state,
    })),
  };
}
