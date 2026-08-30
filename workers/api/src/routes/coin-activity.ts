/**
 * @degenfeed/api-worker — Coin Activity Feed (TASK 1)
 *
 * Real-time activity feed for creator coins:
 *   GET /api/coin/:symbol/activity — Paginated activity feed
 *
 * Activity types: buy, sell, claim_vested, new_holder, phase_change,
 *                 badge_earned, tip_creator
 *
 * Cached in KV with 30s TTL for fresh feed.
 */

import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'buy'
  | 'sell'
  | 'claim_vested'
  | 'new_holder'
  | 'phase_change'
  | 'badge_earned'
  | 'tip_creator';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  symbol: string;
  actor: string;
  actorLabel?: string; // ENS, .sol name, etc.
  amount?: string; // Token amount for buy/sell/claim
  nativeAmount?: string; // ETH/SOL amount for buys
  price?: string; // Price at time of event
  usdValue?: string; // USD value
  badgeName?: string; // For badge_earned events
  badgeIcon?: string; // For badge_earned events
  phaseName?: string; // For phase_change events
  phaseIndex?: number; // For phase_change events
  tipAmount?: string; // For tip_creator events
  holderCount?: number; // For new_holder events
  timestamp: number;
  txHash?: string;
}

export interface ActivityFeedResponse {
  events: ActivityEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  symbol: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const KV_PREFIX = 'coin:activity:';
const MAX_EVENTS = 500;
const DEFAULT_PAGE_SIZE = 30;
const CACHE_TTL = 30; // 30 seconds

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  buy: '🟢',
  sell: '🔴',
  claim_vested: '💎',
  new_holder: '🆕',
  phase_change: '📈',
  badge_earned: '🎉',
  tip_creator: '💬',
};

const _ACTIVITY_LABELS: Record<ActivityType, string> = {
  buy: 'bought',
  sell: 'sold',
  claim_vested: 'claimed',
  new_holder: 'joined',
  phase_change: 'reached',
  badge_earned: 'earned',
  tip_creator: 'tipped',
};

// ─── KV Helpers ────────────────────────────────────────────────────────────

async function getActivities(env: Env, symbol: string): Promise<ActivityEvent[]> {
  try {
    const key = KV_PREFIX + symbol.toLowerCase();
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw) as ActivityEvent[];
  } catch {
    // Fall through
  }
  return [];
}

async function setActivities(env: Env, symbol: string, events: ActivityEvent[]): Promise<void> {
  try {
    const key = KV_PREFIX + symbol.toLowerCase();
    // Keep only the latest MAX_EVENTS
    const trimmed = events.slice(0, MAX_EVENTS);
    await env.CACHE?.put(key, JSON.stringify(trimmed), { expirationTtl: CACHE_TTL });
  } catch {
    // Non-critical
  }
}

// ─── Append Event ──────────────────────────────────────────────────────────

export async function appendActivityEvent(env: Env, event: ActivityEvent): Promise<void> {
  const events = await getActivities(env, event.symbol);
  events.unshift(event);
  await setActivities(env, event.symbol, events);
}

// ─── Generate Human-Readable Description ──────────────────────────────────

export function formatActivityDescription(event: ActivityEvent): string {
  const actor = event.actorLabel ?? `${event.actor.slice(0, 6)}...${event.actor.slice(-4)}`;

  switch (event.type) {
    case 'buy':
      return `${actor} bought ${event.amount ?? '?'} $${event.symbol}${event.nativeAmount ? ` for ${event.nativeAmount} ETH` : ''}${event.usdValue ? ` ($${event.usdValue})` : ''}`;
    case 'sell':
      return `${actor} sold ${event.amount ?? '?'} $${event.symbol}`;
    case 'claim_vested':
      return `${actor} claimed ${event.amount ?? '?'} vested $${event.symbol}`;
    case 'new_holder':
      return `New holder: ${actor}${event.holderCount ? ` (now ${event.holderCount} holders)` : ''}`;
    case 'phase_change':
      return `$${event.symbol} hit ${event.phaseName ?? 'new phase'}${event.price ? ` — price now $${event.price}` : ''}`;
    case 'badge_earned':
      return `${actor} earned '${event.badgeName ?? 'New Badge'}' badge${event.badgeIcon ? ` ${event.badgeIcon}` : ''}`;
    case 'tip_creator':
      return `${actor} tipped creator ${event.tipAmount ? `${event.tipAmount} sats` : ''}`;
    default:
      return `${actor} performed an action on $${event.symbol}`;
  }
}

export function getActivityIcon(type: ActivityType): string {
  return ACTIVITY_ICONS[type] ?? '🔔';
}

// ─── GET /api/coin/:symbol/activity ────────────────────────────────────────

export async function handleCoinActivity(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  // Path: api/coin/:symbol/activity
  const symbolIdx = parts.indexOf('coin') + 1;
  const symbol = parts[symbolIdx] ?? '';

  if (!symbol) {
    return jsonResponse({ error: 'Symbol is required' }, 400);
  }

  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(
    Math.max(1, Number(url.searchParams.get('pageSize')) || DEFAULT_PAGE_SIZE),
    100,
  );
  const typeFilter = url.searchParams.get('type') as ActivityType | null;

  // Try KV first
  const events = await getActivities(env, symbol);

  if (events.length === 0) {
    // Generate mock activity for demo
    const mockEvents = [];
    return noCacheJsonResponse({
      events: mockEvents.slice(0, pageSize),
      total: mockEvents.length,
      page,
      pageSize,
      hasMore: mockEvents.length > pageSize,
      symbol: symbol.toUpperCase(),
    });
  }

  // Filter by type if specified
  const filtered = typeFilter ? events.filter((e) => e.type === typeFilter) : events;

  // Paginate
  const start = (page - 1) * pageSize;
  const paginated = filtered.slice(start, start + pageSize);

  return noCacheJsonResponse({
    events: paginated,
    total: filtered.length,
    page,
    pageSize,
    hasMore: start + pageSize < filtered.length,
    symbol: symbol.toUpperCase(),
  });
}

// ─── Mock Data Generator ──────────────────────────────────────────────────

export type { ActivityType as CoinActivityType };
