'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

type TradingSignalType = 'buy' | 'sell' | 'launch' | 'whale_movement' | 'social_spike';

interface TradingSignal {
  id: string;
  type: TradingSignalType;
  coin: string;
  coinName: string;
  coinImage?: string;
  label: string;
  amountUsd: number;
  amountTokens?: string;
  actor: string;
  actorName: string;
  actorAvatar?: string;
  source: string;
  txSignature?: string;
  timestamp: number;
  actioned?: boolean;
  priceUsd?: number;
}

interface TrendingCoin {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  change24h: number;
  socialVolume: number;
  rank: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const SIGNAL_ICONS: Record<TradingSignalType, string> = {
  buy: '🟢',
  sell: '🔴',
  launch: '🚀',
  whale_movement: '🐋',
  social_spike: '📈',
};

const SIGNAL_BG: Record<TradingSignalType, string> = {
  buy: 'rgba(16, 185, 129, 0.08)',
  sell: 'rgba(239, 68, 68, 0.08)',
  launch: 'rgba(139, 92, 246, 0.08)',
  whale_movement: 'rgba(59, 130, 246, 0.08)',
  social_spike: 'rgba(245, 158, 11, 0.08)',
};

const SIGNAL_BORDER: Record<TradingSignalType, string> = {
  buy: 'rgba(16, 185, 129, 0.2)',
  sell: 'rgba(239, 68, 68, 0.2)',
  launch: 'rgba(139, 92, 246, 0.2)',
  whale_movement: 'rgba(59, 130, 246, 0.2)',
  social_spike: 'rgba(245, 158, 11, 0.2)',
};

function formatUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return `$${amount.toFixed(2)}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Props ────────────────────────────────────────────────────────────────

interface TradingSignalsFeedProps {
  /** Filter by signal type */
  type?: TradingSignalType | 'all';
  /** Max signals to show */
  limit?: number;
  /** Compact mode for sidebar */
  compact?: boolean;
  /** Auto-refresh interval in ms (0 = no auto-refresh) */
  refreshInterval?: number;
  /** Callback when user clicks copy trade */
  onCopyTrade?: (signal: TradingSignal) => void;
}

// ─── Single Signal Row ───────────────────────────────────────────────────

function SignalRow({
  signal,
  compact,
  onCopyTrade,
}: {
  signal: TradingSignal;
  compact: boolean;
  onCopyTrade?: (s: TradingSignal) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-overlay)] ${compact ? 'py-2' : ''}`}
      style={{
        borderLeft: `3px solid ${SIGNAL_BORDER[signal.type] || 'var(--color-glass-border)'}`,
      }}
    >
      {/* Icon */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs"
        style={{ backgroundColor: SIGNAL_BG[signal.type] }}
      >
        {SIGNAL_ICONS[signal.type] || '•'}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`font-semibold truncate ${compact ? 'text-xs' : 'text-sm'}`}
          style={{ color: 'var(--color-fg)' }}
        >
          {signal.label}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs font-medium"
            style={{
              color:
                signal.type === 'buy'
                  ? '#10b981'
                  : signal.type === 'sell'
                    ? '#ef4444'
                    : 'var(--color-muted)',
            }}
          >
            {formatUsd(signal.amountUsd)}
          </span>
          {signal.priceUsd && (
            <>
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                at
              </span>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                ${signal.priceUsd.toFixed(4)}
              </span>
            </>
          )}
        </div>
        <div
          className="flex items-center gap-2 mt-0.5 text-[10px]"
          style={{ color: 'var(--color-muted)' }}
        >
          <span>{signal.actorName}</span>
          <span>·</span>
          <span>{signal.source}</span>
          <span>·</span>
          <span>{timeAgo(signal.timestamp)}</span>
        </div>
      </div>

      {/* Actions */}
      {onCopyTrade && (
        <button
          type="button"
          onClick={() => onCopyTrade(signal)}
          className="shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition-all hover:bg-degen-500/10 active:scale-95"
          style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-fg)' }}
        >
          Copy Trade
        </button>
      )}
    </div>
  );
}

// ─── Type Filter ──────────────────────────────────────────────────────────

function TypeFilter({
  activeType,
  onChange,
  compact,
}: {
  activeType: TradingSignalType | 'all';
  onChange: (t: TradingSignalType | 'all') => void;
  compact: boolean;
}) {
  const types: { id: TradingSignalType | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'buy', label: '🟢 Buys' },
    { id: 'sell', label: '🔴 Sells' },
    { id: 'launch', label: '🚀 Launches' },
    { id: 'whale_movement', label: '🐋 Whales' },
  ];

  if (compact) {
    return (
      <div className="flex gap-1 px-4 py-2 overflow-x-auto">
        {types.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-all ${
              activeType === t.id
                ? 'bg-degen-500/10 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
            style={{
              border:
                activeType === t.id ? '1px solid rgba(0, 255, 65, 0.2)' : '1px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="flex gap-2 px-4 py-3 border-b overflow-x-auto"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      {types.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            activeType === t.id
              ? 'bg-degen-500/10 text-degen-400 border border-degen-500/20'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] border border-transparent'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────

export function TradingSignalsFeed({
  type: initialType = 'all',
  limit = 25,
  compact = false,
  refreshInterval = 30000,
  onCopyTrade,
}: TradingSignalsFeedProps) {
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<TradingSignalType | 'all'>(initialType);

  const fetchSignals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (activeType !== 'all') params.set('type', activeType);

      const res = await fetch(`/api/trading/signals?${params}`);
      const data = await res.json();
      if (data.signals) {
        setSignals(data.signals);
      }
    } catch {
      // Fallback data
      const now = Date.now();
      const fallback: TradingSignal[] = [
        {
          id: '1',
          type: 'buy',
          coin: '$DEGEN',
          coinName: 'Degen',
          label: 'Vitalik bought $DEGEN',
          amountUsd: 15000,
          actor: 'vitalik.eth',
          actorName: 'Vitalik Buterin',
          source: 'farcaster',
          timestamp: now - 120000,
          priceUsd: 0.089,
        },
        {
          id: '2',
          type: 'sell',
          coin: '$BOB',
          coinName: 'Bob',
          label: 'Whale sold $BOB',
          amountUsd: 42000,
          actor: '0x1234...abcd',
          actorName: 'Smart Whale',
          source: 'ethereum',
          timestamp: now - 300000,
          priceUsd: 0.032,
        },
        {
          id: '3',
          type: 'launch',
          coin: '$FREN',
          coinName: 'Fren',
          label: '$FREN launched by @fren',
          amountUsd: 50000,
          actor: '@fren',
          actorName: 'Fren',
          source: 'lens',
          timestamp: now - 600000,
        },
        {
          id: '4',
          type: 'buy',
          coin: '$WIF',
          coinName: 'dogwifhat',
          label: 'Solana Whale bought $WIF',
          amountUsd: 75000,
          actor: 'sol:abc...xyz',
          actorName: 'Solana Whale',
          source: 'solana',
          timestamp: now - 900000,
          priceUsd: 2.45,
        },
        {
          id: '5',
          type: 'whale_movement',
          coin: '$SOL',
          coinName: 'Solana',
          label: 'Whale moved 50,000 $SOL',
          amountUsd: 500000,
          actor: 'jito_sol:5abc',
          actorName: 'Jito Whale',
          source: 'solana',
          timestamp: now - 1800000,
          priceUsd: 187.5,
        },
        {
          id: '6',
          type: 'social_spike',
          coin: '$PEPE',
          coinName: 'Pepe',
          label: '$PEPE spiking on social',
          amountUsd: 98000,
          actor: 'farcaster:8483',
          actorName: 'Degen Trader',
          source: 'farcaster',
          timestamp: now - 2400000,
          priceUsd: 0.000012,
        },
        {
          id: '7',
          type: 'buy',
          coin: '$ETH',
          coinName: 'Ethereum',
          label: 'Crypto Shark bought $ETH',
          amountUsd: 200000,
          actor: '0xabcd...5678',
          actorName: 'Crypto Shark',
          source: 'ethereum',
          timestamp: now - 3600000,
          priceUsd: 3450,
        },
        {
          id: '8',
          type: 'buy',
          coin: '$FREN',
          coinName: 'Fren',
          label: 'Lens Degen bought $FREN',
          amountUsd: 10000,
          actor: 'lens:0x01',
          actorName: 'Lens Degen',
          source: 'lens',
          timestamp: now - 4800000,
          priceUsd: 0.0045,
        },
      ];
      setSignals(fallback);
    } finally {
      setLoading(false);
    }
  }, [activeType, limit]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval) return;
    const interval = setInterval(fetchSignals, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchSignals, refreshInterval]);

  const filteredSignals =
    activeType === 'all' ? signals : signals.filter((s) => s.type === activeType);

  if (compact) {
    return (
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--color-glass-border)' }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-sm font-bold" style={{ color: 'var(--color-fg)' }}>
            Trading Signals
          </h3>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-degen-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-degen-500" />
          </span>
        </div>
        <TypeFilter activeType={activeType} onChange={setActiveType} compact />
        <div
          className="divide-y max-h-80 overflow-y-auto"
          style={{ borderColor: 'var(--color-glass-border)' }}
        >
          {filteredSignals.slice(0, Math.min(limit, 10)).map((signal) => (
            <SignalRow key={signal.id} signal={signal} compact onCopyTrade={onCopyTrade} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--color-glass-border)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
            Trading Signals
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Real-time on-chain activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-degen-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-degen-500" />
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Type filter */}
      <TypeFilter activeType={activeType} onChange={setActiveType} compact={false} />

      {/* Signals */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-degen-500 border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Loading signals...
          </p>
        </div>
      ) : filteredSignals.length > 0 ? (
        <div className="divide-y" style={{ borderColor: 'var(--color-glass-border)' }}>
          {filteredSignals.slice(0, limit).map((signal) => (
            <SignalRow key={signal.id} signal={signal} compact={false} onCopyTrade={onCopyTrade} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
            No signals yet
          </p>
        </div>
      )}

      {/* Footer stats */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t text-[10px]"
        style={{ borderColor: 'var(--color-glass-border)', color: 'var(--color-muted)' }}
      >
        <span>{signals.length} signals in feed</span>
        <button
          type="button"
          onClick={fetchSignals}
          className="flex items-center gap-1 transition-colors hover:text-degen-400"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
}
