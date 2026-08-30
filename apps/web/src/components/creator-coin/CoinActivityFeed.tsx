'use client';

/**
 * CoinActivityFeed — Real-time coin activity feed (TASK 1)
 *
 * Shows live events: buys, sells, badge claims, phase changes, tips, etc.
 * Auto-refreshes every 15s. Supports pagination and type filtering.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────

type ActivityType =
  | 'buy'
  | 'sell'
  | 'claim_vested'
  | 'new_holder'
  | 'phase_change'
  | 'badge_earned'
  | 'tip_creator';

interface ActivityEvent {
  id: string;
  type: ActivityType;
  symbol: string;
  actor: string;
  actorLabel?: string;
  amount?: string;
  nativeAmount?: string;
  price?: string;
  usdValue?: string;
  badgeName?: string;
  badgeIcon?: string;
  phaseName?: string;
  phaseIndex?: number;
  tipAmount?: string;
  holderCount?: number;
  timestamp: number;
  txHash?: string;
}

interface CoinActivityFeedProps {
  symbol: string;
  maxHeight?: string;
  className?: string;
}

// ─── Icon Map ──────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<ActivityType, { icon: string; color: string }> = {
  buy: { icon: '🟢', color: 'text-degen-400' },
  sell: { icon: '🔴', color: 'text-red-400' },
  claim_vested: { icon: '💎', color: 'text-blue-400' },
  new_holder: { icon: '🆕', color: 'text-purple-400' },
  phase_change: { icon: '📈', color: 'text-yellow-400' },
  badge_earned: { icon: '🎉', color: 'text-amber-400' },
  tip_creator: { icon: '💬', color: 'text-pink-400' },
};

// ─── Format Helpers ────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortenAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ─── Activity Row Component ────────────────────────────────────────────────

function ActivityRow({ event, isNew }: { event: ActivityEvent; isNew?: boolean }) {
  const meta = ACTIVITY_META[event.type] ?? { icon: '🔔', color: 'text-gray-400' };
  const displayName = event.actorLabel ?? shortenAddr(event.actor);

  const description = (() => {
    switch (event.type) {
      case 'buy':
        return (
          <>
            <span className="font-semibold text-degen-400">{displayName}</span> bought{' '}
            <span className="font-semibold text-[var(--color-fg)]">{event.amount}</span> $
            {event.symbol}
            {event.nativeAmount && (
              <span className="text-[var(--color-muted)]"> for {event.nativeAmount} ETH</span>
            )}
          </>
        );
      case 'sell':
        return (
          <>
            <span className="font-semibold text-red-400">{displayName}</span> sold{' '}
            <span className="font-semibold text-[var(--color-fg)]">{event.amount}</span> $
            {event.symbol}
          </>
        );
      case 'claim_vested':
        return (
          <>
            <span className="font-semibold text-blue-400">{displayName}</span> claimed{' '}
            <span className="font-semibold text-[var(--color-fg)]">{event.amount}</span> vested $
            {event.symbol}
          </>
        );
      case 'new_holder':
        return (
          <>
            New holder: <span className="font-semibold text-purple-400">{displayName}</span>
            {event.holderCount && (
              <span className="text-[var(--color-muted)]"> (now {event.holderCount} holders)</span>
            )}
          </>
        );
      case 'phase_change':
        return (
          <>
            <span className="font-semibold text-yellow-400">${event.symbol}</span> hit{' '}
            <span className="font-semibold">{event.phaseName}</span>
            {event.price && (
              <span className="text-[var(--color-muted)]"> — price now ${event.price}</span>
            )}
          </>
        );
      case 'badge_earned':
        return (
          <>
            <span className="font-semibold text-amber-400">{displayName}</span> earned{' '}
            <span className="font-semibold">'{event.badgeName}'</span> badge
            {event.badgeIcon && <span className="ml-1">{event.badgeIcon}</span>}
          </>
        );
      case 'tip_creator':
        return (
          <>
            <span className="font-semibold text-pink-400">{displayName}</span> tipped creator{' '}
            {event.tipAmount && <span className="font-semibold">{event.tipAmount} sats</span>}
          </>
        );
      default:
        return (
          <>
            <span className="font-semibold">{displayName}</span> performed an action
          </>
        );
    }
  })();

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-all hover:bg-[var(--color-card)] ${
        isNew
          ? 'animate-slide-down border-degen-500/30 bg-degen-500/10 shadow-[0_0_12px_rgba(0,255,65,0.08)]'
          : 'border-[var(--color-glass-border)] bg-[var(--color-card)]/50'
      }`}
    >
      <span className="mt-0.5 shrink-0 text-xs leading-none">{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] leading-relaxed text-[var(--color-fg)]">{description}</p>
        <p className="mt-0.5 text-[9px] text-[var(--color-muted)]">
          {formatTimeAgo(event.timestamp)}
        </p>
      </div>
    </div>
  );
}

// ─── Type Filter Tabs ──────────────────────────────────────────────────────

const FILTER_TABS: Array<{ type: ActivityType | 'all'; label: string }> = [
  { type: 'all', label: 'All' },
  { type: 'buy', label: 'Buys' },
  { type: 'sell', label: 'Sells' },
  { type: 'badge_earned', label: 'Badges' },
  { type: 'phase_change', label: 'Phases' },
];

// ─── Mock Data Generator ───────────────────────────────────────────────────

// ─── Main Component ────────────────────────────────────────────────────────

export function CoinActivityFeed({
  symbol,
  maxHeight = '480px',
  className = '',
}: CoinActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [usedMock, setUsedMock] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevEventIdsRef = useRef<Set<string>>(new Set());

  const fetchActivity = useCallback(
    async (pageNum: number, append = false) => {
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          pageSize: '20',
        });
        if (filter !== 'all') params.set('type', filter);

        const res = await fetch(`/api/coin/${symbol.toLowerCase()}/activity?${params}`);
        if (res.ok) {
          const data = (await res.json()) as {
            events: ActivityEvent[];
            hasMore: boolean;
          };

          // Track new events for animation
          const prevIds = prevEventIdsRef.current;
          const incomingIds = new Set(data.events.map((e) => e.id));
          if (!append && pageNum === 1 && prevIds.size > 0) {
            const brandNew: string[] = [];
            for (const e of data.events) {
              if (!prevIds.has(e.id)) brandNew.push(e.id);
            }
            if (brandNew.length > 0) {
              setNewEventIds(new Set(brandNew));
              setTimeout(() => setNewEventIds(new Set()), 3000);
            }
          }
          prevEventIdsRef.current = incomingIds;

          if (append) {
            setEvents((prev) => [...prev, ...data.events]);
          } else {
            setEvents(data.events);
          }
          setHasMore(data.hasMore);
          setUsedMock(false);
        } else {
          // API failed — use mock fallback
          if (!append) {
            setEvents([]);
            setHasMore(false);
            setUsedMock(true);
          }
        }
      } catch {
        // Network error — use mock fallback
        if (!append) {
          setEvents([]);
          setHasMore(false);
          setUsedMock(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [symbol, filter],
  );

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    setEvents([]);
    setPage(1);
    prevEventIdsRef.current = new Set();
    fetchActivity(1);
  }, [fetchActivity]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (page === 1) fetchActivity(1);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchActivity, page]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivity(nextPage, true);
  }, [page, fetchActivity]);

  const handleFilterChange = useCallback((newFilter: ActivityType | 'all') => {
    setFilter(newFilter);
    setPage(1);
  }, []);

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter);

  return (
    <div
      className={`rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-4 py-3">
        <h3 className="text-xs font-bold text-[var(--color-fg)]">⚡ Live Activity</h3>
        <div className="flex items-center gap-1.5">
          {!usedMock && (
            <span className="flex h-2 w-2 rounded-full bg-degen-400">
              <span className="h-2 w-2 animate-ping rounded-full bg-degen-400 opacity-75" />
            </span>
          )}
          <span className={`text-[9px] ${usedMock ? 'text-amber-400' : 'text-degen-400'}`}>
            {usedMock ? 'PREVIEW' : 'LIVE'}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-glass-border)] px-4 py-2 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.type}
            type="button"
            onClick={() => handleFilterChange(tab.type)}
            className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
              filter === tab.type
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div ref={containerRef} className="overflow-y-auto scrollbar-thin" style={{ maxHeight }}>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-2 text-2xl text-[var(--color-muted)]">🔇</span>
            <p className="text-xs text-[var(--color-muted)]">No activity yet</p>
            <p className="text-[10px] text-[var(--color-muted)]">
              Real-time events will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 p-3">
            {filtered.map((event) => (
              <ActivityRow key={event.id} event={event} isNew={newEventIds.has(event.id)} />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div className="border-t border-[var(--color-glass-border)] px-3 py-2 text-center">
            <button
              type="button"
              onClick={handleLoadMore}
              className="w-full rounded-lg py-2 text-[10px] font-medium text-degen-400 hover:bg-[var(--color-overlay)] transition-all"
            >
              Load More Activity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
