/**
 * PolymarketProvider — prediction market feed from Polymarket.
 *
 * Polymarket exposes two public APIs:
 *   - Gamma API: https://gamma-api.polymarket.com/events — event + market
 *     metadata (volume, liquidity, images) — used as the primary source.
 *   - CLOB API:  https://clob.polymarket.com/markets — order-book data
 *     (best bid/ask, outcome prices) — used as a fallback source.
 *
 * This provider surfaces:
 *   - Trending markets (sorted by volume)
 *   - Current odds (outcome prices)
 *   - Resolution / market status (active, closed, resolved)
 *
 * Protocol: 'polymarket' (added to @degenfeed/types 2026-08-06).
 */

import { buildUnifiedPost, CircuitBreaker, CircuitBreakerError } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import type { FeedProvider, FeedResult, FetchOptions, HealthResult, SchemaGuard } from '../types';
import { buildIdentity } from './shared';
import { DEFAULT_TIMEOUT_MS, fetchJson, withTimeout } from '../utils';

export const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com/events';
export const POLYMARKET_CLOB_URL = 'https://clob.polymarket.com/markets';

export interface PolymarketMarket {
  id: string;
  question?: string | null;
  slug?: string | null;
  outcomes?: string[] | null;
  outcomePrices?: string | number[] | null;
  volume?: number | null;
  volume24hr?: number | null;
  liquidity?: number | null;
  endDate?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
  conditionId?: string | null;
}

export interface PolymarketEvent {
  id: string;
  title?: string | null;
  description?: string | null;
  slug?: string | null;
  image?: string | null;
  volume?: number | null;
  volume24hr?: number | null;
  liquidity?: number | null;
  closed?: boolean | null;
  active?: boolean | null;
  markets?: PolymarketMarket[] | null;
}

export interface PolymarketEventsResponse {
  data?: PolymarketEvent[] | null;
  errors?: Array<{ message?: string }>;
}

export interface PolymarketClobResponse {
  data?: PolymarketMarket[] | null;
  next_cursor?: string | null;
}

/** Parse "0.45,0.55" outcome price strings into numbers. */
export function parseOutcomePrices(m: PolymarketMarket): number[] {
  const raw = m.outcomePrices;
  if (Array.isArray(raw)) return raw.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

/** Runtime guard for a single Polymarket market (minimal shape). */
export function isPolymarketMarket(obj: unknown): obj is PolymarketMarket {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const m = obj as Record<string, unknown>;
  return typeof m.id === 'string' || typeof m.conditionId === 'string';
}

/** Runtime guard for a single Polymarket event (minimal shape). */
export function isPolymarketEvent(obj: unknown): obj is PolymarketEvent {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return false;
  const e = obj as Record<string, unknown>;
  return typeof e.id === 'string' || typeof e.title === 'string';
}

function marketIdentity(m: PolymarketMarket): UnifiedIdentity {
  const id = m.conditionId || m.id || 'polymarket';
  return buildIdentity(id, 'polymarket' as Protocol, id, null, 'Polymarket', {
    bio: 'Prediction market',
    avatarUrl: '',
    keys: {},
  });
}

function marketToUnifiedPost(m: PolymarketMarket, event?: PolymarketEvent): UnifiedPost {
  const question = m.question ?? event?.title ?? 'Polymarket market';
  const prices = parseOutcomePrices(m);
  const outcomes = m.outcomes ?? ['Yes', 'No'];

  const lines = [`🎯 ${question}`, ''];
  if (prices.length > 0) {
    for (let i = 0; i < Math.min(outcomes.length, prices.length); i++) {
      const outcome = outcomes[i] ?? `Outcome ${i + 1}`;
      const pct = Math.round((prices[i] ?? 0) * 100);
      lines.push(`${outcome}: ${pct}¢`);
    }
  }
  const volume = m.volume24hr ?? m.volume ?? event?.volume24hr ?? event?.volume ?? 0;
  if (volume > 0) {
    lines.push(
      `24h volume: $${volume >= 1000 ? `${(volume / 1000).toFixed(1)}K` : volume.toFixed(0)}`,
    );
  }
  const status = m.closed ? 'Resolved' : m.active === false ? 'Inactive' : 'Active';
  lines.push(`Status: ${status}`);

  const link = m.slug
    ? `https://polymarket.com/market/${m.slug}`
    : event?.slug
      ? `https://polymarket.com/event/${event.slug}`
      : `https://polymarket.com/market/${m.conditionId ?? m.id}`;

  return buildUnifiedPost({
    protocol: 'polymarket',
    nativeId: m.conditionId ?? m.id,
    author: marketIdentity(m),
    text: lines.join('\n'),
    embeds: [
      { kind: 'link', url: link, meta: { title: question, outcomePrices: prices } },
    ],
    createdAt: m.endDate ? new Date(m.endDate).getTime() : Date.now(),
    metrics: {
      likes: Math.round(volume),
      reposts: 0,
      replies: 0,
      quotes: 0,
    },
    raw: m,
  });
}

export interface PolymarketProviderOptions {
  /** Gamma events endpoint (default https://gamma-api.polymarket.com/events). */
  gammaUrl?: string;
  /** CLOB markets endpoint (default https://clob.polymarket.com/markets). */
  clobUrl?: string;
}

export class PolymarketProvider implements FeedProvider {
  readonly protocol: Protocol = 'polymarket';
  readonly schema: SchemaGuard = (data): boolean =>
    Array.isArray(data) || typeof data === 'object';
  private readonly gammaUrl: string;
  private readonly clobUrl: string;
  private readonly breaker = new CircuitBreaker('polymarket');

  constructor(options: PolymarketProviderOptions = {}) {
    this.gammaUrl = options.gammaUrl ?? POLYMARKET_GAMMA_URL;
    this.clobUrl = options.clobUrl ?? POLYMARKET_CLOB_URL;
  }

  /** Fetch trending events from Gamma (primary). */
  private async fetchGammaEvents(timeoutMs: number): Promise<PolymarketEvent[]> {
    const url = `${this.gammaUrl}?limit=20&order=volume&ascending=false&closed=false&active=true`;
    const data = await withTimeout(
      fetchJson<PolymarketEventsResponse | PolymarketEvent[]>(url),
      timeoutMs,
      'polymarket:gamma',
    );
    if (Array.isArray(data)) return data.filter(isPolymarketEvent);
    return (data.data ?? []).filter(isPolymarketEvent);
  }

  /** Fetch markets from the CLOB API (fallback). */
  private async fetchClobMarkets(timeoutMs: number): Promise<PolymarketMarket[]> {
    const url = `${this.clobUrl}?limit=20&active=true`;
    const data = await withTimeout(
      fetchJson<PolymarketClobResponse | PolymarketMarket[]>(url),
      timeoutMs,
      'polymarket:clob',
    );
    if (Array.isArray(data)) return data.filter(isPolymarketMarket);
    return (data.data ?? []).filter(isPolymarketMarket);
  }

  async fetchFeed(opts: FetchOptions = {}): Promise<FeedResult> {
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      return await this.breaker.execute(async () => {
        let events: PolymarketEvent[] = [];
        let clobMarkets: PolymarketMarket[] = [];

        try {
          events = await this.fetchGammaEvents(timeoutMs);
        } catch {
          events = [];
        }
        try {
          clobMarkets = await this.fetchClobMarkets(timeoutMs);
        } catch {
          clobMarkets = [];
        }

        const posts: UnifiedPost[] = [];

        // Primary: markets from trending Gamma events, sorted by volume desc
        const eventMarkets: Array<{ m: PolymarketMarket; e: PolymarketEvent }> = [];
        for (const e of events) {
          for (const m of e.markets ?? []) {
            if (isPolymarketMarket(m)) eventMarkets.push({ m, e });
          }
        }
        eventMarkets.sort(
          (a, b) =>
            (b.m.volume24hr ?? b.m.volume ?? 0) - (a.m.volume24hr ?? a.m.volume ?? 0),
        );
        for (const { m, e } of eventMarkets.slice(0, 25)) {
          posts.push(marketToUnifiedPost(m, e));
        }

        // Fallback: CLOB markets when Gamma returns nothing
        if (posts.length === 0) {
          clobMarkets.sort(
            (a, b) => (b.volume24hr ?? b.volume ?? 0) - (a.volume24hr ?? a.volume ?? 0),
          );
          for (const m of clobMarkets.slice(0, 25)) {
            posts.push(marketToUnifiedPost(m));
          }
        }

        // Final sort: volume desc (route contract: "sorted by volume")
        posts.sort((a, b) => (b.metrics.likes ?? 0) - (a.metrics.likes ?? 0));

        if (posts.length === 0) {
          return { posts: [], notice: 'Polymarket returned no markets' };
        }
        return {
          posts,
          notice: `Polymarket: ${posts.length} markets by volume (gamma=${events.length} events)`,
        };
      });
    } catch (err) {
      if (err instanceof CircuitBreakerError) {
        return {
          posts: [],
          notice: 'Polymarket: circuit breaker open — temporarily unavailable',
        };
      }
      const message = err instanceof Error ? err.message : 'unknown';
      return { posts: [], notice: `Polymarket feed unavailable: ${message}` };
    }
  }

  async healthCheck(opts: FetchOptions = {}): Promise<HealthResult> {
    const start = performance.now();
    try {
      await withTimeout(
        fetchJson(`${this.gammaUrl}?limit=1&active=true`),
        opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        'polymarket:health',
      );
      return { healthy: true, latencyMs: Math.round(performance.now() - start) };
    } catch (err) {
      return {
        healthy: false,
        latencyMs: Math.round(performance.now() - start),
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  }
}
