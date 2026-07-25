/**
 * @degenfeed/api-worker — Adaptive Streaming Router
 *
 * Smart routing engine that selects the optimal streaming backend
 * based on real-time viewer count thresholds:
 *
 *   <10 viewers   → WebRTC P2P (FREE)
 *   10-50 viewers  → Owncast (our server, low cost)
 *   50-500 viewers → Livepeer ($0.003/viewer-hr)
 *   500+ viewers   → Cloudflare Stream ($1/1000 min stored + delivery)
 *
 * Auto-switches mode when viewer count crosses thresholds.
 * Transparent to the streamer — they just "go live" and we route.
 *
 * Modes:
 *   - p2p:  Zero server bandwidth. Viewers connect directly.
 *   - owncast: Self-hosted RTMP→HLS. Low cost per viewer.
 *   - livepeer: External transcoding/CDN. Scales to hundreds.
 *   - cloudflare: Enterprise CDN. Scales to tens of thousands.
 */

import type { Env } from '../index';
import { log } from '../index';
import { WebRTCSessionManager } from './webrtc-streaming';
import { LivepeerService } from './livepeer-service';

// ─── Types ──────────────────────────────────────────────────────────────

export type StreamingMode = 'p2p' | 'owncast' | 'livepeer' | 'cloudflare';

export interface ActiveStream {
  streamId: string;
  creatorId: string;
  title: string;
  mode: StreamingMode;
  currentViewers: number;
  previousMode?: StreamingMode;
  switchedAt?: number;
  rtmpUrl?: string;
  streamKey?: string;
  playbackUrl?: string;
  embedUrl?: string;
  livepeerStreamId?: string;
  webrtcSessionId?: string;
  startedAt: number;
  lastViewerCount: number;
  autoSwitch: boolean;
  privacy: 'public' | 'unlisted' | 'private';
  tokenGated?: boolean;
  tokenAddress?: string;
}

export interface StreamRouteDecision {
  recommendedMode: StreamingMode;
  reason: string;
  estimatedCost: string;
  costBreakdown: string;
  bandwidthSavings: string;
  canSwitch: boolean;
}

// ─── Cost Calculations (per viewer-hour) ──────────────────────────────

export const COST_PER_MODE: Record<StreamingMode, { cost: string; description: string }> = {
  p2p: {
    cost: '$0.00',
    description: 'Zero bandwidth — viewers stream directly from each other',
  },
  owncast: {
    cost: '~$0.00 (server capacity)',
    description: 'Self-hosted on our Owncast instance — fixed server cost regardless of viewers',
  },
  livepeer: {
    cost: '$0.003/viewer-hour',
    description: 'Livepeer transcoding + CDN delivery billed per viewer hour',
  },
  cloudflare: {
    cost: '$1.00/1000 min',
    description: 'Cloudflare Stream — billed per minute of delivered video',
  },
};

export const STREAMING_THRESHOLDS = {
  P2P_MAX: 10,
  OWNCAST_MAX: 50,
  LIVEPEER_MAX: 500,
  // Above 500 → Cloudflare Stream
};

export const MODE_LABELS: Record<StreamingMode, string> = {
  p2p: 'P2P Mode (Free)',
  owncast: 'Server Mode (Owncast)',
  livepeer: 'CDN Mode (Livepeer)',
  cloudflare: 'Enterprise CDN (Cloudflare Stream)',
};

// ─── Streaming Router ─────────────────────────────────────────────────

export class StreamingRouter {
  private env: Env;
  private webrtcManager: WebRTCSessionManager;
  private livepeerService: LivepeerService;

  constructor(env: Env) {
    this.env = env;
    this.webrtcManager = new WebRTCSessionManager(env);
    this.livepeerService = new LivepeerService(env);
  }

  /**
   * Decide the best streaming mode based on viewer count.
   *
   * This is the core routing decision. It evaluates current viewer
   * count against thresholds to recommend the most cost-effective mode.
   */
  decideMode(currentViewers: number): StreamRouteDecision {
    if (currentViewers < STREAMING_THRESHOLDS.P2P_MAX) {
      return {
        recommendedMode: 'p2p',
        reason: `Audience of ${currentViewers} supports P2P mesh. Zero bandwidth cost.`,
        estimatedCost: '$0.00',
        costBreakdown: 'No server bandwidth used — viewers connect directly via WebRTC',
        bandwidthSavings: '100% server bandwidth saved vs traditional streaming',
        canSwitch: true,
      };
    }

    if (currentViewers < STREAMING_THRESHOLDS.OWNCAST_MAX) {
      return {
        recommendedMode: 'owncast',
        reason: `Audience of ${currentViewers} fits Owncast server capacity. Low fixed cost.`,
        estimatedCost: '~$0.00 (server already running)',
        costBreakdown: 'Self-hosted Owncast — no per-viewer cost',
        bandwidthSavings: 'No variable cost — our server handles it',
        canSwitch: true,
      };
    }

    if (currentViewers < STREAMING_THRESHOLDS.LIVEPEER_MAX) {
      const estimatedCost = `~$${(currentViewers * 0.003).toFixed(2)}/hr`;
      return {
        recommendedMode: 'livepeer',
        reason: `Audience of ${currentViewers} exceeds Owncast capacity. Livepeer transcoding recommended.`,
        estimatedCost,
        costBreakdown: `Livepeer: ${currentViewers} viewers × $0.003 = ${estimatedCost}/hr`,
        bandwidthSavings: 'Offloads transcoding & CDN delivery to Livepeer',
        canSwitch: true,
      };
    }

    // 500+ viewers
    const estMinutesPerViewer = 60; // Assume 1 hr average watch
    const estimatedCost = `~$${((currentViewers * estMinutesPerViewer / 1000)).toFixed(2)}/hr (est. ${currentViewers} viewers × 60 min / 1000)`;
    return {
      recommendedMode: 'cloudflare',
      reason: `Audience of ${currentViewers} is large-scale. Cloudflare Stream recommended for reliability.`,
      estimatedCost,
      costBreakdown: `Cloudflare Stream: $1.00 per 1000 minutes delivered`,
      bandwidthSavings: 'Enterprise CDN with global edge caching',
      canSwitch: true,
    };
  }

  /**
   * Get the estimated cost for a given mode and viewer count.
   */
  getEstimatedCost(mode: StreamingMode, viewerCount: number): string {
    switch (mode) {
      case 'p2p':
        return '$0.00';
      case 'owncast':
        return '~$0.00 (fixed server cost)';
      case 'livepeer':
        return `~$${(viewerCount * 0.003).toFixed(2)}/hr`;
      case 'cloudflare':
        return `~$${((viewerCount * 60) / 1000).toFixed(2)}/hr`;
    }
  }

  /**
   * Evaluate whether to switch modes based on viewer count trend.
   * Returns the recommended action.
   */
  async evaluateSwitch(
    stream: ActiveStream,
    freshViewerCount: number,
  ): Promise<{
    shouldSwitch: boolean;
    newMode?: StreamingMode;
    reason?: string;
  }> {
    if (!stream.autoSwitch) {
      return { shouldSwitch: false };
    }

    const currentMode = stream.mode;
    const decision = this.decideMode(freshViewerCount);
    const newMode = decision.recommendedMode;

    // Don't switch to the same mode
    if (newMode === currentMode) {
      return { shouldSwitch: false };
    }

    // Check if we recently switched (cooldown period: 2 minutes)
    if (stream.switchedAt && Date.now() - stream.switchedAt < 120_000) {
      return {
        shouldSwitch: false,
        reason: `Recently switched (${Math.round((Date.now() - stream.switchedAt) / 1000)}s ago). Cooldown active.`,
      };
    }

    return {
      shouldSwitch: true,
      newMode,
      reason: decision.reason,
    };
  }

  /**
   * Execute a mode switch for a stream.
   * This is called when viewer count crosses a threshold.
   */
  async switchMode(
    stream: ActiveStream,
    newMode: StreamingMode,
  ): Promise<ActiveStream> {
    log('info', '[streaming-router] Switching stream mode', {
      streamId: stream.streamId,
      from: stream.mode,
      to: newMode,
    });

    const previousMode = stream.mode;

    // Clean up old mode resources
    await this.cleanupMode(stream, previousMode);

    // Set up new mode
    switch (newMode) {
      case 'p2p':
        // P2P mode — nothing to set up server-side
        stream.rtmpUrl = undefined;
        stream.streamKey = undefined;
        stream.playbackUrl = undefined;
        stream.livepeerStreamId = undefined;
        break;

      case 'owncast': {
        // Generate Owncast RTMP credentials
        const instanceUrl = this.env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
        const key =
          crypto.randomUUID?.().replace(/-/g, '').slice(0, 16) ??
          `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
        stream.rtmpUrl = `rtmp://owncast.degenfeed.xyz/live`;
        stream.streamKey = key;
        stream.playbackUrl = `${instanceUrl}/embed/video`;
        stream.embedUrl = `${instanceUrl}/embed/video`;
        break;
      }

      case 'livepeer': {
        // Create Livepeer stream
        try {
          const livepeerStream = await this.livepeerService.createStream(
            stream.title,
            { record: true, lowLatency: true },
          );
          stream.rtmpUrl = livepeerStream.rtmpIngestUrl;
          stream.streamKey = livepeerStream.streamKey;
          stream.playbackUrl = livepeerStream.playbackUrl;
          stream.livepeerStreamId = livepeerStream.id;
        } catch (err) {
          log('error', '[streaming-router] Failed to create Livepeer stream', {
            streamId: stream.streamId,
            error: String(err),
          });
          // Fall back to Owncast if Livepeer fails
          return this.switchMode(stream, 'owncast');
        }
        break;
      }

      case 'cloudflare': {
        // Cloudflare Stream — set up via their API
        // For now, fall through to Livepeer as Cloudflare Stream
        // requires additional setup
        if (!this.env.CLOUDFLARE_STREAM_TOKEN) {
          log('warn', '[streaming-router] Cloudflare Stream not configured, falling back to Livepeer', {
            streamId: stream.streamId,
          });
          return this.switchMode(stream, 'livepeer');
        }
        // Cloudflare Stream setup would go here
        stream.playbackUrl = `https://videodelivery.net/${stream.streamId}/manifest/video.m3u8`;
        break;
      }
    }

    stream.mode = newMode;
    stream.previousMode = previousMode;
    stream.switchedAt = Date.now();

    // Persist update
    await this.persistStream(stream);

    log('info', '[streaming-router] Stream mode switched successfully', {
      streamId: stream.streamId,
      from: previousMode,
      to: newMode,
    });

    return stream;
  }

  /**
   * Create a new stream with the appropriate initial mode.
   */
  async createStream(
    creatorId: string,
    title: string,
    initialViewers = 0,
    options?: {
      autoSwitch?: boolean;
      privacy?: 'public' | 'unlisted' | 'private';
      tokenGated?: boolean;
      tokenAddress?: string;
    },
  ): Promise<ActiveStream> {
    const streamId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const decision = this.decideMode(initialViewers);
    const mode = decision.recommendedMode;

    const stream: ActiveStream = {
      streamId,
      creatorId,
      title,
      mode,
      currentViewers: initialViewers,
      startedAt: Date.now(),
      lastViewerCount: initialViewers,
      autoSwitch: options?.autoSwitch ?? true,
      privacy: options?.privacy ?? 'public',
      tokenGated: options?.tokenGated,
      tokenAddress: options?.tokenAddress,
    };

    // Set up initial mode
    await this.switchMode(stream, mode);

    return stream;
  }

  /**
   * Get stream status including routing info.
   */
  async getStreamStatus(streamId: string): Promise<ActiveStream | null> {
    try {
      const raw = await this.env.CACHE?.get(`stream:active:${streamId}`);
      if (!raw) return null;
      return JSON.parse(raw) as ActiveStream;
    } catch {
      return null;
    }
  }

  /**
   * Update viewer count and evaluate mode switch.
   */
  async updateViewerCount(
    streamId: string,
    viewerCount: number,
  ): Promise<{
    switched: boolean;
    newMode?: StreamingMode;
    stream?: ActiveStream;
  }> {
    const stream = await this.getStreamStatus(streamId);
    if (!stream) {
      return { switched: false };
    }

    stream.currentViewers = viewerCount;
    stream.lastViewerCount = viewerCount;

    // Evaluate whether to switch modes
    const evalResult = await this.evaluateSwitch(stream, viewerCount);

    if (evalResult.shouldSwitch && evalResult.newMode) {
      const updated = await this.switchMode(stream, evalResult.newMode);
      return {
        switched: true,
        newMode: evalResult.newMode,
        stream: updated,
      };
    }

    // Persist updated viewer count
    await this.persistStream(stream);

    return { switched: false, stream };
  }

  /**
   * End a stream and clean up all resources.
   */
  async endStream(streamId: string): Promise<void> {
    const stream = await this.getStreamStatus(streamId);
    if (!stream) return;

    log('info', '[streaming-router] Ending stream', { streamId, mode: stream.mode });

    await this.cleanupMode(stream, stream.mode);

    try {
      await this.env.CACHE?.delete(`stream:active:${streamId}`);
    } catch {
      // Non-critical
    }
  }

  /**
   * List all active streams with their current modes.
   */
  async listActiveStreams(): Promise<ActiveStream[]> {
    try {
      const raw = await this.env.CACHE?.get('stream:active:index');
      if (!raw) return [];

      const ids: string[] = JSON.parse(raw);
      const streams: ActiveStream[] = [];

      for (const id of ids) {
        const stream = await this.getStreamStatus(id);
        if (stream) streams.push(stream);
      }

      return streams;
    } catch {
      return [];
    }
  }

  /**
   * Persist stream to KV.
   */
  private async persistStream(stream: ActiveStream): Promise<void> {
    try {
      await this.env.CACHE?.put(
        `stream:active:${stream.streamId}`,
        JSON.stringify(stream),
        { expirationTtl: 86400 }, // 24h TTL
      );

      // Add to index
      const raw = await this.env.CACHE?.get('stream:active:index');
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(stream.streamId)) {
        ids.push(stream.streamId);
        await this.env.CACHE?.put('stream:active:index', JSON.stringify(ids), {
          expirationTtl: 86400,
        });
      }
    } catch {
      // Non-critical
    }
  }

  /**
   * Clean up resources for a specific mode.
   */
  private async cleanupMode(
    stream: ActiveStream,
    mode: StreamingMode,
  ): Promise<void> {
    try {
      switch (mode) {
        case 'p2p':
          if (stream.webrtcSessionId) {
            await this.webrtcManager.endSession(stream.webrtcSessionId);
          }
          break;
        case 'livepeer':
          if (stream.livepeerStreamId) {
            await this.livepeerService.terminateStream(
              stream.livepeerStreamId,
            );
          }
          break;
        case 'owncast':
        case 'cloudflare':
          // No explicit cleanup needed
          break;
      }
    } catch (err) {
      log('warn', '[streaming-router] Cleanup error', {
        streamId: stream.streamId,
        mode,
        error: String(err),
      });
    }
  }
}

// ─── Route Handler ─────────────────────────────────────────────────────

/**
 * GET /api/live/route/status/:streamId
 * Get the current routing status for a stream.
 */
export async function handleStreamRouteStatus(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const router = new StreamingRouter(env);
    const stream = await router.getStreamStatus(streamId);

    if (!stream) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      );
    }

    const decision = router.decideMode(stream.currentViewers);

    return new Response(
      JSON.stringify({
        streamId: stream.streamId,
        mode: stream.mode,
        modeLabel: MODE_LABELS[stream.mode],
        currentViewers: stream.currentViewers,
        autoSwitch: stream.autoSwitch,
        recommendedMode: decision.recommendedMode,
        recommendedLabel: MODE_LABELS[decision.recommendedMode],
        estimatedCost: decision.estimatedCost,
        costBreakdown: decision.costBreakdown,
        bandwidthSavings: decision.bandwidthSavings,
        switchedAt: stream.switchedAt,
        previousMode: stream.previousMode,
        playbackUrl: stream.playbackUrl,
        startedAt: stream.startedAt,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
        },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: `Failed to get route status: ${error}` }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
}

/**
 * GET /api/live/route/estimate
 * Estimate the cost for a given viewer count.
 */
export async function handleRouteEstimate(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const viewerCount = Math.max(
      0,
      Number(url.searchParams.get('viewers')) || 0,
    );

    const router = new StreamingRouter(env);
    const decision = router.decideMode(viewerCount);

    return new Response(
      JSON.stringify({
        viewerCount,
        mode: decision.recommendedMode,
        modeLabel: MODE_LABELS[decision.recommendedMode],
        estimatedCost: decision.estimatedCost,
        costBreakdown: decision.costBreakdown,
        bandwidthSavings: decision.bandwidthSavings,
        thresholds: {
          p2pMax: STREAMING_THRESHOLDS.P2P_MAX,
          owncastMax: STREAMING_THRESHOLDS.OWNCAST_MAX,
          livepeerMax: STREAMING_THRESHOLDS.LIVEPEER_MAX,
        },
        costTable: [
          { mode: 'p2p', label: 'P2P Mode', viewers: '0-9', cost: '$0.00', bandwidth: 'Zero' },
          { mode: 'owncast', label: 'Owncast', viewers: '10-49', cost: 'Fixed server cost', bandwidth: 'Self-hosted' },
          { mode: 'livepeer', label: 'Livepeer', viewers: '50-499', cost: '$0.003/viewer-hr', bandwidth: 'CDN' },
          {
            mode: 'cloudflare',
            label: 'Cloudflare Stream',
            viewers: '500+',
            cost: '$1/1000 min',
            bandwidth: 'Enterprise CDN',
          },
        ],
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=60',
        },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: `Failed to estimate: ${error}` }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
}

/**
 * POST /api/live/route/switch
 * Manually switch a stream to a specific mode.
 */
export async function handleRouteSwitch(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const body = (await request.json()) as {
      streamId: string;
      mode: StreamingMode;
    };

    if (!body.streamId || !body.mode) {
      return new Response(
        JSON.stringify({ error: 'streamId and mode are required' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const validModes: StreamingMode[] = [
      'p2p',
      'owncast',
      'livepeer',
      'cloudflare',
    ];
    if (!validModes.includes(body.mode)) {
      return new Response(
        JSON.stringify({
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}`,
        }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    const router = new StreamingRouter(env);
    const stream = await router.getStreamStatus(body.streamId);

    if (!stream) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 404, headers: { 'content-type': 'application/json' } },
      );
    }

    const updated = await router.switchMode(stream, body.mode);

    return new Response(
      JSON.stringify({
        ok: true,
        streamId: updated.streamId,
        mode: updated.mode,
        modeLabel: MODE_LABELS[updated.mode],
        rtmpUrl: updated.rtmpUrl,
        streamKey: updated.streamKey,
        playbackUrl: updated.playbackUrl,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: `Failed to switch mode: ${error}` }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }
}
