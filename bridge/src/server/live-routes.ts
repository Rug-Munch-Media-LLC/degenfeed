// ═══════════════════════════════════════════════════════════════════════
// Creator Live Orchestration — "Go Live" API
//
// POST /api/live/go-live   — creator picks a style (TikTok vertical 9:16 or
//                            traditional horizontal 16:9) and one or more
//                            distribution platforms (Owncast, PeerTube,
//                            Lens via Livepeer, Farcaster Frames, Nostr
//                            NIP-53). Returns the RTMP connection info the
//                            creator plugs into OBS, and registers a pending
//                            LiveSession. When the Owncast STREAM_STARTED
//                            webhook fires, `live-distribution.ts` fans the
//                            stream out to every selected platform.
// GET  /api/live/sessions  — active sessions (debug / status)
// GET  /api/live/sessions/:id — single session
// POST /api/live/end       — manually end a session (best effort)
//
// Per-protocol distribution is deliberately per-session: a vertical 9:16
// TikTok-style stream and a horizontal 16:9 stream may target different
// platforms, and each selected platform gets its own distribution path.
// ═══════════════════════════════════════════════════════════════════════

import type http from 'node:http';

// ─── Types ─────────────────────────────────────────────────────────────

export type LiveStyle = 'vertical' | 'horizontal';
export type CreatorLivePlatform =
  | 'owncast'
  | 'peertube'
  | 'lens'
  | 'farcaster'
  | 'nostr'
  | 'bluesky'
  | 'mastodon';

export const LIVE_STYLES: LiveStyle[] = ['vertical', 'horizontal'];
export const LIVE_PLATFORMS: CreatorLivePlatform[] = [
  'owncast',
  'peertube',
  'lens',
  'farcaster',
  'nostr',
  'bluesky',
  'mastodon',
];

export interface DistributionResult {
  ok: boolean;
  error?: string;
  /** Optional informational note (e.g. nothing to clean up) */
  note?: string;
  eventId?: string;
  dTag?: string;
  relaysAccepted?: string[];
  castHash?: string;
  url?: string;
  publicationId?: string;
  daHash?: string;
  playbackUrl?: string;
  livepeerStreamId?: string;
}

export interface LiveSession {
  streamId: string;
  style: LiveStyle;
  platforms: CreatorLivePlatform[];
  title: string;
  description: string;
  category: string;
  tags: string[];
  creatorId: string;
  creatorName: string;
  thumbnailUrl?: string;
  status: 'pending' | 'live' | 'ended';
  startedAt?: number;
  endedAt?: number;
  createdAt: number;
  /** Owncast webhook stream id when the stream actually starts */
  owncastStreamId?: string;
  distribution: Partial<Record<CreatorLivePlatform, DistributionResult>>;
}

export interface GoLiveRequest {
  style?: string;
  platforms?: string[];
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  creatorId?: string;
  creatorName?: string;
  thumbnailUrl?: string;
}

// ─── In-memory session store ───────────────────────────────────────────

const liveSessions = new Map<string, LiveSession>();

export function getLiveSessions(): LiveSession[] {
  return [...liveSessions.values()];
}

export function getLiveSession(streamId: string): LiveSession | undefined {
  return liveSessions.get(streamId);
}

export function setLiveSession(session: LiveSession): void {
  liveSessions.set(session.streamId, session);
}

/**
 * Match a pending session to an Owncast webhook event. The Owncast shortid
 * in eventData.id is not our streamId, so we match on the stream title
 * (case-insensitive) first, then fall back to a derived id lookup.
 */
export function findSessionForWebhook(opts: {
  streamId?: string;
  streamTitle?: string;
}): LiveSession | undefined {
  if (opts.streamId) {
    const byId = liveSessions.get(opts.streamId);
    if (byId) return byId;
  }
  if (opts.streamTitle) {
    const title = opts.streamTitle.trim().toLowerCase();
    if (!title) return undefined;
    for (const session of liveSessions.values()) {
      if (session.title.trim().toLowerCase() === title) return session;
    }
  }
  return undefined;
}

// ─── Config helpers ────────────────────────────────────────────────────

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export interface LiveConnection {
  streamId: string;
  rtmpUrl: string;
  streamKey: string;
  playbackUrl: string;
  embedUrl: string;
  style: LiveStyle;
  platforms: CreatorLivePlatform[];
  hlsUrl: string;
}

export function buildLiveConnection(session: LiveSession): LiveConnection {
  const externalUrl = env('OWNCAST_EXTERNAL_URL', 'https://owncast.degenfeed.xyz').replace(
    /\/$/,
    '',
  );
  const rtmpUrl = env('OWNCAST_PUBLIC_RTMP_URL', 'rtmp://owncast.degenfeed.xyz:1935/live');
  const streamKey = session.creatorId
    ? `${session.streamId.split('-')[1] ?? 'live'}-${session.streamId.slice(-6)}`
    : session.streamId;
  return {
    streamId: session.streamId,
    rtmpUrl,
    streamKey,
    playbackUrl: `${externalUrl}/hls/stream.m3u8`,
    embedUrl: `${externalUrl}/embed/video`,
    style: session.style,
    platforms: session.platforms,
    hlsUrl: `${externalUrl}/hls/stream.m3u8`,
  };
}

// ─── HTTP helpers ──────────────────────────────────────────────────────

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

// ─── Handlers ──────────────────────────────────────────────────────────

async function handleGoLive(req: http.IncomingMessage): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  let body: GoLiveRequest;
  try {
    body = (await parseBody(req)) as GoLiveRequest;
  } catch (err) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_BODY', message: String(err) } },
    };
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    return {
      status: 400,
      body: { ok: false, error: { code: 'VALIDATION_ERROR', message: 'title is required' } },
    };
  }

  const style: LiveStyle = body.style === 'vertical' ? 'vertical' : 'horizontal';
  const requested = Array.isArray(body.platforms) ? body.platforms : ['owncast'];
  const platforms: CreatorLivePlatform[] = [
    ...new Set(
      requested.filter((p): p is CreatorLivePlatform =>
        LIVE_PLATFORMS.includes(p as CreatorLivePlatform),
      ),
    ),
  ];
  if (platforms.length === 0) platforms.push('owncast');

  const streamId = `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const session: LiveSession = {
    streamId,
    style,
    platforms,
    title,
    description: typeof body.description === 'string' ? body.description : '',
    category: typeof body.category === 'string' ? body.category : 'talk',
    tags: Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === 'string')
      : [],
    creatorId: typeof body.creatorId === 'string' ? body.creatorId : 'anon',
    creatorName: typeof body.creatorName === 'string' ? body.creatorName : 'Creator',
    thumbnailUrl: typeof body.thumbnailUrl === 'string' ? body.thumbnailUrl : undefined,
    status: 'pending',
    createdAt: Date.now(),
    distribution: {},
  };

  setLiveSession(session);
  const connection = buildLiveConnection(session);

  return {
    status: 200,
    body: {
      ok: true,
      streamId,
      status: 'pending',
      style,
      platforms,
      ...connection,
      message:
        'Session registered. Start broadcasting with this RTMP key in OBS — distribution to selected platforms begins automatically.',
    },
  };
}

function handleSessionsList(): {
  status: number;
  body: Record<string, unknown>;
} {
  return {
    status: 200,
    body: {
      ok: true,
      sessions: getLiveSessions().map((s) => ({
        streamId: s.streamId,
        style: s.style,
        platforms: s.platforms,
        title: s.title,
        status: s.status,
        startedAt: s.startedAt,
        createdAt: s.createdAt,
        distribution: s.distribution,
      })),
      total: liveSessions.size,
    },
  };
}

function handleSessionGet(path: string): { status: number; body: Record<string, unknown> } {
  const id = path.replace('/api/live/sessions/', '');
  const session = liveSessions.get(id);
  if (!session) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'session not found' } },
    };
  }
  return { status: 200, body: { ok: true, session } };
}

async function handleSessionEnd(req: http.IncomingMessage): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  let body: { streamId?: string };
  try {
    body = (await parseBody(req)) as { streamId?: string };
  } catch {
    return {
      status: 400,
      body: { ok: false, error: { code: 'INVALID_BODY', message: 'Invalid body' } },
    };
  }
  const session = body.streamId ? liveSessions.get(body.streamId) : undefined;
  if (!session) {
    return {
      status: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'session not found' } },
    };
  }
  session.status = 'ended';
  session.endedAt = Date.now();
  return {
    status: 200,
    body: {
      ok: true,
      streamId: session.streamId,
      status: 'ended',
      message: 'Session marked ended. Stop broadcasting in OBS to trigger cleanup.',
    },
  };
}

// ─── Route entry ───────────────────────────────────────────────────────

/**
 * POST /api/live/go-live — register a creator live session
 * GET  /api/live/sessions — list sessions
 * GET  /api/live/sessions/:id — single session
 * POST /api/live/end — mark session ended
 */
export async function handleLiveRoute(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (!path.startsWith('/api/live')) return false;

  if (path === '/api/live/go-live' && method === 'POST') {
    const result = await handleGoLive(req);
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return true;
  }

  if (path === '/api/live/sessions' && method === 'GET') {
    const result = handleSessionsList();
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return true;
  }

  if (path.startsWith('/api/live/sessions/') && method === 'GET') {
    const result = handleSessionGet(path);
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return true;
  }

  if (path === '/api/live/end' && method === 'POST') {
    const result = await handleSessionEnd(req);
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
    return true;
  }

  if (path.startsWith('/api/live')) {
    jsonError(res, 404, 'NOT_FOUND', `No live route for ${method} ${path}`);
    return true;
  }

  return false;
}

export { liveSessions };
