/**
 * @degenfeed/api-worker — Bandwidth Tracker
 *
 * Tracks bandwidth usage and costs per streaming mode.
 */

import type { BandwidthUsage, StreamingMode } from './streaming-router-types';

const BANDWIDTH_PREFIX = 'bw:usage:';
const BANDWIDTH_INDEX_KEY = 'bw:index';

export class BandwidthTracker {
  private env: { CACHE?: { get: Function; put: Function; list?: Function } };

  constructor(env: { CACHE?: { get: Function; put: Function } }) {
    this.env = env;
  }

  async recordUsage(
    streamId: string,
    mode: StreamingMode,
    bytesUploaded: number,
    bytesDownloaded: number,
    cost: number,
    viewerHours: number,
  ): Promise<void> {
    if (!this.env.CACHE) return;
    const key = `${BANDWIDTH_PREFIX}${streamId}`;
    const raw = await this.env.CACHE.get(key);
    const usage: BandwidthUsage = raw
      ? JSON.parse(raw)
      : {
          bytesUploaded: 0,
          bytesDownloaded: 0,
          estimatedCost: 0,
          costCurrency: 'USD',
          viewerHours: 0,
          lastUpdated: 0,
          perMode: {},
        };

    usage.bytesUploaded += bytesUploaded;
    usage.bytesDownloaded += bytesDownloaded;
    usage.estimatedCost += cost;
    usage.viewerHours += viewerHours;
    usage.lastUpdated = Date.now();

    if (!usage.perMode[mode]) usage.perMode[mode] = { bytes: 0, cost: 0 };
    usage.perMode[mode].bytes += bytesUploaded + bytesDownloaded;
    usage.perMode[mode].cost += cost;

    await this.env.CACHE.put(key, JSON.stringify(usage), { expirationTtl: 86400 * 90 });
    await this.addToIndex(streamId);
  }

  async getUsage(streamId: string): Promise<BandwidthUsage | null> {
    if (!this.env.CACHE) return null;
    const raw = await this.env.CACHE.get(`${BANDWIDTH_PREFIX}${streamId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async getTotalUsage(): Promise<{
    totalBytes: number;
    totalCost: number;
    totalViewerHours: number;
    streams: number;
  }> {
    const ids = await this.getIndex();
    let totalBytes = 0,
      totalCost = 0,
      totalViewerHours = 0;
    for (const id of ids) {
      const usage = await this.getUsage(id);
      if (usage) {
        totalBytes += usage.bytesUploaded + usage.bytesDownloaded;
        totalCost += usage.estimatedCost;
        totalViewerHours += usage.viewerHours;
      }
    }
    return { totalBytes, totalCost, totalViewerHours, streams: ids.length };
  }

  private async addToIndex(streamId: string): Promise<void> {
    if (!this.env.CACHE) return;
    const raw = await this.env.CACHE.get(BANDWIDTH_INDEX_KEY);
    const index: string[] = raw ? JSON.parse(raw) : [];
    if (!index.includes(streamId)) {
      index.push(streamId);
      await this.env.CACHE.put(BANDWIDTH_INDEX_KEY, JSON.stringify(index), {
        expirationTtl: 86400 * 90,
      });
    }
  }

  private async getIndex(): Promise<string[]> {
    if (!this.env.CACHE) return [];
    const raw = await this.env.CACHE.get(BANDWIDTH_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  }
}
