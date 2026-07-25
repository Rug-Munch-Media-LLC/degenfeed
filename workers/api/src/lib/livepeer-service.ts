/**
 * @degenfeed/api-worker — Livepeer Video Transcoding & Streaming Service
 *
 * Integrates with Livepeer Studio for:
 *   - Video transcoding (offload CPU-intensive ffmpeg)
 *   - Stream creation & management
 *   - Real-time viewer metrics
 *   - Webhook handling for stream lifecycle events
 *
 * API: https://livepeer.studio/api/
 * Docs: https://docs.livepeer.org/reference/
 */

import type { Env } from '../index';
import { recordBridgeOperation, withReliability } from './bridge-reliability';

// ─── Types ──────────────────────────────────────────────────────────────

export interface LivepeerStreamOptions {
  name: string;
  record?: boolean;
  profiles?: TranscodeProfile[];
  lowLatency?: boolean;
}

export interface TranscodeProfile {
  name: string;
  width: number;
  height: number;
  bitrate: number;
  fps: number;
  fpsDen: number;
  gop: string;
  profile: 'H264' | 'H265';
}

export interface LivepeerStream {
  id: string;
  name: string;
  streamKey: string;
  rtmpIngestUrl: string;
  playbackId: string;
  playbackUrl: string;
  isActive: boolean;
  createdAt: number;
  lastSeen?: number;
  sourceSegments: number;
  transcodedSegments: number;
  sourceSegmentsDuration: number;
  transcodedSegmentsDuration: number;
  record: boolean;
  profiles: TranscodeProfile[];
  lowLatency: boolean;
  suspended: boolean;
  parentId?: string;
}

export interface LivepeerSession {
  id: string;
  streamId: string;
  name: string;
  playbackId: string;
  sourceSegments: number;
  transcodedSegments: number;
  sourceSegmentsDuration: number;
  transcodedSegmentsDuration: number;
  recordingUrl?: string;
  recordingStatus?: string;
  isActive: boolean;
  createdAt: number;
  lastSeen: number;
  parentId?: string;
}

export type LivepeerWebhookEvent =
  | 'stream.started'
  | 'stream.idle'
  | 'stream.detection'
  | 'recording.ready'
  | 'recording.started'
  | 'recording.waiting';

export interface LivepeerWebhookPayload {
  type: LivepeerWebhookEvent;
  streamId: string;
  sessionId?: string;
  timestamp: number;
  playbackId?: string;
  recordingUrl?: string;
  recordingStatus?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
}

export interface LivepeerViewerMetrics {
  viewerCount: number;
  playbackId: string;
  streamId: string;
  sessionId?: string;
  /** Timestamps of recent views for trend analysis */
  viewTimestamps: number[];
}

// ─── Default Transcode Profiles ────────────────────────────────────────

export const DEFAULT_TRANSCODE_PROFILES: TranscodeProfile[] = [
  {
    name: '720p',
    width: 1280,
    height: 720,
    bitrate: 3_000_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    bitrate: 1_500_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
  {
    name: '360p',
    width: 640,
    height: 360,
    bitrate: 800_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
];

export const ABR_TRANSCODE_PROFILES: TranscodeProfile[] = [
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    bitrate: 6_000_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
  {
    name: '720p',
    width: 1280,
    height: 720,
    bitrate: 3_000_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    bitrate: 1_500_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
  {
    name: '360p',
    width: 640,
    height: 360,
    bitrate: 800_000,
    fps: 30,
    fpsDen: 1,
    gop: '2',
    profile: 'H264',
  },
];

// ─── LivepeerService ────────────────────────────────────────────────────

export class LivepeerService {
  private env: Env;
  private baseUrl = 'https://livepeer.studio/api';
  private apiKey: string;

  constructor(env: Env, apiKey?: string) {
    this.env = env;
    this.apiKey = apiKey ?? env.LIVEPEER_API_KEY ?? '';
    if (this.apiKey) {
      // User-configured API key
    }
  }

  private getHeaders(): HeadersInit {
    return {
      authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': 'DegenFeed-Livepeer-Service/0.1',
    };
  }

  /**
   * Create a new Livepeer stream.
   *
   * Returns RTMP ingest URL, stream key, and HLS playback URL.
   * If no API key is configured, returns a simulated response for local dev.
   */
  async createStream(
    name: string,
    options?: Partial<LivepeerStreamOptions>,
  ): Promise<LivepeerStream> {
    if (!this.apiKey) {
      console.warn(
        '[livepeer-service] No LIVEPEER_API_KEY configured — returning simulated stream',
      );
      return this.simulateStream(name);
    }

    return withReliability(
      'livepeer',
      async () => {
        const body: Record<string, unknown> = {
          name,
          record: options?.record ?? true,
          profiles: options?.profiles ?? ABR_TRANSCODE_PROFILES,
          lowLatency: options?.lowLatency ?? true,
        };

        const response = await fetch(`${this.baseUrl}/stream`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown');
          throw new Error(`Livepeer createStream failed (${response.status}): ${text}`);
        }

        const stream = (await response.json()) as LivepeerStream;
        await this.recordSuccess('createStream');
        return stream;
      },
      { env: this.env },
    );
  }

  /**
   * Get a stream's current status by ID.
   */
  async getStream(id: string): Promise<LivepeerStream | null> {
    if (!this.apiKey) return null;

    return withReliability(
      'livepeer',
      async () => {
        const response = await fetch(`${this.baseUrl}/stream/${encodeURIComponent(id)}`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000),
        });

        if (response.status === 404) return null;
        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown');
          throw new Error(`Livepeer getStream failed (${response.status}): ${text}`);
        }

        return (await response.json()) as LivepeerStream;
      },
      { env: this.env },
    );
  }

  /**
   * Get real-time viewer count for a stream.
   *
   * Uses the sessions endpoint to aggregate current viewer metrics.
   * Returns 0 if no active sessions found.
   */
  async getViewerCount(id: string): Promise<LivepeerViewerMetrics> {
    const empty: LivepeerViewerMetrics = {
      viewerCount: 0,
      playbackId: '',
      streamId: id,
      viewTimestamps: [],
    };

    if (!this.apiKey) return empty;

    return withReliability(
      'livepeer',
      async () => {
        // Get stream first to find the playbackId
        const stream = await this.getStream(id);
        if (!stream?.playbackId) return empty;

        // Fetch sessions to aggregate viewer metrics
        const sessionsResp = await fetch(
          `${this.baseUrl}/stream/${encodeURIComponent(id)}/sessions`,
          { headers: this.getHeaders(), signal: AbortSignal.timeout(5000) },
        );

        if (!sessionsResp.ok) return { ...empty, playbackId: stream.playbackId };

        const sessions = (await sessionsResp.json()) as LivepeerSession[];

        // Count active sessions (seen within last 30 seconds)
        const now = Date.now();
        const activeSessions = sessions.filter((s) => s.isActive && now - s.lastSeen < 30000);

        return {
          viewerCount: activeSessions.length,
          playbackId: stream.playbackId,
          streamId: id,
          viewTimestamps: activeSessions.map((s) => s.lastSeen),
        };
      },
      { env: this.env },
    );
  }

  /**
   * Get transcoding sessions for a stream (for analytics/debugging).
   */
  async getSessions(streamId: string): Promise<LivepeerSession[]> {
    if (!this.apiKey) return [];

    return withReliability(
      'livepeer',
      async () => {
        const response = await fetch(
          `${this.baseUrl}/stream/${encodeURIComponent(streamId)}/sessions`,
          { headers: this.getHeaders(), signal: AbortSignal.timeout(5000) },
        );

        if (!response.ok) return [];
        return (await response.json()) as LivepeerSession[];
      },
      { env: this.env },
    );
  }

  /**
   * Terminate a stream (stop transcoding, end the stream).
   */
  async terminateStream(streamId: string): Promise<void> {
    if (!this.apiKey) return;

    await withReliability(
      'livepeer',
      async () => {
        const response = await fetch(`${this.baseUrl}/stream/${encodeURIComponent(streamId)}`, {
          method: 'DELETE',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok && response.status !== 404) {
          const text = await response.text().catch(() => 'unknown');
          throw new Error(`Livepeer terminateStream failed (${response.status}): ${text}`);
        }
      },
      { env: this.env },
    );
  }

  /**
   * Set stream recording state.
   */
  async setRecording(streamId: string, enabled: boolean): Promise<void> {
    if (!this.apiKey) return;

    await withReliability(
      'livepeer',
      async () => {
        const response = await fetch(`${this.baseUrl}/stream/${encodeURIComponent(streamId)}`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ record: enabled }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown');
          throw new Error(`Livepeer setRecording failed (${response.status}): ${text}`);
        }
      },
      { env: this.env },
    );
  }

  /**
   * Toggle low-latency mode (LL-HLS) on a stream.
   */
  async setLowLatency(streamId: string, enabled: boolean): Promise<void> {
    if (!this.apiKey) return;

    await withReliability(
      'livepeer',
      async () => {
        const response = await fetch(`${this.baseUrl}/stream/${encodeURIComponent(streamId)}`, {
          method: 'PATCH',
          headers: this.getHeaders(),
          body: JSON.stringify({ lowLatency: enabled }),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown');
          throw new Error(`Livepeer setLowLatency failed (${response.status}): ${text}`);
        }
      },
      { env: this.env },
    );
  }

  /**
   * Get available transcode profiles for reference.
   */
  getTranscodeProfiles(): TranscodeProfile[] {
    return ABR_TRANSCODE_PROFILES;
  }

  /**
   * Handle incoming Livepeer webhook events.
   *
   * Returns a normalized event for upstream processing.
   */
  handleWebhook(payload: LivepeerWebhookPayload): {
    event: string;
    streamId: string;
    data: Record<string, unknown>;
  } {
    const base = {
      streamId: payload.streamId,
      data: { ...payload } as unknown as Record<string, unknown>,
    };

    switch (payload.type) {
      case 'stream.started':
        return {
          event: 'stream_started',
          ...base,
          data: {
            ...base.data,
            playbackUrl: `https://livepeercdn.studio/hls/${payload.playbackId}/index.m3u8`,
          },
        };
      case 'stream.idle':
        return { event: 'stream_ended', ...base };
      case 'recording.ready':
        return {
          event: 'recording_ready',
          ...base,
          data: {
            ...base.data,
            recordingUrl: payload.recordingUrl,
          },
        };
      default:
        return { event: payload.type, ...base };
    }
  }

  /**
   * Generate the HLS playback URL for a given playbackId.
   */
  getPlaybackUrl(playbackId: string): string {
    return `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`;
  }

  /**
   * Generate a thumbnail URL for a playbackId from Livepeer CDN.
   */
  getThumbnailUrl(playbackId: string): string {
    return `https://livepeercdn.studio/thumbnail/${playbackId}.png`;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  /**
   * Simulate a Livepeer stream for local development when no API key is set.
   */
  private simulateStream(name: string): LivepeerStream {
    const id =
      crypto.randomUUID?.() ?? `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const playbackId = `sim-${Math.random().toString(36).slice(2, 14)}`;
    return {
      id,
      name,
      streamKey: `sim-${Math.random().toString(36).slice(2, 18)}`,
      rtmpIngestUrl: 'rtmp://livepeer.degenfeed.xyz/live',
      playbackId,
      playbackUrl: `https://livepeercdn.studio/hls/${playbackId}/index.m3u8`,
      isActive: true,
      createdAt: Date.now(),
      sourceSegments: 0,
      transcodedSegments: 0,
      sourceSegmentsDuration: 0,
      transcodedSegmentsDuration: 0,
      record: true,
      profiles: ABR_TRANSCODE_PROFILES,
      lowLatency: true,
      suspended: false,
    };
  }

  private async recordSuccess(_operation: string): Promise<void> {
    try {
      await recordBridgeOperation(this.env, 'livepeer', true, 0);
    } catch {
      // Non-critical
    }
  }
}

// ─── Standalone Helper Functions ────────────────────────────────────────

/**
 * Create a Livepeer stream and return just the essential RTMP + playback info.
 * Useful for one-off integrations that don't need the full service.
 */
export async function createLivepeerStream(
  env: Env,
  name: string,
  options?: Partial<LivepeerStreamOptions>,
): Promise<{
  streamKey: string;
  rtmpUrl: string;
  playbackUrl: string;
  streamId: string;
  playbackId: string;
}> {
  const service = new LivepeerService(env);
  const stream = await service.createStream(name, options);
  return {
    streamKey: stream.streamKey,
    rtmpUrl: stream.rtmpIngestUrl,
    playbackUrl: stream.playbackUrl,
    streamId: stream.id,
    playbackId: stream.playbackId,
  };
}

/**
 * Check if Livepeer is configured and reachable.
 */
export async function livepeerHealthCheck(env: Env): Promise<{
  healthy: boolean;
  configured: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  const apiKey = env.LIVEPEER_API_KEY;

  if (!apiKey) {
    return { healthy: false, configured: false, latencyMs: 0 };
  }

  try {
    const response = await fetch('https://livepeer.studio/api/stream', {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return {
      healthy: response.ok,
      configured: true,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { healthy: false, configured: true, latencyMs: Date.now() - start };
  }
}
