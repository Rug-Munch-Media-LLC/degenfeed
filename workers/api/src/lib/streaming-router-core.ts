/**
 * @degenfeed/api-worker — Streaming Router
 *
 * Intelligent routing engine that selects the optimal streaming backend
 * based on real-time viewer count thresholds.
 */

import type { Env } from '../types';
import { uploadToIPFS } from './ipfs-storage';
import { LivepeerService } from './livepeer-service';
import { BandwidthTracker } from './streaming-router-bandwidth';
import type { ActiveStream, StreamingMode, StreamRouteDecision } from './streaming-router-types';
import { STREAMING_THRESHOLDS } from './streaming-router-types';

const KV_STREAM_PREFIX = 'stream:';
const KV_ACTIVE_INDEX = 'stream:active';

export class StreamingRouter {
  private env: Env;
  bandwidth: BandwidthTracker;

  constructor(env: Env) {
    this.env = env;
    this.bandwidth = new BandwidthTracker(env);
  }

  // ─── Routing Decision ────────────────────────────────

  evaluateRouting(currentViewers: number, prevMode?: StreamingMode): StreamRouteDecision {
    const thresholds = STREAMING_THRESHOLDS;
    let recommendedMode: StreamingMode;
    const reasons: string[] = [];

    if (currentViewers < thresholds.P2P_MAX) {
      recommendedMode = 'p2p';
      reasons.push('Under 10 viewers — use P2P (FREE)');
    } else if (currentViewers < thresholds.OWNCAST_MAX) {
      recommendedMode = 'owncast';
      reasons.push('10-50 viewers — use Owncast');
    } else if (currentViewers < thresholds.PEERTUBE_MAX) {
      recommendedMode = 'peertube';
      reasons.push('50-500 viewers — use PeerTube');
    } else if (currentViewers < thresholds.CLOUDFLARE_MIN) {
      recommendedMode = 'livepeer';
      reasons.push('500-5000 viewers — use Livepeer');
    } else {
      recommendedMode = 'cloudflare';
      reasons.push('5000+ viewers — use Cloudflare Stream');
    }

    const currentMode = prevMode ?? recommendedMode;
    const modeOrder: StreamingMode[] = ['p2p', 'owncast', 'peertube', 'livepeer', 'cloudflare'];
    const currentIdx = modeOrder.indexOf(currentMode);
    const recommendedIdx = modeOrder.indexOf(recommendedMode);

    return {
      recommendedMode,
      reasons,
      estimatedCost: currentViewers < 500 ? '$0' : `~$${(currentViewers * 0.003).toFixed(2)}/hr`,
      estimatedCostPerHour: currentViewers < 500 ? 0 : currentViewers * 0.003,
      canUpgrade: recommendedIdx > currentIdx,
      canDowngrade: recommendedIdx < currentIdx,
      viewerThresholds: {
        current: currentViewers,
        next: recommendedIdx < modeOrder.length - 1 ? thresholds.PEERTUBE_MAX : Infinity,
        previous: recommendedIdx > 0 ? thresholds.OWNCAST_MAX : 0,
      },
    };
  }

  async evaluateDowngrade(
    stream: ActiveStream,
  ): Promise<{ shouldDowngrade: boolean; targetMode: StreamingMode; reason: string }> {
    const decision = this.evaluateRouting(stream.currentViewers, stream.mode);
    if (decision.canDowngrade) {
      return {
        shouldDowngrade: true,
        targetMode: decision.recommendedMode,
        reason: `Auto-downgrade from ${stream.mode} to ${decision.recommendedMode} (${stream.currentViewers} viewers)`,
      };
    }
    return { shouldDowngrade: false, targetMode: stream.mode, reason: 'No downgrade needed' };
  }

  async evaluateSwitch(
    stream: ActiveStream,
    targetMode: StreamingMode,
  ): Promise<{ shouldSwitch: boolean; reason: string }> {
    if (stream.mode === targetMode)
      return { shouldSwitch: false, reason: 'Already on target mode' };
    const decision = this.evaluateRouting(stream.currentViewers);
    const modeOrder: StreamingMode[] = ['p2p', 'owncast', 'peertube', 'livepeer', 'cloudflare'];
    const targetIdx = modeOrder.indexOf(targetMode);
    const currentIdx = modeOrder.indexOf(stream.mode);

    if (targetIdx > currentIdx && !decision.canUpgrade) {
      return {
        shouldSwitch: false,
        reason: `Cannot upgrade: viewer count too low for ${targetMode}`,
      };
    }
    if (targetIdx < currentIdx && !decision.canDowngrade) {
      return { shouldSwitch: false, reason: `Not enough viewers to justify ${targetMode}` };
    }

    return { shouldSwitch: true, reason: `Switching from ${stream.mode} to ${targetMode}` };
  }

  // ─── Mode Switching ──────────────────────────────────

  async switchMode(stream: ActiveStream, newMode: StreamingMode): Promise<ActiveStream> {
    const env = this.env;
    await this.cleanupMode(stream, stream.mode);
    stream.previousMode = stream.mode;
    stream.mode = newMode;
    stream.switchedAt = Date.now();

    switch (newMode) {
      case 'p2p': {
        // WebRTC requires the broadcaster's SDP offer, which only exists
        // once they go live in the studio. Session creation happens there;
        // URLs point at the live page where the handshake completes.
        stream.webrtcSessionId = undefined;
        stream.rtmpUrl = '';
        stream.streamKey = '';
        stream.playbackUrl = `https://degenfeed.xyz/live/${stream.streamId}`;
        stream.embedUrl = `https://degenfeed.xyz/live/${stream.streamId}/embed`;
        break;
      }
      case 'owncast': {
        const instanceUrl = env.OWNCAST_INSTANCE_URL ?? 'https://owncast.degenfeed.xyz';
        stream.rtmpUrl = `rtmp://owncast.degenfeed.xyz/live`;
        stream.streamKey = crypto.randomUUID()?.replace(/-/g, '').slice(0, 16) ?? '';
        stream.playbackUrl = `${instanceUrl}/embed/video`;
        stream.embedUrl = `${instanceUrl}/embed/video`;
        break;
      }
      case 'peertube': {
        const instanceUrl = env.PEERTUBE_INSTANCE_URL ?? 'https://video.degenfeed.xyz';
        stream.rtmpUrl = `rtmp://live.degenfeed.xyz/live`;
        stream.streamKey = crypto.randomUUID()?.replace(/-/g, '').slice(0, 16) ?? '';
        stream.playbackUrl = `${instanceUrl}/w/${stream.streamKey}`;
        stream.embedUrl = `${instanceUrl}/videos/embed/${stream.streamKey}`;
        break;
      }
      case 'livepeer': {
        const livepeer = new LivepeerService(env);
        const lpStream = await livepeer.createStream(stream.title);
        stream.livepeerStreamId = lpStream.id;
        stream.livepeerPlaybackId = lpStream.playbackId;
        stream.rtmpUrl = lpStream.rtmpIngestUrl;
        stream.streamKey = lpStream.streamKey;
        stream.playbackUrl = `https://lp-playback.com/hls/${lpStream.playbackId}`;
        stream.embedUrl = `https://lp-playback.com/embed/${lpStream.playbackId}`;
        break;
      }
      case 'cloudflare': {
        stream.rtmpUrl = 'rtmp://live.cloudflare.com/live';
        stream.streamKey = crypto.randomUUID() ?? '';
        stream.playbackUrl = `https://cloudflarestream.com/${stream.streamKey}/manifest/video.m3u8`;
        stream.embedUrl = `https://cloudflarestream.com/${stream.streamKey}/embed`;
        break;
      }
    }

    await this.persistStream(stream);
    return stream;
  }

  // ─── Stream Lifecycle ────────────────────────────────

  async createStream(config: {
    creatorId: string;
    title: string;
    currentViewers?: number;
    privacy?: ActiveStream['privacy'];
    autoSwitch?: boolean;
  }): Promise<ActiveStream> {
    const streamId = crypto.randomUUID();
    const decision = this.evaluateRouting(config.currentViewers ?? 0);
    const mode = decision.recommendedMode;

    const stream: ActiveStream = {
      streamId,
      creatorId: config.creatorId,
      title: config.title,
      mode,
      currentViewers: config.currentViewers ?? 0,
      startedAt: Date.now(),
      lastViewerCount: config.currentViewers ?? 0,
      lastViewerUpdate: Date.now(),
      autoSwitch: config.autoSwitch ?? true,
      privacy: config.privacy ?? 'public',
    };

    return this.switchMode(stream, mode);
  }

  async getStreamStatus(streamId: string): Promise<ActiveStream | null> {
    if (!this.env.CACHE) return null;
    try {
      const raw = await this.env.CACHE.get(`${KV_STREAM_PREFIX}${streamId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async updateViewerCount(streamId: string, count: number): Promise<ActiveStream | null> {
    const stream = await this.getStreamStatus(streamId);
    if (!stream) return null;
    stream.currentViewers = count;
    stream.lastViewerCount = count;
    stream.lastViewerUpdate = Date.now();
    await this.persistStream(stream);

    if (stream.autoSwitch) {
      const decision = this.evaluateRouting(count, stream.mode);
      if (decision.canUpgrade || decision.canDowngrade) {
        return this.switchMode(stream, decision.recommendedMode);
      }
    }

    return stream;
  }

  async endStream(streamId: string): Promise<{ ipfsCid?: string }> {
    const stream = await this.getStreamStatus(streamId);
    if (!stream) return {};
    await this.cleanupMode(stream, stream.mode);

    let ipfsCid: string | undefined;
    try {
      const { cid } = await this.archiveToIPFS(stream);
      ipfsCid = cid;
    } catch {
      /* IPFS archival failed */
    }

    await this.env.CACHE?.delete(`${KV_STREAM_PREFIX}${streamId}`);
    // Remove from active index
    const raw = await this.env.CACHE?.get(KV_ACTIVE_INDEX);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const idx = ids.indexOf(streamId);
      if (idx >= 0) {
        ids.splice(idx, 1);
        await this.env.CACHE?.put(KV_ACTIVE_INDEX, JSON.stringify(ids), { expirationTtl: 86400 });
      }
    }

    return { ipfsCid };
  }

  async listActiveStreams(): Promise<ActiveStream[]> {
    if (!this.env.CACHE) return [];
    const raw = await this.env.CACHE.get(KV_ACTIVE_INDEX);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);
    const streams: ActiveStream[] = [];
    for (const id of ids) {
      const s = await this.getStreamStatus(id);
      if (s) streams.push(s);
    }
    return streams;
  }

  // ─── IPFS VOD Archiving ──────────────────────────────

  async archiveToIPFS(stream: ActiveStream): Promise<{ cid: string }> {
    const manifest = {
      streamId: stream.streamId,
      creatorId: stream.creatorId,
      title: stream.title,
      mode: stream.mode,
      startedAt: stream.startedAt,
      endedAt: Date.now(),
      playbackUrl: stream.playbackUrl,
    };
    const manifestBlob = new Blob([JSON.stringify(manifest)], {
      type: 'application/json',
    });
    const result = await uploadToIPFS(
      manifestBlob,
      `stream-manifest-${stream.streamId}.json`,
      this.env,
    );
    const cid = result.cid;
    if (stream) stream.ipfsVodCid = cid;
    return { cid };
  }

  // ─── Persistence ─────────────────────────────────────

  private async persistStream(stream: ActiveStream): Promise<void> {
    if (!this.env.CACHE) return;
    await this.env.CACHE.put(`${KV_STREAM_PREFIX}${stream.streamId}`, JSON.stringify(stream), {
      expirationTtl: 86400 * 7,
    });
    // Ensure in active index
    const raw = await this.env.CACHE.get(KV_ACTIVE_INDEX);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(stream.streamId)) {
      ids.push(stream.streamId);
      await this.env.CACHE.put(KV_ACTIVE_INDEX, JSON.stringify(ids), { expirationTtl: 86400 });
    }
  }

  private async cleanupMode(stream: ActiveStream, mode: StreamingMode): Promise<void> {
    try {
      switch (mode) {
        case 'livepeer':
          if (stream.livepeerStreamId) {
            // Livepeer cleanup via API
          }
          break;
        case 'peertube':
          if (stream.peertubeVideoUuid) {
            // PeerTube stream cleanup
          }
          break;
        case 'p2p':
          // WebRTC sessions expire naturally
          break;
      }
    } catch {
      /* cleanup non-critical */
    }
  }
}
