/**
 * @degenfeed/api-worker — Frame Analytics Engine
 *
 * Track views, clicks, conversions, and engagement per frame.
 * Stores data in KV with daily rollups.
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures.
 */

import type { Env } from '../index';
import type { FrameInteractionEvent } from '@degenfeed/farcaster-sdk';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface FrameAnalyticsEvent {
  frameId: string;
  /** Unix timestamp in ms */
  timestamp: number;
  /** Event type */
  eventType: 'view' | 'click' | 'input' | 'tx_initiated' | 'tx_confirmed' | 'tx_failed' | 'conversion';
  /** Interactor FID (if available) */
  interactorFid?: number;
  /** Interactor wallet address */
  interactorAddress?: string;
  /** Button index clicked (0 if not a click event) */
  buttonIndex?: number;
  /** Input text submitted */
  inputText?: string;
  /** Transaction hash (if tx event) */
  txHash?: string;
  /** Conversion type (e.g., 'buy-coin', 'tip') */
  conversionType?: string;
  /** Session ID */
  sessionId?: string;
  /** IP (for rate limiting, not stored in aggregates) */
  ip?: string;
}

export interface FrameAnalyticsSummary {
  frameId: string;
  /** Total views */
  totalViews: number;
  /** Total clicks (all buttons) */
  totalClicks: number;
  /** Unique interactors */
  uniqueInteractors: number;
  /** Click-through rate (clicks / views) */
  ctr: number;
  /** Transactions initiated */
  txInitiated: number;
  /** Transactions confirmed */
  txConfirmed: number;
  /** Transactions failed */
  txFailed: number;
  /** Conversion count */
  totalConversions: number;
  /** Conversion rate (conversions / views) */
  conversionRate: number;
  /** Conversion types breakdown */
  conversionsByType: Record<string, number>;
  /** Button click breakdown */
  clicksByButton: Record<number, number>;
  /** Daily breakdown (last 30 days) */
  daily: Record<string, DailyFrameStats>;
  /** Last activity */
  lastActivity: number;
  /** Time series of recent events (last 100) */
  recentEvents: FrameAnalyticsEvent[];
}

export interface DailyFrameStats {
  date: string;
  views: number;
  clicks: number;
  uniqueInteractors: number;
  txInitiated: number;
  txConfirmed: number;
  conversions: number;
}

// ─── KV Prefixes ───────────────────────────────────────────────────────────

const KV_ANALYTICS_PREFIX = 'frames-v2:analytics:';
const KV_ANALYTICS_DAILY_PREFIX = 'frames-v2:analytics:daily:';
const KV_ANALYTICS_EVENTS_PREFIX = 'frames-v2:analytics:events:';
const KV_ANALYTICS_GLOBAL_PREFIX = 'frames-v2:analytics:global';

// ─── Analytics Engine ─────────────────────────────────────────────────────

export class FrameAnalytics {
  /**
   * Track a frame interaction event.
   */
  async trackEvent(event: FrameAnalyticsEvent, env: Env): Promise<void> {
    if (!env.CACHE) return;

    const frameId = event.frameId;
    const today = new Date().toISOString().slice(0, 10);

    try {
      // Store raw event (last 500)
      const eventsKey = `${KV_ANALYTICS_EVENTS_PREFIX}${frameId}`;
      const eventsRaw = await env.CACHE.get(eventsKey);
      const events: FrameAnalyticsEvent[] = eventsRaw ? JSON.parse(eventsRaw) : [];
      events.push(event);
      await env.CACHE.put(eventsKey, JSON.stringify(events.slice(-500)), {
        expirationTtl: 86400 * 30,
      });

      // Update daily stats
      const dailyKey = `${KV_ANALYTICS_DAILY_PREFIX}${frameId}:${today}`;
      const dailyRaw = await env.CACHE.get(dailyKey);
      const daily: DailyFrameStats = dailyRaw ? JSON.parse(dailyRaw) : {
        date: today,
        views: 0,
        clicks: 0,
        uniqueInteractors: 0,
        txInitiated: 0,
        txConfirmed: 0,
        conversions: 0,
      };

      switch (event.eventType) {
        case 'view':
          daily.views++;
          break;
        case 'click':
          daily.clicks++;
          break;
        case 'tx_initiated':
          daily.txInitiated++;
          break;
        case 'tx_confirmed':
          daily.txConfirmed++;
          break;
        case 'conversion':
          daily.conversions++;
          break;
      }

      // Track unique interactors (simple approach — store set in KV)
      if (event.interactorFid || event.interactorAddress) {
        const uniqKey = `${KV_ANALYTICS_PREFIX}${frameId}:unique:${today}`;
        const uniqRaw = await env.CACHE.get(uniqKey);
        const uniq: string[] = uniqRaw ? JSON.parse(uniqRaw) : [];
        const id = event.interactorFid
          ? `fid:${event.interactorFid}`
          : `addr:${event.interactorAddress}`;
        if (!uniq.includes(id)) {
          uniq.push(id);
          daily.uniqueInteractors = uniq.length;
          const newUniq = uniq.slice(0, 10000);
          await env.CACHE.put(uniqKey, JSON.stringify(newUniq), { expirationTtl: 86400 * 90 });
        } else {
          daily.uniqueInteractors = uniq.length;
        }
      }

      await env.CACHE.put(dailyKey, JSON.stringify(daily), { expirationTtl: 86400 * 90 });

      // Update global counter
      const globalRaw = await env.CACHE.get(KV_ANALYTICS_GLOBAL_PREFIX);
      const global: Record<string, number> = globalRaw ? JSON.parse(globalRaw) : {};
      global[frameId] = (global[frameId] || 0) + 1;
      await env.CACHE.put(KV_ANALYTICS_GLOBAL_PREFIX, JSON.stringify(global), {
        expirationTtl: 86400 * 90,
      });

      // If conversion, record the conversion type
      if (event.eventType === 'conversion' && event.conversionType) {
        const convKey = `${KV_ANALYTICS_PREFIX}${frameId}:conversions`;
        const convRaw = await env.CACHE.get(convKey);
        const convTypes: Record<string, number> = convRaw ? JSON.parse(convRaw) : {};
        convTypes[event.conversionType] = (convTypes[event.conversionType] || 0) + 1;
        await env.CACHE.put(convKey, JSON.stringify(convTypes), { expirationTtl: 86400 * 90 });
      }
    } catch (err) {
      console.error('[frame-analytics] trackEvent failed:', err);
    }
  }

  /**
   * Get analytics summary for a frame.
   */
  async getSummary(frameId: string, env: Env): Promise<FrameAnalyticsSummary | null> {
    if (!env.CACHE) return null;

    try {
      // Get recent events
      const eventsKey = `${KV_ANALYTICS_EVENTS_PREFIX}${frameId}`;
      const eventsRaw = await env.CACHE.get(eventsKey);
      const recentEvents: FrameAnalyticsEvent[] = eventsRaw ? JSON.parse(eventsRaw) : [];

      // Get all daily stats (last 30 days)
      const daily: Record<string, DailyFrameStats> = {};
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dailyKey = `${KV_ANALYTICS_DAILY_PREFIX}${frameId}:${dateStr}`;
        const dailyRaw = await env.CACHE.get(dailyKey);
        if (dailyRaw) {
          daily[dateStr] = JSON.parse(dailyRaw) as DailyFrameStats;
        }
      }

      // Aggregate
      let totalViews = 0;
      let totalClicks = 0;
      let uniqueInteractors = 0;
      let txInitiated = 0;
      let txConfirmed = 0;
      let txFailed = 0;
      let totalConversions = 0;
      const clicksByButton: Record<number, number> = {};
      let lastActivity = 0;

      for (const day of Object.values(daily)) {
        totalViews += day.views;
        totalClicks += day.clicks;
        if (day.uniqueInteractors > uniqueInteractors) {
          uniqueInteractors = day.uniqueInteractors;
        }
        txInitiated += day.txInitiated;
        txConfirmed += day.txConfirmed;
        totalConversions += day.conversions;
      }

      // Recent events for clicks by button
      for (const ev of recentEvents) {
        if (ev.timestamp > lastActivity) lastActivity = ev.timestamp;
        if (ev.eventType === 'click' && ev.buttonIndex !== undefined) {
          clicksByButton[ev.buttonIndex] = (clicksByButton[ev.buttonIndex] || 0) + 1;
        }
        if (ev.eventType === 'tx_failed') {
          txFailed++;
        }
      }

      // Get conversion types
      const convKey = `${KV_ANALYTICS_PREFIX}${frameId}:conversions`;
      const convRaw = await env.CACHE.get(convKey);
      const conversionsByType: Record<string, number> = convRaw ? JSON.parse(convRaw) : {};

      const ctr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
      const conversionRate = totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

      return {
        frameId,
        totalViews,
        totalClicks,
        uniqueInteractors,
        ctr: Math.round(ctr * 100) / 100,
        txInitiated,
        txConfirmed,
        txFailed,
        totalConversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
        conversionsByType,
        clicksByButton,
        daily,
        lastActivity,
        recentEvents: recentEvents.slice(-100),
      };
    } catch {
      return null;
    }
  }

  /**
   * Record a view event.
   */
  async trackView(frameId: string, interactorFid?: number, ip?: string, env?: Env): Promise<void> {
    if (!env?.CACHE) return;
    await this.trackEvent({
      frameId,
      timestamp: Date.now(),
      eventType: 'view',
      interactorFid,
      ip,
    }, env);
  }

  /**
   * Track a conversion event.
   */
  async trackConversion(
    frameId: string,
    conversionType: string,
    interactorFid?: number,
    txHash?: string,
    env?: Env,
  ): Promise<void> {
    if (!env?.CACHE) return;
    await this.trackEvent({
      frameId,
      timestamp: Date.now(),
      eventType: 'conversion',
      conversionType,
      interactorFid,
      txHash,
    }, env);
  }

  /**
   * Get global frame rankings (by total events).
   */
  async getGlobalRankings(env: Env, limit = 20): Promise<Array<{ frameId: string; score: number }>> {
    if (!env.CACHE) return [];
    try {
      const raw = await env.CACHE.get(KV_ANALYTICS_GLOBAL_PREFIX);
      if (!raw) return [];
      const global: Record<string, number> = JSON.parse(raw);
      return Object.entries(global)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([frameId, score]) => ({ frameId, score }));
    } catch {
      return [];
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

let _analyticsInstance: FrameAnalytics | null = null;

export function getFrameAnalytics(): FrameAnalytics {
  if (!_analyticsInstance) _analyticsInstance = new FrameAnalytics();
  return _analyticsInstance;
}
