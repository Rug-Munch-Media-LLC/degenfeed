/**
 * @degenfeed/api-worker — Simulcast Analytics
 *
 * Tracks per-platform viewer counts, engagement, revenue, and computes
 * cross-platform analytics for simulcast streams.
 *
 * Data flows:
 *   Viewer count: Platform API → KV cache → Analytics aggregator
 *   Revenue: Tip events from all platforms → KV → Aggregator
 *   Chat engagement: Cross-platform chat bridge → KV
 *
 * @see ./simulcast-engine.ts
 */

import type { Env } from '../types';
import type { SimulcastStream } from './simulcast-engine';

// ─── KV Key Helpers ──────────────────────────────────────────────────────────

function analyticsKey(simulcastId: string): string {
  return `simulcast:analytics:${simulcastId}`;
}

function viewerSnapshotKey(simulcastId: string): string {
  return `simulcast:viewers:${simulcastId}`;
}

function revenueKey(simulcastId: string): string {
  return `simulcast:revenue:${simulcastId}`;
}

function chatKey(simulcastId: string): string {
  return `simulcast:chat:${simulcastId}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SimulcastAnalytics {
  /** Simulcast session ID */
  simulcastId: string;
  /** Aggregated viewer data */
  viewers: SimulcastViewerAnalytics;
  /** Per-platform revenue */
  revenue: SimulcastRevenueAnalytics;
  /** Per-platform chat engagement */
  chat: SimulcastChatAnalytics;
  /** Platform rankings */
  rankings: SimulcastRankings;
  /** Last updated timestamp */
  lastUpdated: number;
}

export interface SimulcastViewerAnalytics {
  /** Total viewers across ALL platforms */
  total: number;
  /** Per-platform viewer count */
  perPlatform: Record<string, number>;
  /** Peak concurrent viewers (across all platforms) */
  peak: number;
  /** Timestamp of peak */
  peakAt?: number;
  /** Viewer count history (snapshots over time) */
  history: Array<{ timestamp: number; total: number; platforms: Record<string, number> }>;
}

export interface SimulcastRevenueAnalytics {
  /** Total revenue from tips/gifts across all platforms */
  total: number;
  /** Currency of revenue */
  currency: string;
  /** Per-platform revenue breakdown */
  perPlatform: Record<string, number>;
  /** Revenue by currency type (crypto vs fiat) */
  byType: {
    crypto: number;
    fiat: number;
  };
  /** Number of individual tips */
  tipCount: number;
}

export interface SimulcastChatAnalytics {
  /** Total chat messages across all platforms */
  total: number;
  /** Per-platform message count */
  perPlatform: Record<string, number>;
  /** Unique chatters across all platforms */
  uniqueChatters: number;
  /** Messages per minute (current rate) */
  messagesPerMinute: number;
}

export interface SimulcastRankings {
  /** Best performing platform by viewer count */
  bestByViewers: string | null;
  /** Best performing platform by engagement */
  bestByEngagement: string | null;
  /** Best performing platform by revenue */
  bestByRevenue: string | null;
  /** Platforms sorted by total viewers descending */
  byViewers: string[];
  /** Platforms sorted by engagement descending */
  byEngagement: string[];
}

// ─── Analytics Engine ────────────────────────────────────────────────────────

/**
 * Compute current analytics for an active simulcast.
 * Aggregates viewer counts, revenue, and chat data from KV.
 */
export async function computeSimulcastAnalytics(
  simulcast: SimulcastStream,
  env: Env,
): Promise<SimulcastAnalytics> {
  // Gather viewer counts from all platforms
  const perPlatformViewers: Record<string, number> = {};
  let totalViewers = 0;

  for (const [platform, status] of Object.entries(simulcast.platforms)) {
    const viewerCount = status.viewerCount || 0;
    perPlatformViewers[platform] = viewerCount;
    totalViewers += viewerCount;
  }

  // Load historical snapshot
  const viewerSnapshots = await loadViewerSnapshots(simulcast.id, env);
  const now = Date.now();

  // Add current snapshot
  viewerSnapshots.push({
    timestamp: now,
    total: totalViewers,
    platforms: perPlatformViewers,
  });

  // Keep last 60 snapshots (at ~30s intervals = 30min window)
  const trimmedHistory = viewerSnapshots.slice(-60);
  await saveViewerSnapshots(simulcast.id, trimmedHistory, env);

  // Compute peak
  let peak = 0;
  let peakAt: number | undefined;
  for (const snapshot of trimmedHistory) {
    if (snapshot.total > peak) {
      peak = snapshot.total;
      peakAt = snapshot.timestamp;
    }
  }

  // Load revenue data
  const revenue = await loadRevenueData(simulcast.id, env);

  // Load chat data
  const chat = await loadChatData(simulcast.id, env);

  // Compute rankings
  const rankings = computeRankings(simulcast, revenue);

  return {
    simulcastId: simulcast.id,
    viewers: {
      total: totalViewers,
      perPlatform: perPlatformViewers,
      peak,
      peakAt,
      history: trimmedHistory,
    },
    revenue,
    chat,
    rankings,
    lastUpdated: now,
  };
}

/**
 * Record a tip/revenue event for a simulcast platform.
 */
export async function recordSimulcastTip(
  simulcastId: string,
  platform: string,
  amount: number,
  currency: string,
  env: Env,
): Promise<void> {
  try {
    const revenue = await loadRevenueData(simulcastId, env);

    revenue.total += amount;
    revenue.perPlatform[platform] = (revenue.perPlatform[platform] || 0) + amount;
    revenue.tipCount += 1;

    if (currency === 'ETH' || currency === 'SOL' || currency === 'USDC' || currency === 'BTC') {
      revenue.byType.crypto += amount;
    } else {
      revenue.byType.fiat += amount;
    }

    await saveRevenueData(simulcastId, revenue, env);
  } catch {
    // Non-critical
  }
}

/**
 * Record a chat message for a simulcast platform (for cross-platform chat tracking).
 */
export async function recordSimulcastChatMessage(
  simulcastId: string,
  platform: string,
  userId: string,
  env: Env,
): Promise<void> {
  try {
    const chat = await loadChatData(simulcastId, env);

    chat.total += 1;
    chat.perPlatform[platform] = (chat.perPlatform[platform] || 0) + 1;

    // Track unique chatters (using a separate set in KV)
    const chatterKey = `simulcast:chatters:${simulcastId}`;
    const raw = await env.CACHE?.get(chatterKey);
    const chatters: Set<string> = raw ? new Set(JSON.parse(raw)) : new Set();
    chatters.add(userId);
    chat.uniqueChatters = chatters.size;
    await env.CACHE?.put(chatterKey, JSON.stringify([...chatters]), {
      expirationTtl: 86400,
    });

    // Compute messages per minute
    const firstSnapshot = chat.total > 0 ? chat.total : 1;
    const elapsedMinutes = Math.max(1, (Date.now() - simulcastId.split(':').reduce(() => Date.now(), 0)) / 60000);
    chat.messagesPerMinute = Math.round((chat.total / elapsedMinutes) * 10) / 10;

    await saveChatData(simulcastId, chat, env);
  } catch {
    // Non-critical
  }
}

/**
 * Update viewer count for a specific platform in a simulcast.
 */
export async function updateSimulcastViewerCount(
  simulcastId: string,
  platform: string,
  count: number,
  env: Env,
): Promise<void> {
  try {
    const simulcastRaw = await env.STREAMS?.get(`simulcast:${simulcastId}`);
    if (!simulcastRaw) return;

    const simulcast: SimulcastStream = JSON.parse(simulcastRaw);
    if (simulcast.platforms[platform]) {
      simulcast.platforms[platform].viewerCount = count;
      await env.STREAMS?.put(`simulcast:${simulcastId}`, JSON.stringify(simulcast), {
        expirationTtl: 86400,
      });
    }
  } catch {
    // Non-critical
  }
}

// ─── Internal Data Loaders ───────────────────────────────────────────────────

async function loadViewerSnapshots(
  simulcastId: string,
  env: Env,
): Promise<SimulcastViewerAnalytics['history']> {
  try {
    const raw = await env.CACHE?.get(viewerSnapshotKey(simulcastId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveViewerSnapshots(
  simulcastId: string,
  history: SimulcastViewerAnalytics['history'],
  env: Env,
): Promise<void> {
  try {
    await env.CACHE?.put(viewerSnapshotKey(simulcastId), JSON.stringify(history), {
      expirationTtl: 86400,
    });
  } catch {
    // Non-critical
  }
}

async function loadRevenueData(simulcastId: string, env: Env): Promise<SimulcastRevenueAnalytics> {
  try {
    const raw = await env.STREAMS?.get(revenueKey(simulcastId));
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall through
  }

  return {
    total: 0,
    currency: 'USD',
    perPlatform: {},
    byType: { crypto: 0, fiat: 0 },
    tipCount: 0,
  };
}

async function saveRevenueData(
  simulcastId: string,
  revenue: SimulcastRevenueAnalytics,
  env: Env,
): Promise<void> {
  try {
    await env.STREAMS?.put(revenueKey(simulcastId), JSON.stringify(revenue), {
      expirationTtl: 86400 * 7,
    });
  } catch {
    // Non-critical
  }
}

async function loadChatData(simulcastId: string, env: Env): Promise<SimulcastChatAnalytics> {
  try {
    const raw = await env.CACHE?.get(chatKey(simulcastId));
    if (raw) return JSON.parse(raw);
  } catch {
    // Fall through
  }

  return {
    total: 0,
    perPlatform: {},
    uniqueChatters: 0,
    messagesPerMinute: 0,
  };
}

async function saveChatData(
  simulcastId: string,
  chat: SimulcastChatAnalytics,
  env: Env,
): Promise<void> {
  try {
    await env.CACHE?.put(chatKey(simulcastId), JSON.stringify(chat), {
      expirationTtl: 86400,
    });
  } catch {
    // Non-critical
  }
}

function computeRankings(
  simulcast: SimulcastStream,
  revenue: SimulcastRevenueAnalytics,
): SimulcastRankings {
  const platforms = Object.entries(simulcast.platforms);

  // By viewers
  const byViewers = platforms
    .sort(([, a], [, b]) => (b.viewerCount || 0) - (a.viewerCount || 0))
    .map(([p]) => p);

  // By engagement (chat messages)
  const byEngagement = Object.entries(revenue.perPlatform)
    .sort(([, a], [, b]) => b - a)
    .map(([p]) => p);

  // If no chat data, use viewer-based order
  const engagementOrder = byEngagement.length > 0 ? byEngagement : byViewers;

  // By revenue
  const byRevenue = Object.entries(revenue.perPlatform)
    .sort(([, a], [, b]) => b - a)
    .map(([p]) => p);

  return {
    bestByViewers: byViewers[0] ?? null,
    bestByEngagement: engagementOrder[0] ?? null,
    bestByRevenue: byRevenue[0] ?? null,
    byViewers,
    byEngagement: engagementOrder,
  };
}
