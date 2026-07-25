/**
 * @degenfeed/api-worker — Watch History & Progress Tracking
 *
 * Tracks user video consumption for "Continue watching" feature,
 * recommendation profiling, and watch analytics.
 *
 * Storage:
 *   - KV keys: `watch:{wallet}:{videoId}` → watch event JSON
 *   - Capped at 1000 entries per user (FIFO eviction)
 *   - Index key: `watch:index:{wallet}` → sorted list of recent videoIds
 *
 * Used by:
 *   - video-discovery.ts — "Continue watching" strategy, interest profiling
 *   - video-hub.ts — GET /api/video/history, POST /api/video/watch
 */

import type { Env } from '../index';

// ─── Types ──────────────────────────────────────────────────────────────

export interface WatchEvent {
  /** Video ID */
  videoId: string;
  /** Playback position in seconds */
  position: number;
  /** Total video duration in seconds */
  duration: number;
  /** Watch completion percentage (0-100) */
  progress: number;
  /** Whether the video was watched to completion */
  completed: boolean;
  /** Platform/source of the video */
  platform: string;
  /** Video title (denormalized for quick display) */
  title?: string;
  /** Creator/channel name */
  creatorName?: string;
  /** Creator avatar URL */
  creatorAvatar?: string;
  /** Video thumbnail URL */
  thumbnailUrl?: string;
  /** Video category */
  category?: string;
  /** Unix ms of last watch event */
  lastWatched: number;
  /** Number of times the user has watched/resumed this video */
  watchCount: number;
}

export interface WatchHistoryPage {
  events: WatchEvent[];
  total: number;
  cursor: string | null;
  hasMore: boolean;
}

export interface ContinueWatchingItem {
  videoId: string;
  title?: string;
  creatorName?: string;
  creatorAvatar?: string;
  thumbnailUrl?: string;
  platform: string;
  position: number;
  duration: number;
  progress: number;
  category?: string;
  lastWatched: number;
}

// ─── Constants ──────────────────────────────────────────────────────────

const MAX_WATCH_ENTRIES_PER_USER = 1000;
const WATCH_TTL_SECONDS = 86400 * 90; // 90 days
const WATCH_PREFIX = 'watch:';
const WATCH_INDEX_PREFIX = 'watch:index:';

// ─── Helpers ───────────────────────────────────────────────────────────

function watchKey(wallet: string, videoId: string): string {
  return `${WATCH_PREFIX}${wallet.toLowerCase()}:${videoId}`;
}

function watchIndexKey(wallet: string): string {
  return `${WATCH_INDEX_PREFIX}${wallet.toLowerCase()}`;
}

function sanitizeWallet(wallet: string): string {
  return wallet.toLowerCase().trim();
}

// ─── WatchHistoryStore ─────────────────────────────────────────────────

export class WatchHistoryStore {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Record a watch event for a video.
   * Creates or updates the watch entry with current position and progress.
   * Maintains a capped index list (FIFO, 1000 max).
   */
  async recordWatch(
    wallet: string,
    event: Omit<WatchEvent, 'lastWatched' | 'watchCount'>,
  ): Promise<void> {
    const walletLower = sanitizeWallet(wallet);
    const key = watchKey(walletLower, event.videoId);
    const indexKey = watchIndexKey(walletLower);

    // Get existing record to increment watch count
    const existing = await this.getWatchEvent(wallet, event.videoId);

    const now = Date.now();
    const watchEvent: WatchEvent = {
      ...event,
      lastWatched: now,
      watchCount: (existing?.watchCount ?? 0) + 1,
    };

    // Store watch event with TTL
    await this.env.CACHE?.put(key, JSON.stringify(watchEvent), {
      expirationTtl: WATCH_TTL_SECONDS,
    });

    // Update the index: prepend this videoId to the user's list
    const rawIndex = await this.env.CACHE?.get(indexKey);
    let index: string[] = [];
    if (rawIndex) {
      try {
        index = JSON.parse(rawIndex) as string[];
      } catch {
        index = [];
      }
    }

    // Remove existing entry if present (to dedupe and move to front)
    const filtered = index.filter((id) => id !== event.videoId);

    // Prepend to the front
    const newIndex = [event.videoId, ...filtered];

    // Cap at MAX_WATCH_ENTRIES_PER_USER
    if (newIndex.length > MAX_WATCH_ENTRIES_PER_USER) {
      const removed = newIndex.splice(MAX_WATCH_ENTRIES_PER_USER);
      // Clean up evicted entries
      for (const removedId of removed) {
        this.env.CACHE?.delete(watchKey(walletLower, removedId)).catch(() => {});
      }
    }

    await this.env.CACHE?.put(indexKey, JSON.stringify(newIndex), {
      expirationTtl: WATCH_TTL_SECONDS,
    });
  }

  /**
   * Get a single watch event for a user + video.
   */
  async getWatchEvent(wallet: string, videoId: string): Promise<WatchEvent | null> {
    const walletLower = sanitizeWallet(wallet);
    const key = watchKey(walletLower, videoId);
    const raw = await this.env.CACHE?.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as WatchEvent;
    } catch {
      return null;
    }
  }

  /**
   * Get watch history for a user, paginated.
   * Returns most recent first.
   */
  async getHistory(
    wallet: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<WatchHistoryPage> {
    const walletLower = sanitizeWallet(wallet);
    const limit = options.limit ?? 20;
    const indexKey = watchIndexKey(walletLower);

    const rawIndex = await this.env.CACHE?.get(indexKey);
    if (!rawIndex) {
      return { events: [], total: 0, cursor: null, hasMore: false };
    }

    let index: string[];
    try {
      index = JSON.parse(rawIndex) as string[];
    } catch {
      return { events: [], total: 0, cursor: null, hasMore: false };
    }

    // Apply cursor-based pagination
    const startIdx = options.cursor ? index.indexOf(options.cursor) + 1 : 0;
    if (startIdx < 0) {
      return { events: [], total: 0, cursor: null, hasMore: false };
    }

    const pageIds = index.slice(startIdx, startIdx + limit);

    // Fetch watch events
    const events: WatchEvent[] = [];
    for (const videoId of pageIds) {
      const event = await this.getWatchEvent(wallet, videoId);
      if (event) {
        events.push(event);
      }
    }

    const hasMore = startIdx + limit < index.length;
    const nextCursor = hasMore ? (index[startIdx + limit - 1] ?? null) : null;

    return {
      events,
      total: index.length,
      cursor: nextCursor,
      hasMore,
    };
  }

  /**
   * Get "Continue watching" items — videos with progress between
   * 5% and 95% completed, sorted by most recent watch.
   */
  async getContinueWatching(wallet: string, limit = 20): Promise<ContinueWatchingItem[]> {
    const history = await this.getHistory(wallet, { limit: 100 });

    const inProgress = history.events
      .filter((e) => !e.completed && e.progress > 5 && e.progress < 95)
      .map((e) => ({
        videoId: e.videoId,
        title: e.title,
        creatorName: e.creatorName,
        creatorAvatar: e.creatorAvatar,
        thumbnailUrl: e.thumbnailUrl,
        platform: e.platform,
        position: e.position,
        duration: e.duration,
        progress: e.progress,
        category: e.category,
        lastWatched: e.lastWatched,
      }))
      .sort((a, b) => b.lastWatched - a.lastWatched);

    return inProgress.slice(0, limit);
  }

  /**
   * Remove a single video from watch history.
   */
  async removeFromHistory(wallet: string, videoId: string): Promise<void> {
    const walletLower = sanitizeWallet(wallet);
    const key = watchKey(walletLower, videoId);
    const indexKey = watchIndexKey(walletLower);

    await this.env.CACHE?.delete(key);

    const rawIndex = await this.env.CACHE?.get(indexKey);
    if (rawIndex) {
      try {
        const index = JSON.parse(rawIndex) as string[];
        const filtered = index.filter((id) => id !== videoId);
        await this.env.CACHE?.put(indexKey, JSON.stringify(filtered), {
          expirationTtl: WATCH_TTL_SECONDS,
        });
      } catch {
        // Ignore parse errors
      }
    }
  }

  /**
   * Clear all watch history for a user.
   */
  async clearHistory(wallet: string): Promise<number> {
    const walletLower = sanitizeWallet(wallet);
    const indexKey = watchIndexKey(walletLower);
    let cleared = 0;

    const rawIndex = await this.env.CACHE?.get(indexKey);
    if (rawIndex) {
      try {
        const index = JSON.parse(rawIndex) as string[];
        // Delete all individual watch entries
        const deletePromises = index.map((videoId) =>
          this.env.CACHE?.delete(watchKey(walletLower, videoId)).catch(() => {
            // Best-effort deletion
          }),
        );
        await Promise.allSettled(deletePromises);
        cleared = index.length;
      } catch {
        // Ignore parse errors
      }
    }

    // Delete the index
    await this.env.CACHE?.delete(indexKey);
    return cleared;
  }

  /**
   * Get user interest topics based on watch history.
   * Returns categories the user watches most frequently.
   */
  async getUserInterestCategories(wallet: string): Promise<string[]> {
    const history = await this.getHistory(wallet, { limit: 200 });
    const categoryCounts = new Map<string, number>();

    for (const event of history.events) {
      if (event.category) {
        categoryCounts.set(event.category, (categoryCounts.get(event.category) ?? 0) + 1);
      }
    }

    return [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
  }

  /**
   * Get watch completion stats for a specific video across all users
   * (for analytics / average completion rate).
   */
  async getAggregateCompletion(videoId: string): Promise<{
    totalWatches: number;
    averageProgress: number;
    completionRate: number;
  } | null> {
    // This could be extended to scan watch entries
    // For now, returns null — production would use an analytics store
    return null;
  }
}

// ─── Factory ───────────────────────────────────────────────────────────

export function createWatchHistoryStore(env: Env): WatchHistoryStore {
  return new WatchHistoryStore(env);
}
