/**
 * Creator Coin — Live Stream Integration
 *
 * When a creator goes live (PeerTube, Owncast), their coin gets
 * a temporary boost discount. This module manages the live status
 * oracle and the boost calculation.
 */

import type { LiveStreamInfo } from './types';

// ─── Constants ─────────────────────────────────────────────────────────────

const LIVE_BOOST_BPS = 200; // 2% discount when live
const AUTO_EXPIRE_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Supported Platforms ───────────────────────────────────────────────────

export interface StreamPlatform {
  id: string;
  name: string;
  icon: string;
  checkInterval: number; // ms between status checks
}

export const SUPPORTED_PLATFORMS: StreamPlatform[] = [
  { id: 'peertube', name: 'PeerTube', icon: '/platforms/peertube.svg', checkInterval: 30_000 },
  { id: 'owncast', name: 'Owncast', icon: '/platforms/owncast.svg', checkInterval: 30_000 },
  { id: 'twitch', name: 'Twitch', icon: '/platforms/twitch.svg', checkInterval: 60_000 },
  { id: 'youtube', name: 'YouTube', icon: '/platforms/youtube.svg', checkInterval: 60_000 },
];

// ─── Live Stream Monitor ───────────────────────────────────────────────────

export class LiveStreamMonitor {
  private statusCache = new Map<string, LiveStreamInfo>();
  private checkIntervals = new Map<string, ReturnType<typeof setInterval>>();

  /**
   * Start monitoring a creator's live status.
   * @param creatorId Creator identifier
   * @param platform Stream platform
   * @param streamUrl URL to check
   * @param onStatusChange Callback when live status changes
   */
  startMonitoring(
    creatorId: string,
    platform: string,
    streamUrl: string,
    onStatusChange: (info: LiveStreamInfo) => void,
  ): void {
    const key = `${platform}:${creatorId}`;

    // Don't start duplicate monitors
    if (this.checkIntervals.has(key)) return;

    const checkFn = async () => {
      try {
        const info = await this.checkLiveStatus(platform, streamUrl);
        const cached = this.statusCache.get(key);

        // Only fire callback on status change
        if (cached?.isLive !== info.isLive) {
          this.statusCache.set(key, info);
          onStatusChange(info);
        }
      } catch (err) {
        console.warn(`[live-stream] Failed to check status for ${key}:`, err);
      }
    };

    // Initial check
    checkFn();

    // Interval checks
    const platformCfg = SUPPORTED_PLATFORMS.find(p => p.id === platform);
    const interval = setInterval(checkFn, platformCfg?.checkInterval ?? 60_000);
    this.checkIntervals.set(key, interval);
  }

  /**
   * Stop monitoring a creator.
   */
  stopMonitoring(creatorId: string, platform: string): void {
    const key = `${platform}:${creatorId}`;
    const interval = this.checkIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(key);
    }
    this.statusCache.delete(key);
  }

  /**
   * Get cached live status.
   */
  getLiveStatus(creatorId: string, platform: string): LiveStreamInfo | null {
    return this.statusCache.get(`${platform}:${creatorId}`) ?? null;
  }

  /**
   * Check if a creator is currently live on their platform.
   */
  private async checkLiveStatus(
    platform: string,
    streamUrl: string,
  ): Promise<LiveStreamInfo> {
    switch (platform) {
      case 'peertube':
        return this.checkPeerTube(streamUrl);
      case 'owncast':
        return this.checkOwncast(streamUrl);
      case 'twitch':
        return this.checkTwitch(streamUrl);
      case 'youtube':
        return this.checkYouTube(streamUrl);
      default:
        return {
          isLive: false,
          platform,
          streamUrl,
          title: '',
          boostDiscountBps: 0,
        };
    }
  }

  /**
   * Check PeerTube instance for live status.
   * PeerTube API: /api/v1/video-channels/{channel}/videos?isLive=true
   */
  private async checkPeerTube(instanceUrl: string): Promise<LiveStreamInfo> {
    try {
      // Normalize URL
      const base = instanceUrl.replace(/\/+$/, '');
      const apiUrl = `${base}/api/v1/videos?isLive=true&sort=-publishedAt&count=1`;

      const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!res.ok) return { isLive: false, platform: 'peertube', streamUrl: instanceUrl, title: '', boostDiscountBps: 0 };

      const data = await res.json() as any;
      const liveVideos = data?.data ?? [];

      if (liveVideos.length > 0) {
        const video = liveVideos[0];
        return {
          isLive: true,
          platform: 'peertube',
          streamUrl: `${base}/w/${video.uuid}`,
          title: video.name ?? 'Untitled Stream',
          boostDiscountBps: LIVE_BOOST_BPS,
          startedAt: new Date(video.publishedAt).getTime(),
          viewerCount: video.viewers ?? 0,
        };
      }

      return { isLive: false, platform: 'peertube', streamUrl: instanceUrl, title: '', boostDiscountBps: 0 };
    } catch {
      return { isLive: false, platform: 'peertube', streamUrl: instanceUrl, title: '', boostDiscountBps: 0 };
    }
  }

  /**
   * Check Owncast instance for live status.
   * Owncast API: /api/status
   */
  private async checkOwncast(instanceUrl: string): Promise<LiveStreamInfo> {
    try {
      const base = instanceUrl.replace(/\/+$/, '');
      const res = await fetch(`${base}/api/status`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return { isLive: false, platform: 'owncast', streamUrl: instanceUrl, title: '', boostDiscountBps: 0 };

      const data = await res.json() as any;

      if (data?.online === true || data?.streamOnline === true) {
        return {
          isLive: true,
          platform: 'owncast',
          streamUrl: base,
          title: data?.name ?? data?.streamTitle ?? 'Live Stream',
          boostDiscountBps: LIVE_BOOST_BPS,
          startedAt: data?.startTime ? new Date(data.startTime).getTime() : undefined,
          viewerCount: data?.viewerCount ?? 0,
        };
      }

      return { isLive: false, platform: 'owncast', streamUrl: instanceUrl, title: '', boostDiscountBps: 0 };
    } catch {
      return { isLive: false, platform: 'owncast', streamUrl: instanceUrl, title: '', boostDiscountBps: 0 };
    }
  }

  /**
   * Check Twitch for live status (requires API key).
   */
  private async checkTwitch(_channelUrl: string): Promise<LiveStreamInfo> {
    // Requires Twitch API key — stub for now
    return { isLive: false, platform: 'twitch', streamUrl: _channelUrl, title: '', boostDiscountBps: 0 };
  }

  /**
   * Check YouTube for live status (requires API key).
   */
  private async checkYouTube(_channelUrl: string): Promise<LiveStreamInfo> {
    // Requires YouTube Data API key — stub for now
    return { isLive: false, platform: 'youtube', streamUrl: _channelUrl, title: '', boostDiscountBps: 0 };
  }

  /**
   * Clean up all monitors.
   */
  destroy(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    this.statusCache.clear();
  }
}

/**
 * Calculate the boosted price when a creator is live.
 */
export function applyLiveBoost(
  basePrice: bigint,
  boostBps: number = LIVE_BOOST_BPS,
): { boostedPrice: bigint; discountBps: number } {
  if (boostBps <= 0) return { boostedPrice: basePrice, discountBps: 0 };

  const discount = (basePrice * BigInt(boostBps)) / 10_000n;
  const boostedPrice = basePrice - discount;

  return {
    boostedPrice: boostedPrice < 0n ? 0n : boostedPrice,
    discountBps: boostBps,
  };
}

export { LIVE_BOOST_BPS };
