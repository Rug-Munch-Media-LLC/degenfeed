/**
 * @degenfeed/api-worker — WebRTC P2P Streaming Service
 *
 * Zero-bandwidth live streaming for audiences <10 viewers.
 * Handles WebRTC signaling (offer/answer/ICE exchange) in a P2P mesh.
 * Falls back to Livepeer transcoding when P2P fails (NAT traversal).
 *
 * Key design:
 *   - Broadcaster sends SDP offer → server stores it
 *   - Viewer polls for offer, creates answer, sends back
 *   - ICE candidates are relayed through server (cheap, text-only)
 *   - Video bytes flow P2P, never through our servers
 *   - Server only exchanges small JSON payloads (KB-scale, not GB-scale)
 *
 * API routes handled here:
 *   POST /api/live/webrtc/offer       — Broadcaster sends offer
 *   POST /api/live/webrtc/answer      — Viewer sends answer
 *   POST /api/live/webrtc/ice         — ICE candidate exchange
 *   GET  /api/live/webrtc/viewers     — Connected viewer count
 */

import type { Env } from '../index';
import { jsonResponse, noCacheJsonResponse } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────

export interface WebRTCSession {
  /** Unique session ID */
  sessionId: string;
  /** Broadcaster wallet address */
  broadcasterAddress: string;
  /** Stream title */
  title: string;
  /** SDP offer from broadcaster */
  offer: RTCSessionDescriptionInit | null;
  /** Map of viewerId → SDP answer */
  answers: Map<string, RTCSessionDescriptionInit>;
  /** Map of viewerId → ICE candidates */
  iceCandidates: Map<string, RTCIceCandidateInit[]>;
  /** Connected viewer peer IDs */
  viewers: Set<string>;
  /** Timestamp session started */
  startedAt: number;
  /** Timestamp last activity */
  lastActivity: number;
  /** Whether this session has fallen back to Livepeer */
  fallbackToLivepeer: boolean;
  /** Livepeer stream ID if fallback active */
  livepeerStreamId?: string;
  /** Playback URL for Livepeer fallback */
  livepeerPlaybackUrl?: string;
  /** Session is active */
  active: boolean;
}

export interface WebRTCOfferRequest {
  sessionId?: string;
  title: string;
  offer: RTCSessionDescriptionInit;
}

export interface WebRTCAnswerRequest {
  sessionId: string;
  viewerId: string;
  answer: RTCSessionDescriptionInit;
}

export interface WebRTCIceRequest {
  sessionId: string;
  viewerId: string;
  candidate: RTCIceCandidateInit;
}

export interface BroadcastStatus {
  sessionId: string;
  mode: 'p2p' | 'livepeer_fallback';
  viewerCount: number;
  viewerIds: string[];
  streamKey?: string;
  rtmpUrl?: string;
  playbackUrl?: string;
}

// ─── KV Key Helpers ─────────────────────────────────────────────────────

function sessionKey(sessionId: string): string {
  return `webrtc:session:${sessionId}`;
}

function offerKey(sessionId: string): string {
  return `webrtc:offer:${sessionId}`;
}

function iceKey(sessionId: string, viewerId: string): string {
  return `webrtc:ice:${sessionId}:${viewerId}`;
}

function sessionIndexKey(): string {
  return 'webrtc:sessions:active';
}

// ─── Session TTL (30 min idle timeout) ──────────────────────────────

const SESSION_TTL = 1800;

// ─── WebRTC Session Manager ─────────────────────────────────────────

export class WebRTCSessionManager {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Create a new WebRTC streaming session.
   * Called by broadcaster when starting a P2P stream.
   */
  async createSession(
    broadcasterAddress: string,
    title: string,
    offer: RTCSessionDescriptionInit,
  ): Promise<WebRTCSession> {
    const sessionId = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;

    const session: WebRTCSession = {
      sessionId,
      broadcasterAddress,
      title,
      offer,
      answers: new Map(),
      iceCandidates: new Map(),
      viewers: new Set(),
      startedAt: Date.now(),
      lastActivity: Date.now(),
      fallbackToLivepeer: false,
      active: true,
    };

    // Store session in KV
    await this.env.CACHE?.put(
      sessionKey(sessionId),
      JSON.stringify(this.serializeSession(session)),
      { expirationTtl: SESSION_TTL },
    );

    // Store SDP offer separately for viewer polling
    await this.env.CACHE?.put(offerKey(sessionId), JSON.stringify(offer), {
      expirationTtl: SESSION_TTL,
    });

    // Add to active sessions index
    await this.addToActiveIndex(sessionId);

    return session;
  }

  /**
   * Get a session by ID.
   */
  async getSession(sessionId: string): Promise<WebRTCSession | null> {
    try {
      const raw = await this.env.CACHE?.get(sessionKey(sessionId));
      if (!raw) return null;
      return this.deserializeSession(raw);
    } catch {
      return null;
    }
  }

  /**
   * Get the SDP offer for a session (viewers poll this).
   */
  async getOffer(sessionId: string): Promise<RTCSessionDescriptionInit | null> {
    try {
      const raw = await this.env.CACHE?.get(offerKey(sessionId));
      if (!raw) return null;
      return JSON.parse(raw) as RTCSessionDescriptionInit;
    } catch {
      return null;
    }
  }

  /**
   * Viewer submits an SDP answer to the broadcaster.
   */
  async submitAnswer(
    sessionId: string,
    viewerId: string,
    answer: RTCSessionDescriptionInit,
  ): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session || !session.active) return false;

      session.answers.set(viewerId, answer);
      session.viewers.add(viewerId);
      session.lastActivity = Date.now();

      // Store updated session
      await this.env.CACHE?.put(
        sessionKey(sessionId),
        JSON.stringify(this.serializeSession(session)),
        { expirationTtl: SESSION_TTL },
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Exchange ICE candidates between peers.
   * Viewer candidate → stored for broadcaster to collect.
   * Broadcaster candidate → stored for viewer to collect.
   */
  async submitIceCandidate(
    sessionId: string,
    peerId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<boolean> {
    try {
      const candidatesKey = iceKey(sessionId, peerId);
      const raw = await this.env.CACHE?.get(candidatesKey);
      const candidates: RTCIceCandidateInit[] = raw ? JSON.parse(raw) : [];

      candidates.push(candidate);

      // Keep only last 50 candidates to prevent KV bloat
      const trimmed = candidates.slice(-50);

      await this.env.CACHE?.put(candidatesKey, JSON.stringify(trimmed), {
        expirationTtl: SESSION_TTL,
      });

      // Update session activity
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = Date.now();
        await this.env.CACHE?.put(
          sessionKey(sessionId),
          JSON.stringify(this.serializeSession(session)),
          { expirationTtl: SESSION_TTL },
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get ICE candidates for a peer (polling mechanism).
   */
  async getIceCandidates(
    sessionId: string,
    peerId: string,
  ): Promise<RTCIceCandidateInit[]> {
    try {
      const raw = await this.env.CACHE?.get(iceKey(sessionId, peerId));
      if (!raw) return [];
      return JSON.parse(raw) as RTCIceCandidateInit[];
    } catch {
      return [];
    }
  }

  /**
   * Broadcaster polls for all viewer answers and ICE candidates.
   */
  async pollViewerData(
    sessionId: string,
  ): Promise<{
    answers: Array<{ viewerId: string; answer: RTCSessionDescriptionInit }>;
    iceCandidates: Array<{ viewerId: string; candidates: RTCIceCandidateInit[] }>;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return { answers: [], iceCandidates: [] };
    }

    const answers: Array<{
      viewerId: string;
      answer: RTCSessionDescriptionInit;
    }> = [];
    const iceCandidates: Array<{
      viewerId: string;
      candidates: RTCIceCandidateInit[];
    }> = [];

    for (const viewerId of session.viewers) {
      const answer = session.answers.get(viewerId);
      if (answer) {
        answers.push({ viewerId, answer });
      }

      const candidates = await this.getIceCandidates(sessionId, viewerId);
      if (candidates.length > 0) {
        iceCandidates.push({ viewerId, candidates });
      }
    }

    return { answers, iceCandidates };
  }

  /**
   * Get the current viewer count for a session.
   */
  async getViewerCount(sessionId: string): Promise<number> {
    const session = await this.getSession(sessionId);
    return session?.viewers.size ?? 0;
  }

  /**
   * Get viewer IDs for a session.
   */
  async getViewerIds(sessionId: string): Promise<string[]> {
    const session = await this.getSession(sessionId);
    return session ? Array.from(session.viewers) : [];
  }

  /**
   * Mark a session as fallen back to Livepeer.
   */
  async setFallback(
    sessionId: string,
    livepeerStreamId: string,
    livepeerPlaybackUrl: string,
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    session.fallbackToLivepeer = true;
    session.livepeerStreamId = livepeerStreamId;
    session.livepeerPlaybackUrl = livepeerPlaybackUrl;
    session.lastActivity = Date.now();

    await this.env.CACHE?.put(
      sessionKey(sessionId),
      JSON.stringify(this.serializeSession(session)),
      { expirationTtl: SESSION_TTL },
    );
  }

  /**
   * End a session (broadcaster stopped streaming).
   */
  async endSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      session.active = false;
      await this.env.CACHE?.put(
        sessionKey(sessionId),
        JSON.stringify(this.serializeSession(session)),
        { expirationTtl: 60 }, // Short TTL for cleanup
      );
    }

    // Remove from active index
    await this.removeFromActiveIndex(sessionId);
  }

  /**
   * Clean up stale ICE candidate entries for a viewer.
   */
  async cleanupViewer(sessionId: string, viewerId: string): Promise<void> {
    try {
      await this.env.CACHE?.delete(iceKey(sessionId, viewerId));
    } catch {
      // Non-critical cleanup
    }

    const session = await this.getSession(sessionId);
    if (session) {
      session.viewers.delete(viewerId);
      session.answers.delete(viewerId);
      session.iceCandidates.delete(viewerId);
      session.lastActivity = Date.now();

      await this.env.CACHE?.put(
        sessionKey(sessionId),
        JSON.stringify(this.serializeSession(session)),
        { expirationTtl: SESSION_TTL },
      );
    }
  }

  /**
   * List all active WebRTC sessions.
   */
  async listActiveSessions(limit = 20): Promise<WebRTCSession[]> {
    try {
      const raw = await this.env.CACHE?.get(sessionIndexKey());
      if (!raw) return [];

      const sessionIds: string[] = JSON.parse(raw);
      const sessions: WebRTCSession[] = [];

      for (const id of sessionIds.slice(0, limit)) {
        const session = await this.getSession(id);
        if (session && session.active) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch {
      return [];
    }
  }

  // ─── Serialization ────────────────────────────────────────────────

  /**
   * Serialize session for KV storage (Map → object).
   */
  private serializeSession(session: WebRTCSession): Record<string, unknown> {
    const answersObj: Record<string, RTCSessionDescriptionInit> = {};
    session.answers.forEach((val, key) => {
      answersObj[key] = val;
    });

    const iceObj: Record<string, RTCIceCandidateInit[]> = {};
    session.iceCandidates.forEach((val, key) => {
      iceObj[key] = val;
    });

    return {
      sessionId: session.sessionId,
      broadcasterAddress: session.broadcasterAddress,
      title: session.title,
      offer: session.offer,
      answers: answersObj,
      iceCandidates: iceObj,
      viewers: Array.from(session.viewers),
      startedAt: session.startedAt,
      lastActivity: session.lastActivity,
      fallbackToLivepeer: session.fallbackToLivepeer,
      livepeerStreamId: session.livepeerStreamId,
      livepeerPlaybackUrl: session.livepeerPlaybackUrl,
      active: session.active,
    };
  }

  /**
   * Deserialize session from KV storage.
   */
  private deserializeSession(raw: string): WebRTCSession {
    const data = JSON.parse(raw) as Record<string, unknown>;

    const answers = new Map<string, RTCSessionDescriptionInit>();
    if (data.answers && typeof data.answers === 'object') {
      Object.entries(data.answers as Record<string, unknown>).forEach(
        ([key, val]) => {
          answers.set(key, val as RTCSessionDescriptionInit);
        },
      );
    }

    const iceCandidates = new Map<string, RTCIceCandidateInit[]>();
    if (data.iceCandidates && typeof data.iceCandidates === 'object') {
      Object.entries(data.iceCandidates as Record<string, unknown>).forEach(
        ([key, val]) => {
          iceCandidates.set(key, val as RTCIceCandidateInit[]);
        },
      );
    }

    return {
      sessionId: data.sessionId as string,
      broadcasterAddress: data.broadcasterAddress as string,
      title: data.title as string,
      offer: data.offer as RTCSessionDescriptionInit | null,
      answers,
      iceCandidates,
      viewers: new Set(data.viewers as string[]),
      startedAt: data.startedAt as number,
      lastActivity: data.lastActivity as number,
      fallbackToLivepeer: (data.fallbackToLivepeer as boolean) ?? false,
      livepeerStreamId: data.livepeerStreamId as string | undefined,
      livepeerPlaybackUrl: data.livepeerPlaybackUrl as string | undefined,
      active: (data.active as boolean) ?? true,
    };
  }

  // ─── Index Management ─────────────────────────────────────────────

  private async addToActiveIndex(sessionId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(sessionIndexKey());
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(sessionId)) {
        ids.push(sessionId);
        await this.env.CACHE?.put(sessionIndexKey(), JSON.stringify(ids), {
          expirationTtl: SESSION_TTL,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async removeFromActiveIndex(sessionId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(sessionIndexKey());
      if (!raw) return;
      const ids: string[] = JSON.parse(raw).filter(
        (id: string) => id !== sessionId,
      );
      await this.env.CACHE?.put(sessionIndexKey(), JSON.stringify(ids), {
        expirationTtl: SESSION_TTL,
      });
    } catch {
      // Non-critical
    }
  }
}

// ─── Route Handlers ──────────────────────────────────────────────────

/**
 * POST /api/live/webrtc/offer
 * Broadcaster creates a WebRTC session with SDP offer.
 */
export async function handleWebRTCOffer(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as WebRTCOfferRequest;

    if (!body.offer || !body.title) {
      return jsonResponse(
        { error: 'SDP offer and title are required' },
        400,
      );
    }

    // Extract broadcaster identity from session or header
    const broadcasterAddress =
      request.headers.get('x-wallet-address') || 'anonymous';

    const manager = new WebRTCSessionManager(env);
    const session = await manager.createSession(
      broadcasterAddress,
      body.title,
      body.offer,
    );

    return jsonResponse(
      {
        ok: true,
        sessionId: session.sessionId,
        mode: 'p2p',
        viewerCount: 0,
        message:
          'WebRTC P2P session created. Viewers can now connect via /api/live/webrtc/answer.',
      },
      201,
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[webrtc] offer failed:', error);
    return jsonResponse({ error: `Failed to create WebRTC session: ${error}` }, 500);
  }
}

/**
 * POST /api/live/webrtc/answer
 * Viewer submits SDP answer to connect to broadcaster.
 */
export async function handleWebRTCAnswer(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as WebRTCAnswerRequest;

    if (!body.sessionId || !body.viewerId || !body.answer) {
      return jsonResponse(
        { error: 'sessionId, viewerId, and answer are required' },
        400,
      );
    }

    const manager = new WebRTCSessionManager(env);
    const session = await manager.getSession(body.sessionId);

    if (!session) {
      return jsonResponse({ error: 'WebRTC session not found' }, 404);
    }

    if (!session.active) {
      return jsonResponse({ error: 'WebRTC session is no longer active' }, 410);
    }

    // If session has fallen back to Livepeer, redirect viewer
    if (session.fallbackToLivepeer) {
      return jsonResponse({
        ok: true,
        mode: 'livepeer_fallback',
        playbackUrl: session.livepeerPlaybackUrl,
        message:
          'This stream has switched to Livepeer transcoding. Use the playback URL.',
      });
    }

    const success = await manager.submitAnswer(
      body.sessionId,
      body.viewerId,
      body.answer,
    );

    if (!success) {
      return jsonResponse({ error: 'Failed to submit answer' }, 500);
    }

    return jsonResponse({
      ok: true,
      sessionId: body.sessionId,
      viewerId: body.viewerId,
      mode: 'p2p',
      message: 'Answer submitted. Establish P2P connection via ICE candidates.',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[webrtc] answer failed:', error);
    return jsonResponse({ error: `Failed to submit answer: ${error}` }, 500);
  }
}

/**
 * POST /api/live/webrtc/ice
 * Exchange ICE candidates between peers.
 */
export async function handleWebRTCIce(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await request.json()) as WebRTCIceRequest;

    if (!body.sessionId || !body.viewerId || !body.candidate) {
      return jsonResponse(
        { error: 'sessionId, viewerId, and candidate are required' },
        400,
      );
    }

    const manager = new WebRTCSessionManager(env);
    const success = await manager.submitIceCandidate(
      body.sessionId,
      body.viewerId,
      body.candidate,
    );

    if (!success) {
      return jsonResponse({ error: 'Failed to submit ICE candidate' }, 500);
    }

    return jsonResponse({
      ok: true,
      message: 'ICE candidate accepted.',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[webrtc] ice failed:', error);
    return jsonResponse(
      { error: `Failed to submit ICE candidate: ${error}` },
      500,
    );
  }
}

/**
 * GET /api/live/webrtc/offer/:sessionId
 * Viewer polls for SDP offer from broadcaster.
 */
export async function handleWebRTCGetOffer(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const manager = new WebRTCSessionManager(env);
    const session = await manager.getSession(sessionId);

    if (!session) {
      return jsonResponse({ error: 'WebRTC session not found' }, 404);
    }

    const offer = await manager.getOffer(sessionId);
    if (!offer) {
      return jsonResponse({ error: 'No offer available for this session' }, 404);
    }

    return noCacheJsonResponse({
      sessionId,
      title: session.title,
      broadcasterAddress: session.broadcasterAddress,
      mode: session.fallbackToLivepeer ? 'livepeer_fallback' : 'p2p',
      offer,
      startedAt: session.startedAt,
      viewerCount: session.viewers.size,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[webrtc] get offer failed:', error);
    return jsonResponse({ error: `Failed to get offer: ${error}` }, 500);
  }
}

/**
 * GET /api/live/webrtc/viewers
 * Get connected viewer count for a WebRTC session.
 */
export async function handleWebRTCViewers(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      // Return all active WebRTC sessions and their viewer counts
      const manager = new WebRTCSessionManager(env);
      const sessions = await manager.listActiveSessions(50);

      return noCacheJsonResponse({
        sessions: sessions.map((s) => ({
          sessionId: s.sessionId,
          title: s.title,
          broadcasterAddress: s.broadcasterAddress,
          viewerCount: s.viewers.size,
          viewerIds: Array.from(s.viewers),
          mode: s.fallbackToLivepeer ? 'livepeer_fallback' : 'p2p',
          startedAt: s.startedAt,
          active: s.active,
        })),
        totalViewers: sessions.reduce(
          (sum, s) => sum + s.viewers.size,
          0,
        ),
      });
    }

    const manager = new WebRTCSessionManager(env);
    const count = await manager.getViewerCount(sessionId);
    const viewerIds = await manager.getViewerIds(sessionId);
    const session = await manager.getSession(sessionId);

    return noCacheJsonResponse({
      sessionId,
      viewerCount: count,
      viewerIds,
      mode: session?.fallbackToLivepeer ? 'livepeer_fallback' : 'p2p',
      startedAt: session?.startedAt,
      active: session?.active ?? false,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[webrtc] viewers failed:', error);
    return jsonResponse({ error: `Failed to get viewer count: ${error}` }, 500);
  }
}

/**
 * DELETE /api/live/webrtc/session/:sessionId
 * End a WebRTC session (broadcaster disconnects).
 */
export async function handleWebRTCEnd(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response> {
  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const manager = new WebRTCSessionManager(env);
    await manager.endSession(sessionId);

    return jsonResponse({
      ok: true,
      sessionId,
      message: 'WebRTC session ended.',
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error('[webrtc] end session failed:', error);
    return jsonResponse({ error: `Failed to end session: ${error}` }, 500);
  }
}
