/**
 * @degenfeed/livepeer-provider
 *
 * Livepeer API client for DegenFeed live streaming and recording.
 *
 * Livepeer is a decentralized video streaming network used by Zora and many
 * other Web3 platforms. This provider wraps the Livepeer Studio API for:
 *   - Creating RTMP→HLS live streams
 *   - Monitoring stream health (viewers, bitrate, status)
 *   - Exporting recordings to IPFS for NFT minting
 *
 * API Reference:
 *   POST /api/stream            — Create a new livestream
 *   GET  /api/stream/{id}       — Get stream status
 *   GET  /api/stream/{id}/sessions — Get recording/asset info
 *   POST /api/asset/upload      — Upload recorded file to IPFS
 *
 * Livepeer Studio Docs: https://docs.livepeer.studio/reference
 */

// ─── Types ─────────────────────────────────────────────────────────────

export interface LivepeerProviderConfig {
  /** Livepeer Studio API key. */
  apiKey: string;
  /** Livepeer Studio API base URL. */
  baseUrl?: string;
}

export interface LivepeerStreamOptions {
  /** Human-readable stream name. */
  name: string;
  /** Optional creator wallet/address for metadata. */
  creator?: string;
  /** Optional record flag — save stream as recording after end. */
  record?: boolean;
  /** Max stream duration in seconds (0 = unlimited). */
  maxDuration?: number;
  /** Optional multi-track transcription config. */
  playbackPolicy?: {
    type: 'public' | 'jwt' | 'webhook';
    webhookId?: string;
    webhookContext?: Record<string, unknown>;
  };
  /** Optional source segment size for low-latency tuning. */
  latencyLevel?: 'low' | 'medium' | 'realtime';
}

export interface LivepeerStreamResult {
  /** Livepeer stream ID. */
  id: string;
  /** RTMP ingest URL. */
  rtmpUrl: string;
  /** RTMP stream key. */
  streamKey: string;
  /** HLS playback URL. */
  playbackUrl: string;
  /** Playback ID (short form). */
  playbackId: string;
  /** Status: 'idle', 'active', 'ended', 'error'. */
  status: string;
  /** Whether the stream is currently active. */
  isActive: boolean;
  /** When the stream was created (ISO 8601). */
  createdAt: string;
}

export interface LivepeerStreamStatus {
  /** Livepeer stream ID. */
  id: string;
  /** Status: 'idle', 'waiting', 'active', 'ended', 'error'. */
  status: 'idle' | 'waiting' | 'active' | 'ended' | 'error';
  /** Whether the stream is currently active. */
  isActive: boolean;
  /** Current viewer count. */
  viewerCount: number;
  /** Last seen timestamp (ISO 8601) of the broadcaster. */
  lastSeen?: string;
  /** Source segment duration in ms (lower = lower latency). */
  sourceSegmentsDuration?: number;
  /** Recording status if record=true. */
  recordingStatus?: 'waiting' | 'ready' | 'failed';
  /** Asset ID for the recording (set after stream ends). */
  recordingAssetId?: string;
  /** Error message if status='error'. */
  lastError?: string;
}

export interface LivepeerRecordingResult {
  /** Asset ID of the recording. */
  assetId: string;
  /** HLS playback URL of the recording. */
  playbackUrl: string;
  /** IPFS CID of the recording (for NFT minting). */
  ipfsCid?: string;
  /** Duration in seconds. */
  duration: number;
  /** File size in bytes. */
  size: number;
  /** Whether processing is complete. */
  ready: boolean;
}

// ─── Error type ───────────────────────────────────────────────────────

export class LivepeerProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'LivepeerProviderError';
  }
}

// ─── Constants ───────────────────────────────────────────────────────

const LIVEpeer_API_BASE = 'https://livepeer.studio/api';

// ─── HTTP Helper ──────────────────────────────────────────────────────

async function apiFetch(
  baseUrl: string,
  apiKey: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${apiKey}`);
  headers.set('accept', 'application/json');
  headers.set('user-agent', 'DegenFeed/1.0 (livepeer)');

  if (options.body && typeof options.body === 'string') {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  const url = `${baseUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }
    throw new LivepeerProviderError(
      `Livepeer API error: ${response.status} ${response.statusText}`,
      response.status,
      body,
    );
  }

  return response;
}

// ─── Main Class ──────────────────────────────────────────────────────

export class LivepeerProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: LivepeerProviderConfig) {
    this.baseUrl = (config.baseUrl ?? LIVEpeer_API_BASE).replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  /**
   * Create a new live stream via Livepeer Studio.
   *
   * Returns RTMP ingest credentials (rtmpUrl + streamKey) for OBS/etc.
   * The HLS playback URL is available immediately for viewers.
   */
  async createStream(opts: LivepeerStreamOptions): Promise<LivepeerStreamResult> {
    const body: Record<string, unknown> = {
      name: opts.name,
      record: opts.record ?? true,
    };

    if (opts.maxDuration !== undefined && opts.maxDuration > 0) {
      body.maxDuration = opts.maxDuration;
    }

    if (opts.playbackPolicy) {
      body.playbackPolicy = opts.playbackPolicy;
    }

    if (opts.latencyLevel) {
      // Livepeer latency: 'low' (default 4s), 'medium' (8s), 'realtime' (2s)
      if (opts.latencyLevel === 'realtime') {
        body.latencyLevel = { targetLatency: 2000, maxLatency: 4000 };
      } else if (opts.latencyLevel === 'low') {
        body.latencyLevel = { targetLatency: 4000, maxLatency: 8000 };
      }
    }

    if (opts.creator) {
      body.creatorId = opts.creator;
    }

    const response = await apiFetch(this.baseUrl, this.apiKey, '/stream', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as Record<string, unknown>;

    return {
      id: String(data.id ?? ''),
      rtmpUrl: String(data.rtmpAddress ?? data.ingest?.rtmp ?? ''),
      streamKey: String(data.streamKey ?? ''),
      playbackUrl: String(
        data.playbackUrl ?? `https://livepeerr.io/hls/${data.playbackId}/index.m3u8`,
      ),
      playbackId: String(data.playbackId ?? ''),
      status: String(data.status ?? 'idle'),
      isActive: data.isActive === true,
      createdAt: String(data.createdAt ?? new Date().toISOString()),
    };
  }

  /**
   * Get the current status of a live stream.
   *
   * Returns viewer count, source health, and recording status.
   * Poll this during a live short to track engagement.
   */
  async getStreamStatus(streamId: string): Promise<LivepeerStreamStatus> {
    const response = await apiFetch(this.baseUrl, this.apiKey, `/stream/${streamId}`);

    const data = (await response.json()) as Record<string, unknown>;

    // Fetch session data for richer status (viewers, health)
    let viewerCount = 0;
    let lastSeen: string | undefined;
    let recordingStatus: 'waiting' | 'ready' | 'failed' | undefined;

    try {
      const sessionsResponse = await apiFetch(
        this.baseUrl,
        this.apiKey,
        `/stream/${streamId}/sessions`,
      );
      const sessions = (await sessionsResponse.json()) as Array<Record<string, unknown>>;
      if (sessions.length > 0) {
        const activeSession = sessions[sessions.length - 1] as Record<string, unknown>;
        viewerCount = Number(activeSession.viewerCount ?? 0);
        lastSeen = activeSession.lastSeen as string | undefined;
        recordingStatus = activeSession.recordingStatus as
          | 'waiting'
          | 'ready'
          | 'failed'
          | undefined;
      }
    } catch {
      // Session data is best-effort
    }

    const status = String(data.status ?? 'idle') as LivepeerStreamStatus['status'];

    return {
      id: streamId,
      status,
      isActive: data.isActive === true,
      viewerCount,
      lastSeen,
      sourceSegmentsDuration: data.sourceSegmentsDuration as number | undefined,
      recordingStatus,
      recordingAssetId: data.recordingAssetId as string | undefined,
      lastError: data.lastError as string | undefined,
    };
  }

  /**
   * End a live stream.
   *
   * If the stream was created with record=true, the recording will be
   * available as an asset shortly after ending.
   */
  async endStream(streamId: string): Promise<void> {
    await apiFetch(this.baseUrl, this.apiKey, `/stream/${streamId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get recording information for a completed stream.
   *
   * Returns the asset ID, playback URL, and IPFS CID when the recording
   * is ready. The IPFS CID can be used for NFT minting on Zora.
   */
  async getRecording(assetId: string): Promise<LivepeerRecordingResult | null> {
    try {
      const response = await apiFetch(this.baseUrl, this.apiKey, `/asset/${assetId}`);

      const data = (await response.json()) as Record<string, unknown>;
      const storage = data.storage as Record<string, unknown> | undefined;

      return {
        assetId: String(data.id ?? ''),
        playbackUrl: String(
          data.playbackUrl ?? `https://livepeerr.io/hls/${data.playbackId}/index.m3u8`,
        ),
        ipfsCid: (storage?.ipfs?.cid as string) ?? undefined,
        duration: Number(data.videoSpec?.duration ?? 0),
        size: Number(data.videoSpec?.size ?? 0),
        ready: data.status === 'ready',
      };
    } catch {
      return null;
    }
  }

  /**
   * Export a recording asset to IPFS via Livepeer's storage integration.
   *
   * This makes the recording available as a decentralized file suitable
   * for NFT metadata on Zora or other platforms.
   */
  async exportToIPFS(assetId: string): Promise<{ ipfsCid: string }> {
    const response = await apiFetch(this.baseUrl, this.apiKey, `/asset/${assetId}/export`, {
      method: 'POST',
      body: JSON.stringify({ ipfs: true }),
    });

    const data = (await response.json()) as Record<string, unknown>;
    const ipfs = data.ipfs as Record<string, unknown> | undefined;

    if (!ipfs?.cid) {
      throw new LivepeerProviderError('IPFS export completed but no CID returned');
    }

    return { ipfsCid: String(ipfs.cid) };
  }

  /**
   * Health check — verify the Livepeer API is reachable.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs: number;
  }> {
    const start = performance.now();
    try {
      await apiFetch(this.baseUrl, this.apiKey, '/stream?limit=1');
      return {
        healthy: true,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }
}
