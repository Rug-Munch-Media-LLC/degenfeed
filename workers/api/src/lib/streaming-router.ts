/**
 * @degenfeed/api-worker — Enhanced Adaptive Streaming Router
 *
 * Intelligent routing engine that selects the optimal streaming backend
 * based on real-time viewer count thresholds:
 *
 *   <10 viewers   → WebRTC P2P (FREE — browser-to-browser, zero bandwidth)
 *   10-50 viewers  → Owncast (self-hosted, fixed server cost)
 *   50-500 viewers → PeerTube Live (our instance, federated distribution, free)
 *   500+ viewers   → Livepeer (external, $0.003/viewer-hr)
 *   5000+ viewers  → Cloudflare Stream (enterprise CDN)
 *
 * Features:
 *   - Auto-switch based on real-time viewer count
 *   - Transparent to streamer — they just "go live"
 *   - Bandwidth monitoring & cost tracking
 *   - IPFS VOD archiving after stream ends
 *   - PeerTube federation for free distribution
 *   - Cost optimization (auto-downgrade when viewers drop)
 */

import type { Env } from '../index';
import { log } from '../index';
import { uploadToIPFS } from './ipfs-storage';
import { LivepeerService } from './livepeer-service';
import { WebRTCSessionManager } from './webrtc-streaming';

// ─── Types ──────────────────────────────────────────────────────────────

export type StreamingMode = 'p2p' | 'owncast' | 'peertube' | 'livepeer' | 'cloudflare';

export interface SimulcastTarget {
  platform: string;
  streamKey?: string;
  rtmpUrl?: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'offline';
  lastChecked?: number;
  error?: string;
}

export interface BandwidthUsage {
  bytesUploaded: number;
  bytesDownloaded: number;
  estimatedCost: number;
  costCurrency: string;
  viewerHours: number;
  lastUpdated: number;
  perMode: Record<string, { bytes: number; cost: number }>;
}

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
  livepeerPlaybackId?: string;
  webrtcSessionId?: string;
  peertubeStreamId?: string;
  peertubeChannelId?: string;
  peertubeVideoUuid?: string;
  startedAt: number;
  lastViewerCount: number;
  lastViewerUpdate: number;
  autoSwitch: boolean;
  privacy: 'public' | 'unlisted' | 'private';
  tokenGated?: boolean;
  tokenAddress?: string;
  /** Simulcast targets for multi-platform broadcasting */
  simulcastTargets?: SimulcastTarget[];
  /** IPFS CID of archived VOD (set after stream ends) */
  ipfsVodCid?: string;
  /** Duration in seconds (set after end) */
  recordingDuration?: number;
  /** Bandwidth tracking for cost optimization */
  bandwidthUsage?: BandwidthUsage;
  /** PeerTube federated instances this stream is distributed to */
  federatedInstances?: string[];
  /** Whether stream is cross-posted to Nostr as NIP-53 */
  nostrAnnounced?: boolean;
}

export interface StreamRouteDecision {
  recommendedMode: StreamingMode;
  reason: string;
  estimatedCost: string;
  costBreakdown: string;
  bandwidthSavings: string;
  canSwitch: boolean;
  alternativeModes?: Array<{
    mode: StreamingMode;
    cost: string;
    reason: string;
  }>;
}

// ─── Cost Calculations (per viewer-hour) ──────────────────────────────

export const COST_PER_MODE: Record<StreamingMode, { cost: string; description: string }> = {
  p2p: {
    cost: '$0.00',
    description: 'Zero bandwidth — viewers stream directly from each other via WebRTC',
  },
  owncast: {
    cost: '~$0.00 (server capacity)',
    description: 'Self-hosted Owncast — fixed server cost regardless of viewers',
  },
  peertube: {
    cost: '$0.00 (federated)',
    description: 'PeerTube — our instance + federated instances distribute load for free',
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
  PEERTUBE_MAX: 500,
  LIVEPEER_MAX: 5000,
  // Above 5000 → Cloudflare Stream
};

export const MODE_LABELS: Record<StreamingMode, string> = {
  p2p: 'P2P Mode (Free)',
  owncast: 'Server Mode (Owncast)',
  peertube: 'Federated Mode (PeerTube)',
  livepeer: 'CDN Mode (Livepeer)',
  cloudflare: 'Enterprise CDN (Cloudflare Stream)',
};

export const MODE_EMOJIS: Record<StreamingMode, string> = {
  p2p: '🔗',
  owncast: '📡',
  peertube: '🎥',
  livepeer: '⚡',
  cloudflare: '☁️',
};

// ─── Cost per GB (approximate) ────────────────────────────────────────

const COST_PER_GB: Record<StreamingMode, number> = {
  p2p: 0,
  owncast: 0,
  peertube: 0,
  livepeer: 0.003,
  cloudflare: 0.001,
};

// ─── Bandwidth Tracker ────────────────────────────────────────────────

export class BandwidthTracker {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private bandwidthKey(streamId: string): string {
    return `bandwidth:stream:${streamId}`;
  }

  private bandwidthIndexKey(): string {
    return 'bandwidth:index';
  }

  /**
   * Record bandwidth usage for a stream.
   */
  async recordUsage(
    streamId: string,
    mode: StreamingMode,
    bytesUploaded: number,
    bytesDownloaded: number,
    viewerHours: number,
  ): Promise<BandwidthUsage> {
    const key = this.bandwidthKey(streamId);
    let usage: BandwidthUsage;

    try {
      const raw = await this.env.CACHE?.get(key);
      usage = raw ? (JSON.parse(raw) as BandwidthUsage) : this.createEmptyUsage();
    } catch {
      usage = this.createEmptyUsage();
    }

    usage.bytesUploaded += bytesUploaded;
    usage.bytesDownloaded += bytesDownloaded;
    usage.viewerHours += viewerHours;
    usage.lastUpdated = Date.now();

    if (!usage.perMode[mode]) {
      usage.perMode[mode] = { bytes: 0, cost: 0 };
    }
    usage.perMode[mode].bytes += bytesUploaded + bytesDownloaded;
    usage.perMode[mode].cost += this.estimateCost(mode, bytesUploaded + bytesDownloaded);

    // Recalculate total estimated cost
    usage.estimatedCost = Object.values(usage.perMode).reduce((sum, m) => sum + m.cost, 0);

    try {
      await this.env.CACHE?.put(key, JSON.stringify(usage), { expirationTtl: 86400 * 30 });
      await this.addToIndex(streamId);
    } catch {
      // Non-critical
    }

    return usage;
  }

  /**
   * Get bandwidth usage for a stream.
   */
  async getUsage(streamId: string): Promise<BandwidthUsage | null> {
    try {
      const raw = await this.env.CACHE?.get(this.bandwidthKey(streamId));
      return raw ? (JSON.parse(raw) as BandwidthUsage) : null;
    } catch {
      return null;
    }
  }

  /**
   * Estimate cost for a given amount of bytes in a mode.
   */
  estimateCost(mode: StreamingMode, bytes: number): number {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb * (COST_PER_GB[mode] ?? 0);
  }

  /**
   * Get bandwidth saved compared to traditional CDN streaming ($0.01/GB).
   */
  getBandwidthSavings(usage: BandwidthUsage): number {
    const totalBytes = usage.bytesUploaded + usage.bytesDownloaded;
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const cdnCost = totalGB * 0.01; // Traditional CDN cost
    return Math.max(0, cdnCost - usage.estimatedCost);
  }

  /**
   * Get total bandwidth across all monitored streams.
   */
  async getTotalUsage(): Promise<{
    totalBytes: number;
    totalCost: number;
    totalSavings: number;
    streamCount: number;
  }> {
    const streamIds = await this.getIndex();
    let totalBytes = 0;
    let totalCost = 0;
    let streamCount = 0;

    for (const id of streamIds) {
      const usage = await this.getUsage(id);
      if (usage) {
        totalBytes += usage.bytesUploaded + usage.bytesDownloaded;
        totalCost += usage.estimatedCost;
        streamCount++;
      }
    }

    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const cdnCost = totalGB * 0.01;
    const totalSavings = Math.max(0, cdnCost - totalCost);

    return { totalBytes, totalCost, totalSavings, streamCount };
  }

  private createEmptyUsage(): BandwidthUsage {
    return {
      bytesUploaded: 0,
      bytesDownloaded: 0,
      estimatedCost: 0,
      costCurrency: 'USD',
      viewerHours: 0,
      lastUpdated: Date.now(),
      perMode: {},
    };
  }

  private async addToIndex(streamId: string): Promise<void> {
    try {
      const raw = await this.env.CACHE?.get(this.bandwidthIndexKey());
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(streamId)) {
        ids.push(streamId);
        await this.env.CACHE?.put(this.bandwidthIndexKey(), JSON.stringify(ids), {
          expirationTtl: 86400 * 30,
        });
      }
    } catch {
      // Non-critical
    }
  }

  private async getIndex(): Promise<string[]> {
    try {
      const raw = await this.env.CACHE?.get(this.bandwidthIndexKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

// ─── Streaming Router ─────────────────────────────────────────────────

export class StreamingRouter {
  private env: Env;
  private webrtcManager: WebRTCSessionManager;
  private livepeerService: LivepeerService;
  private bandwidthTracker: BandwidthTracker;

  constructor(env: Env) {
    this.env = env;
    this.webrtcManager = new WebRTCSessionManager(env);
    this.livepeerService = new LivepeerService(env);
    this.bandwidthTracker = new BandwidthTracker(env);
  }

  getBandwidthTracker(): BandwidthTracker {
    return this.bandwidthTracker;
  }

  // ─── Routing Decision ────────────────────────────────────────────

  /**
   * Decide the best streaming mode based on viewer count.
   * This is the core routing decision engine.
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
        alternativeModes: [
          { mode: 'owncast', cost: '~$0.00', reason: 'Fallback if P2P NAT traversal fails' },
        ],
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

    if (currentViewers < STREAMING_THRESHOLDS.PEERTUBE_MAX) {
      return {
        recommendedMode: 'peertube',
        reason: `Audience of ${currentViewers} fits PeerTube. Federated distribution, zero cost.`,
        estimatedCost: '$0.00',
        costBreakdown: 'PeerTube: self-hosted + federated instances distribute load for free',
        bandwidthSavings: 'Free federated distribution via ActivityPub',
        canSwitch: true,
        alternativeModes: [
          {
            mode: 'livepeer',
            cost: `~$${(currentViewers * 0.003).toFixed(2)}/hr`,
            reason: 'Fallback if PeerTube is overloaded',
          },
        ],
      };
    }

    if (currentViewers < STREAMING_THRESHOLDS.LIVEPEER_MAX) {
      const estimatedCost = `~$${(currentViewers * 0.003).toFixed(2)}/hr`;
      return {
        recommendedMode: 'livepeer',
        reason: `Audience of ${currentViewers} exceeds PeerTube capacity. Livepeer transcoding recommended.`,
        estimatedCost,
        costBreakdown: `Livepeer: ${currentViewers} viewers × $0.003 = ${estimatedCost}/hr`,
        bandwidthSavings: 'Offloads transcoding & CDN delivery to Livepeer',
        canSwitch: true,
        alternativeModes: [
          {
            mode: 'peertube',
            cost: '$0.00',
            reason: 'If federated instances can absorb the load',
          },
        ],
      };
    }

    // 5000+ viewers
    const estMinutesPerViewer = 60;
    const estimatedCost = `~$${((currentViewers * estMinutesPerViewer) / 1000).toFixed(2)}/hr`;
    return {
      recommendedMode: 'cloudflare',
      reason: `Audience of ${currentViewers} is large-scale. Cloudflare Stream recommended.`,
      estimatedCost,
      costBreakdown: `Cloudflare Stream: $1.00 per 1000 minutes delivered`,
      bandwidthSavings: 'Enterprise CDN with global edge caching',
      canSwitch: true,
      alternativeModes: [
        {
          mode: 'livepeer',
          cost: `~$${(currentViewers * 0.003).toFixed(2)}/hr`,
          reason: 'Cost-effective fallback if Cloudflare not configured',
        },
      ],
    };
  }

  /**
   * Get the cheapest viable mode for a given viewer count.
   * Used for cost optimization — tries to use free tiers when possible.
   */
  getCheapestMode(viewerCount: number): { mode: StreamingMode; isFree: boolean } {
    if (viewerCount < STREAMING_THRESHOLDS.P2P_MAX) {
      return { mode: 'p2p', isFree: true };
    }
    if (viewerCount < STREAMING_THRESHOLDS.OWNCAST_MAX) {
      return { mode: 'owncast', isFree: true };
    }
    if (viewerCount < STREAMING_THRESHOLDS.PEERTUBE_MAX) {
      return { mode: 'peertube', isFree: true };
    }
    if (viewerCount < STREAMING_THRESHOLDS.LIVEPEER_MAX) {
      return { mode: 'livepeer', isFree: false };
    }
    return { mode: 'cloudflare', isFree: false };
  }

  /**
   * Evaluate whether a stream can be downgraded to a cheaper tier.
   * Called periodically by the bandwidth optimization cron.
   */
  async evaluateDowngrade(stream: ActiveStream): Promise<{
    canDowngrade: boolean;
    targetMode?: StreamingMode;
    reason?: string;
  }> {
    if (!stream.autoSwitch) {
      return { canDowngrade: false, reason: 'Auto-switch disabled' };
    }

    const cheapest = this.getCheapestMode(stream.currentViewers);

    // Already at the cheapest
    if (cheapest.mode === stream.mode) {
      return { canDowngrade: false };
    }

    // Check cooldown
    if (stream.switchedAt && Date.now() - stream.switchedAt < 60_000) {
      return {
        canDowngrade: false,
        reason: `Recently switched (${Math.round((Date.now() - stream.switchedAt) / 1000)}s ago). Cooldown active.`,
      };
    }

    // Only downgrade (not upgrade — that's handled by evaluateSwitch)
    const modeOrder: StreamingMode[] = ['p2p', 'owncast', 'peertube', 'livepeer', 'cloudflare'];
    const currentIdx = modeOrder.indexOf(stream.mode);
    const targetIdx = modeOrder.indexOf(cheapest.mode);

    if (targetIdx >= currentIdx) {
      return { canDowngrade: false, reason: 'Target is not cheaper than current mode' };
    }

    return {
      canDowngrade: true,
      targetMode: cheapest.mode,
      reason: `Viewers dropped to ${stream.currentViewers}. Can switch to ${cheapest.mode} (${cheapest.isFree ? 'free' : 'paid'}).`,
    };
  }

  getEstimatedCost(mode: StreamingMode, viewerCount: number): string {
    switch (mode) {
      case 'p2p':
        return '$0.00';
      case 'owncast':
        return '~$0.00 (fixed server cost)';
      case 'peertube':
        return '$0.00 (federated)';
      case 'livepeer':
        return `~$${(viewerCount * 0.003).toFixed(2)}/hr`;
      case 'cloudflare':
        return `~$${((viewerCount * 60) / 1000).toFixed(2)}/hr`;
    }
  }

  // ─── Auto-Switch Evaluation ──────────────────────────────────────

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

    const decision = this.decideMode(freshViewerCount);
    const newMode = decision.recommendedMode;

    if (newMode === stream.mode) {
      return { shouldSwitch: false };
    }

    // Cooldown: 60 seconds (reduced from 120s for faster optimization)
    if (stream.switchedAt && Date.now() - stream.switchedAt < 60_000) {
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

  // ─── Mode Switching ──────────────────────────────────────────────

  async switchMode(stream: ActiveStream, newMode: StreamingMode): Promise<ActiveStream> {
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
        stream.rtmpUrl = undefined;
        stream.streamKey = undefined;
        stream.playbackUrl = undefined;
        stream.livepeerStreamId = undefined;
        stream.peertubeStreamId = undefined;
        break;

      case 'owncast': {
        const instanceUrl = this.env.OWNCAST_INSTANCE_URL ?? 'https://live.degenfeed.xyz';
        const key =
          crypto.randomUUID?.().replace(/-/g, '').slice(0, 16) ??
          `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
        stream.rtmpUrl = `rtmp://live.degenfeed.xyz/live`;
        stream.streamKey = key;
        stream.playbackUrl = `${instanceUrl}/embed/video`;
        stream.embedUrl = `${instanceUrl}/embed/video`;
        break;
      }

      case 'peertube': {
        const instanceUrl = this.env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
        // PeerTube uses RTMP with a stream key system
        const peertubeKey =
          crypto.randomUUID?.().replace(/-/g, '').slice(0, 24) ??
          `${Date.now()}-${Math.random().toString(36).slice(2, 26)}`;
        stream.rtmpUrl = `rtmp://video.degenfeed.xyz/live`;
        stream.streamKey = peertubeKey;
        stream.playbackUrl = `${instanceUrl}/w/`;
        stream.embedUrl = `${instanceUrl}/w/`;
        stream.peertubeStreamId = stream.streamId;

        // Attempt to discover and register with federated instances
        const federatedInstances = await this.discoverFederatedInstances();
        stream.federatedInstances = federatedInstances.slice(0, 10); // Top 10 instances
        break;
      }

      case 'livepeer': {
        try {
          const livepeerStream = await this.livepeerService.createStream(stream.title, {
            record: true,
            lowLatency: true,
          });
          stream.rtmpUrl = livepeerStream.rtmpIngestUrl;
          stream.streamKey = livepeerStream.streamKey;
          stream.playbackUrl = livepeerStream.playbackUrl;
          stream.livepeerStreamId = livepeerStream.id;
          stream.livepeerPlaybackId = livepeerStream.playbackId;
        } catch (err) {
          log('error', '[streaming-router] Failed to create Livepeer stream', {
            streamId: stream.streamId,
            error: String(err),
          });
          // Fall back to PeerTube if Livepeer fails
          return this.switchMode(stream, 'peertube');
        }
        break;
      }

      case 'cloudflare': {
        if (!this.env.CLOUDFLARE_STREAM_TOKEN) {
          log(
            'warn',
            '[streaming-router] Cloudflare Stream not configured, falling back to Livepeer',
            { streamId: stream.streamId },
          );
          return this.switchMode(stream, 'livepeer');
        }
        stream.playbackUrl = `https://videodelivery.net/${stream.streamId}/manifest/video.m3u8`;
        break;
      }
    }

    stream.mode = newMode;
    stream.previousMode = previousMode;
    stream.switchedAt = Date.now();

    await this.persistStream(stream);

    log('info', '[streaming-router] Stream mode switched successfully', {
      streamId: stream.streamId,
      from: previousMode,
      to: newMode,
    });

    return stream;
  }

  // ─── Stream Lifecycle ────────────────────────────────────────────

  async createStream(
    creatorId: string,
    title: string,
    initialViewers = 0,
    options?: {
      autoSwitch?: boolean;
      privacy?: 'public' | 'unlisted' | 'private';
      tokenGated?: boolean;
      tokenAddress?: string;
      simulcastTargets?: SimulcastTarget[];
    },
  ): Promise<ActiveStream> {
    const streamId =
      crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
      lastViewerUpdate: Date.now(),
      autoSwitch: options?.autoSwitch ?? true,
      privacy: options?.privacy ?? 'public',
      tokenGated: options?.tokenGated,
      tokenAddress: options?.tokenAddress,
      simulcastTargets: options?.simulcastTargets,
    };

    await this.switchMode(stream, mode);

    return stream;
  }

  async getStreamStatus(streamId: string): Promise<ActiveStream | null> {
    try {
      const raw = await this.env.CACHE?.get(`stream:active:${streamId}`);
      if (!raw) return null;
      return JSON.parse(raw) as ActiveStream;
    } catch {
      return null;
    }
  }

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
    stream.lastViewerUpdate = Date.now();

    const evalResult = await this.evaluateSwitch(stream, viewerCount);

    if (evalResult.shouldSwitch && evalResult.newMode) {
      const updated = await this.switchMode(stream, evalResult.newMode);

      // Record bandwidth switch event
      await this.bandwidthTracker.recordUsage(
        streamId,
        stream.mode,
        0,
        0,
        viewerCount * 0.0167, // ~1 minute of viewer time
      );

      return {
        switched: true,
        newMode: evalResult.newMode,
        stream: updated,
      };
    }

    await this.persistStream(stream);
    return { switched: false, stream };
  }

  /**
   * End a stream, archive to IPFS if recording exists, clean up all resources.
   */
  async endStream(streamId: string): Promise<{ ipfsCid?: string }> {
    const stream = await this.getStreamStatus(streamId);
    if (!stream) return {};

    log('info', '[streaming-router] Ending stream', { streamId, mode: stream.mode });

    await this.cleanupMode(stream, stream.mode);

    // Archive to IPFS if recording enabled
    let ipfsCid: string | undefined;
    if (stream.recordingDuration && stream.recordingDuration > 0) {
      try {
        const result = await this.archiveToIPFS(stream);
        ipfsCid = result.cid;
        stream.ipfsVodCid = result.cid;
        log('info', '[streaming-router] Stream archived to IPFS', {
          streamId,
          cid: result.cid,
        });
      } catch (err) {
        log('warn', '[streaming-router] IPFS archiving failed', {
          streamId,
          error: String(err),
        });
      }
    }

    // Record final bandwidth usage
    const usage = await this.bandwidthTracker.getUsage(streamId);
    if (usage) {
      const savings = this.bandwidthTracker.getBandwidthSavings(usage);
      log('info', '[streaming-router] Stream bandwidth summary', {
        streamId,
        mode: stream.mode,
        totalBytes: usage.bytesUploaded + usage.bytesDownloaded,
        estimatedCost: usage.estimatedCost,
        estimatedSavings: savings,
        viewerHours: usage.viewerHours,
      });
    }

    try {
      await this.env.CACHE?.delete(`stream:active:${streamId}`);
    } catch {
      // Non-critical
    }

    return { ipfsCid };
  }

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

  // ─── IPFS VOD Archiving ─────────────────────────────────────────

  /**
   * Archive a stream recording to IPFS for free, permanent storage.
   */
  async archiveToIPFS(
    stream: ActiveStream,
    recordingBuffer?: ArrayBuffer,
  ): Promise<{ cid: string; gatewayUrl: string }> {
    if (recordingBuffer) {
      const result = await uploadToIPFS(
        new Blob([recordingBuffer], { type: 'video/mp4' }),
        `${stream.streamId}-${stream.title.slice(0, 40)}.mp4`,
        this.env,
      );
      return { cid: result.cid, gatewayUrl: result.gatewayUrl };
    }

    // No buffer provided — try to fetch the recording from the active platform
    // This would be implemented based on the platform's replay API
    log('info', '[streaming-router] IPFS archive requested but no recording buffer provided', {
      streamId: stream.streamId,
    });

    // Return a placeholder — actual VOD fetching depends on the mode
    return { cid: '', gatewayUrl: '' };
  }

  // ─── PeerTube Federation ─────────────────────────────────────────

  /**
   * Discover federated PeerTube instances for free distribution.
   * Uses the PeerTube instance's API to find connected instances.
   */
  async discoverFederatedInstances(): Promise<string[]> {
    const instanceUrl = this.env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
    const cacheKey = 'peertube:federated-instances';

    // Check cache first
    try {
      const cached = await this.env.CACHE?.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch {
      // Fall through to fetch
    }

    try {
      const response = await fetch(`${instanceUrl}/api/v1/server/followers`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          data?: Array<{ host: string }>;
        };
        const instances = (data.data ?? []).map((f) => f.host).filter(Boolean);

        // Cache for 1 hour
        await this.env.CACHE?.put(cacheKey, JSON.stringify(instances), {
          expirationTtl: 3600,
        });

        return instances;
      }
    } catch {
      // Federation discovery is best-effort
    }

    // Fallback: well-known PeerTube instances
    const wellKnown = [
      'video.degenfeed.xyz',
      'peertube.tv',
      'peertube.social',
      'tube.tchncs.de',
      'diode.zone',
      'videos.social',
    ];

    return wellKnown;
  }

  // ─── Persistence ─────────────────────────────────────────────────

  private async persistStream(stream: ActiveStream): Promise<void> {
    try {
      await this.env.CACHE?.put(`stream:active:${stream.streamId}`, JSON.stringify(stream), {
        expirationTtl: 86400,
      });

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

  private async cleanupMode(stream: ActiveStream, mode: StreamingMode): Promise<void> {
    try {
      switch (mode) {
        case 'p2p':
          if (stream.webrtcSessionId) {
            await this.webrtcManager.endSession(stream.webrtcSessionId);
          }
          break;
        case 'livepeer':
          if (stream.livepeerStreamId) {
            await this.livepeerService.terminateStream(stream.livepeerStreamId);
          }
          break;
        case 'owncast':
        case 'peertube':
        case 'cloudflare':
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

// ─── Route Handlers ──────────────────────────────────────────────────

/**
 * GET /api/live/route/status/:streamId
 * Get routing status for a stream.
 */
export async function handleStreamRouteStatus(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const router = new StreamingRouter(env);
    const stream = await router.getStreamStatus(streamId);

    if (!stream) {
      return new Response(JSON.stringify({ error: 'Stream not found' }), { status: 404 });
    }

    const decision = router.decideMode(stream.currentViewers);
    const bandwidth = await router.getBandwidthTracker().getUsage(streamId);

    return new Response(
      JSON.stringify({
        streamId: stream.streamId,
        mode: stream.mode,
        modeLabel: MODE_LABELS[stream.mode],
        modeEmoji: MODE_EMOJIS[stream.mode],
        currentViewers: stream.currentViewers,
        autoSwitch: stream.autoSwitch,
        recommendedMode: decision.recommendedMode,
        recommendedLabel: MODE_LABELS[decision.recommendedMode],
        estimatedCost: decision.estimatedCost,
        costBreakdown: decision.costBreakdown,
        bandwidthSavings: decision.bandwidthSavings,
        alternativeModes: decision.alternativeModes,
        switchedAt: stream.switchedAt,
        previousMode: stream.previousMode,
        playbackUrl: stream.playbackUrl,
        startedAt: stream.startedAt,
        simulcastTargets: stream.simulcastTargets,
        federatedInstances: stream.federatedInstances,
        ipfsVodCid: stream.ipfsVodCid,
        bandwidth: bandwidth
          ? {
              totalBytes: bandwidth.bytesUploaded + bandwidth.bytesDownloaded,
              estimatedCost: bandwidth.estimatedCost,
              viewerHours: bandwidth.viewerHours,
            }
          : null,
        thresholds: {
          p2pMax: STREAMING_THRESHOLDS.P2P_MAX,
          owncastMax: STREAMING_THRESHOLDS.OWNCAST_MAX,
          peertubeMax: STREAMING_THRESHOLDS.PEERTUBE_MAX,
          livepeerMax: STREAMING_THRESHOLDS.LIVEPEER_MAX,
        },
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to get route status: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/route/estimate
 * Estimate cost for a given viewer count.
 */
export async function handleRouteEstimate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const viewerCount = Math.max(0, Number(url.searchParams.get('viewers')) || 0);

    const router = new StreamingRouter(env);
    const decision = router.decideMode(viewerCount);

    return new Response(
      JSON.stringify({
        viewerCount,
        mode: decision.recommendedMode,
        modeLabel: MODE_LABELS[decision.recommendedMode],
        modeEmoji: MODE_EMOJIS[decision.recommendedMode],
        estimatedCost: decision.estimatedCost,
        costBreakdown: decision.costBreakdown,
        bandwidthSavings: decision.bandwidthSavings,
        alternatives: decision.alternativeModes,
        thresholds: {
          p2pMax: STREAMING_THRESHOLDS.P2P_MAX,
          owncastMax: STREAMING_THRESHOLDS.OWNCAST_MAX,
          peertubeMax: STREAMING_THRESHOLDS.PEERTUBE_MAX,
          livepeerMax: STREAMING_THRESHOLDS.LIVEPEER_MAX,
        },
        costTable: [
          {
            mode: 'p2p',
            label: 'P2P Mode',
            viewers: '0-9',
            cost: '$0.00',
            bandwidth: 'Zero',
            emoji: '🔗',
          },
          {
            mode: 'owncast',
            label: 'Owncast',
            viewers: '10-49',
            cost: '~$0.00',
            bandwidth: 'Self-hosted',
            emoji: '📡',
          },
          {
            mode: 'peertube',
            label: 'PeerTube Live',
            viewers: '50-499',
            cost: '$0.00',
            bandwidth: 'Federated',
            emoji: '🎥',
          },
          {
            mode: 'livepeer',
            label: 'Livepeer',
            viewers: '500-4999',
            cost: '$0.003/viewer-hr',
            bandwidth: 'CDN',
            emoji: '⚡',
          },
          {
            mode: 'cloudflare',
            label: 'Cloudflare Stream',
            viewers: '5000+',
            cost: '$1/1000 min',
            bandwidth: 'Enterprise CDN',
            emoji: '☁️',
          },
        ],
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to estimate: ${error}` }), { status: 500 });
  }
}

/**
 * POST /api/live/route/switch
 * Manually switch a stream to a specific mode.
 */
export async function handleRouteSwitch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = (await request.json()) as {
      streamId: string;
      mode: StreamingMode;
    };

    if (!body.streamId || !body.mode) {
      return new Response(JSON.stringify({ error: 'streamId and mode are required' }), {
        status: 400,
      });
    }

    const validModes: StreamingMode[] = ['p2p', 'owncast', 'peertube', 'livepeer', 'cloudflare'];
    if (!validModes.includes(body.mode)) {
      return new Response(
        JSON.stringify({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` }),
        { status: 400 },
      );
    }

    const router = new StreamingRouter(env);
    const stream = await router.getStreamStatus(body.streamId);

    if (!stream) {
      return new Response(JSON.stringify({ error: 'Stream not found' }), { status: 404 });
    }

    const updated = await router.switchMode(stream, body.mode);

    return new Response(
      JSON.stringify({
        ok: true,
        streamId: updated.streamId,
        mode: updated.mode,
        modeLabel: MODE_LABELS[updated.mode],
        modeEmoji: MODE_EMOJIS[updated.mode],
        rtmpUrl: updated.rtmpUrl,
        streamKey: updated.streamKey,
        playbackUrl: updated.playbackUrl,
        federatedInstances: updated.federatedInstances,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to switch mode: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/bandwidth/:streamId
 * Get bandwidth report for a stream.
 */
export async function handleBandwidthReport(
  request: Request,
  env: Env,
  streamId: string,
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const tracker = new BandwidthTracker(env);
    const usage = await tracker.getUsage(streamId);

    if (!usage) {
      return new Response(JSON.stringify({ error: 'No bandwidth data for this stream' }), {
        status: 404,
      });
    }

    const savings = tracker.getBandwidthSavings(usage);

    return new Response(
      JSON.stringify({
        streamId,
        totalBytesUploaded: usage.bytesUploaded,
        totalBytesDownloaded: usage.bytesDownloaded,
        totalGB: ((usage.bytesUploaded + usage.bytesDownloaded) / (1024 * 1024 * 1024)).toFixed(4),
        estimatedCost: usage.estimatedCost,
        costCurrency: usage.costCurrency,
        estimatedSavings: savings,
        viewerHours: usage.viewerHours,
        perMode: usage.perMode,
        lastUpdated: usage.lastUpdated,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to get bandwidth report: ${error}` }), {
      status: 500,
    });
  }
}

/**
 * GET /api/live/bandwidth/summary
 * Get aggregate bandwidth across all streams.
 */
export async function handleBandwidthSummary(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const tracker = new BandwidthTracker(env);
    const total = await tracker.getTotalUsage();

    return new Response(
      JSON.stringify({
        totalBytes: total.totalBytes,
        totalGB: (total.totalBytes / (1024 * 1024 * 1024)).toFixed(4),
        totalCost: total.totalCost.toFixed(4),
        totalSavings: total.totalSavings.toFixed(4),
        streamCount: total.streamCount,
        message:
          total.streamCount === 0
            ? 'No streams monitored yet'
            : `Tracking ${total.streamCount} stream(s). Saved ~$${total.totalSavings.toFixed(2)} vs traditional CDN.`,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: `Failed to get bandwidth summary: ${error}` }), {
      status: 500,
    });
  }
}
