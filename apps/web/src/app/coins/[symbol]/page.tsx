'use client';

/**
 * Coin Detail Page — Price chart, Buy/Sell, Holder list, Description (TASK 5)
 *
 * Features:
 * - Price chart with timeframes (1h, 24h, 7d, 30d, all)
 * - Buy/Sell interface with slippage configuration
 * - Wallet connection requirement for trading
 * - Trading confirmation modal with gas estimate
 * - Holder leaderboard
 * - Coin description and stats
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────

interface CoinDetail {
  address: string;
  name: string;
  symbol: string;
  chain: 'solana' | 'base';
  description: string;
  image?: string;
  price: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  marketCap: number;
  volume24h: number;
  totalSupply: number;
  holderCount: number;
  graduated: boolean;
  bondingPhase: number;
  creator: string;
  creatorName: string;
  createdAt: number;
  isLive: boolean;
  tags: string[];
  links: { label: string; url: string }[];
}

interface HolderEntry {
  address: string;
  balance: number;
  percentage: number;
  rank: number;
}

interface TradeEntry {
  txHash: string;
  type: 'buy' | 'sell';
  trader: string;
  amount: number;
  price: number;
  timestamp: number;
  usdValue: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

function generateMockDetail(symbol: string): CoinDetail {
  return {
    address: `0x${symbol
      .toLowerCase()
      .split('')
      .map((c) => c.charCodeAt(0).toString(16))
      .join('')
      .slice(0, 40)
      .padEnd(40, '0')}`,
    name: `${symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase()} Token`,
    symbol: symbol.toUpperCase(),
    chain: Math.random() > 0.5 ? 'base' : 'solana',
    description: `A community-driven creator coin launching on DegenFeed with a fair bonding curve. Join the prebonding phase and be part of the journey to graduation!`,
    price: Math.random() * 0.05 + 0.0001,
    priceChange24h: -20 + Math.random() * 50,
    priceChange7d: -30 + Math.random() * 60,
    priceChange30d: -50 + Math.random() * 100,
    marketCap: 10000 + Math.random() * 5000000,
    volume24h: 1000 + Math.random() * 500000,
    totalSupply: 1_000_000_000,
    holderCount: Math.floor(Math.random() * 500) + 10,
    graduated: Math.random() > 0.7,
    bondingPhase: Math.floor(Math.random() * 5),
    creator: `0x${Math.random().toString(16).slice(2, 42)}`,
    creatorName: `${symbol.toLowerCase()}.eth`,
    createdAt: Date.now() - Math.random() * 86400000 * 30,
    isLive: Math.random() > 0.9,
    tags: ['meme', 'social', 'defi'].slice(0, Math.floor(Math.random() * 3) + 1),
    links: [
      { label: 'Website', url: '#' },
      { label: 'Twitter', url: '#' },
      { label: 'Discord', url: '#' },
    ],
  };
}

function generateMockHolders(): HolderEntry[] {
  return Array.from({ length: 30 }, (_, i) => ({
    address: `0x${(i + 1).toString(16).padStart(40, '0')}`,
    balance: Math.floor(Math.random() * 10000000) + 1000,
    percentage: Math.random() * 10,
    rank: i + 1,
  }));
}

function generateMockTrades(): TradeEntry[] {
  return Array.from({ length: 50 }, (_, i) => ({
    txHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
    type: Math.random() > 0.4 ? 'buy' : 'sell',
    trader: `0x${Math.floor(Math.random() * 1000000)
      .toString(16)
      .padStart(40, '0')}`,
    amount: Math.floor(Math.random() * 10000) + 10,
    price: Math.random() * 0.01 + 0.001,
    timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    usdValue: Math.random() * 1000 + 10,
  }));
}

function generatePriceData(days: number): number[] {
  let price = 50;
  return Array.from({ length: days }, () => {
    price = Math.max(5, Math.min(95, price + (Math.random() - 0.48) * 8));
    return price;
  });
}

// ─── Helper Components ────────────────────────────────────────────────

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatPrice(p: number): string {
  if (p < 0.00001) return '<$0.00001';
  if (p < 0.001) return p.toFixed(6);
  return p.toFixed(4);
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Chart Component ──────────────────────────────────────────────────

function PriceChart({
  priceData,
  timeframe,
  onTimeframeChange,
  color,
}: {
  priceData: number[];
  timeframe: string;
  onTimeframeChange: (t: string) => void;
  color: string;
}) {
  const max = Math.max(...priceData, 1);
  const min = Math.min(...priceData, 0);
  const range = max - min || 1;
  const w = 600;
  const h = 200;

  // Build fill path
  const pointStr = priceData
    .map((v, i) => `${(i / (priceData.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');

  const fillPoints = `${pointStr} ${w},${h} 0,${h}`;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-48" preserveAspectRatio="none">
          <polygon points={fillPoints} fill={color} opacity="0.08" />
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={pointStr}
          />
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((y) => (
            <line
              key={y}
              x1={0}
              y1={h - y * h}
              x2={w}
              y2={h - y * h}
              stroke="var(--color-glass-border)"
              strokeWidth="0.5"
              opacity="0.5"
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-center gap-1">
        {['1H', '24H', '7D', '30D', 'ALL'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTimeframeChange(t)}
            className={`rounded-md px-2.5 py-1 text-[10px] font-medium transition-all ${
              timeframe === t
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Trade Confirmation Modal ─────────────────────────────────────────

function TradeConfirmModal({
  type,
  amount,
  symbol,
  price,
  gasEstimate,
  slippage,
  onConfirm,
  onClose,
}: {
  type: 'buy' | 'sell';
  amount: string;
  symbol: string;
  price: number;
  gasEstimate: string;
  slippage: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const totalCost = Number(amount) * price;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--color-fg)]">
            Confirm {type === 'buy' ? 'Buy' : 'Sell'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)]"
          >
            ✕
          </button>
        </div>
        <div className="mb-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Action</span>
            <span className={type === 'buy' ? 'text-degen-400' : 'text-red-400'}>
              {type.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Amount</span>
            <span className="font-mono text-[var(--color-fg)]">
              {amount} {symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Price</span>
            <span className="font-mono text-[var(--color-fg)]">${price.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Total</span>
            <span className="font-mono text-[var(--color-fg)]">${totalCost.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Slippage</span>
            <span className="font-mono text-[var(--color-muted)]">{slippage}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Est. Gas</span>
            <span className="font-mono text-[var(--color-muted)]">{gasEstimate}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-muted)]">Platform Fee</span>
            <span className="font-mono text-[var(--color-muted)]">0.5%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--color-glass-border)] py-2.5 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] ${
              type === 'buy'
                ? 'bg-gradient-to-r from-degen-600 to-degen-400 hover:from-degen-500 hover:to-degen-300'
                : 'bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400'
            }`}
          >
            Confirm {type === 'buy' ? 'Buy' : 'Sell'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

export default function CoinDetailPage() {
  const params = useParams();
  const _router = useRouter();
  const symbol = typeof params.symbol === 'string' ? params.symbol.toUpperCase() : '';

  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [holders, setHolders] = useState<HolderEntry[]>([]);
  const [trades, setTrades] = useState<TradeEntry[]>([]);
  const [timeframe, setTimeframe] = useState('24H');

  // Trade UI
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');
  const [tradeAmount, setTradeAmount] = useState('');
  const [slippage, setSlippage] = useState(1.0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSlippageConfig, setShowSlippageConfig] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'trades' | 'holders' | 'info'>('trades');

  // Price chart data
  const priceData = useMemo(() => {
    const days =
      timeframe === '1H'
        ? 60
        : timeframe === '24H'
          ? 24
          : timeframe === '7D'
            ? 7
            : timeframe === '30D'
              ? 30
              : 365;
    return generatePriceData(days);
  }, [timeframe]);

  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      try {
        // Try real API first
        const res = await fetch(`/api/creator-coin/info?symbol=${symbol}`);
        if (res.ok) {
          const data = await res.json();
          setDetail(data);
        } else {
          setDetail(generateMockDetail(symbol));
        }
      } catch {
        setDetail(generateMockDetail(symbol));
      }
      setHolders(generateMockHolders());
      setTrades(generateMockTrades());
      setLoading(false);
    };
    fetchData();
  }, [symbol]);

  const handleTrade = useCallback(() => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    if (!tradeAmount || Number(tradeAmount) <= 0) {
      alert('Enter an amount');
      return;
    }
    setShowConfirm(true);
  }, [isConnected, tradeAmount]);

  const executeTrade = useCallback(() => {
    console.log(`[Trade] ${tradeMode} ${tradeAmount} ${symbol}`);
    alert(`✅ ${tradeMode === 'buy' ? 'Bought' : 'Sold'} ${tradeAmount} ${symbol} successfully!`);
    setTradeAmount('');
  }, [tradeMode, tradeAmount, symbol]);

  if (loading || !detail) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="skeleton h-8 w-48 rounded-lg mb-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="skeleton h-96 rounded-xl lg:col-span-2" />
          <div className="skeleton h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const isUp = detail.priceChange24h >= 0;
  const chartColor = isUp ? '#00ff41' : '#ff4444';
  const recentTrades = trades.slice(0, 20);
  const topHolders = holders.sort((a, b) => b.balance - a.balance).slice(0, 15);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-2 text-xs text-[var(--color-muted)]">
        <Link href="/coins" className="hover:text-degen-400 transition-colors">
          Coins
        </Link>
        <span>/</span>
        <span className="font-medium text-[var(--color-fg)]">${detail.symbol}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ════════ LEFT: Chart + Info ════════ */}
        <div className="space-y-5 lg:col-span-2">
          {/* Coin Identity */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-degen-500/30 bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-xl font-bold text-degen-400">
              {detail.symbol.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--color-fg)]">{detail.name}</h1>
                <span className="rounded-lg bg-[var(--color-overlay)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--color-muted)]">
                  ${detail.symbol}
                </span>
                {detail.graduated && (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                    ✅ Graduated
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${detail.chain === 'solana' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'}`}
                >
                  {detail.chain === 'solana' ? '◎ Solana' : '⧫ Base'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-muted)] line-clamp-2">
                {detail.description}
              </p>
              <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--color-muted)]">
                <span>
                  by{' '}
                  <span className="font-medium text-[var(--color-fg)]">{detail.creatorName}</span>
                </span>
                <span>{shortenAddress(detail.creator)}</span>
                {detail.isLive && (
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    LIVE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Price Chart Card */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            {/* Price header */}
            <div className="mb-3 flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-black tabular-nums text-[var(--color-fg)]">
                  ${formatPrice(detail.price)}
                </div>
                <div
                  className={`flex items-center gap-2 text-xs font-semibold ${isUp ? 'text-degen-400' : 'text-red-400'}`}
                >
                  <span>
                    {isUp ? '+' : ''}
                    {detail.priceChange24h.toFixed(2)}% (24h)
                  </span>
                  <span className="text-[var(--color-muted)]">
                    Volume: ${formatCompact(detail.volume24h)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
                <span>MCap: ${formatCompact(detail.marketCap)}</span>
                <span>{detail.holderCount} holders</span>
              </div>
            </div>
            <PriceChart
              priceData={priceData}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              color={chartColor}
            />
          </div>

          {/* Details Tabs */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
            {/* Tab bar */}
            <div className="flex border-b border-[var(--color-glass-border)]">
              {(['trades', 'holders', 'info'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2.5 text-[10px] font-semibold capitalize transition-all ${
                    activeTab === tab
                      ? 'border-b-2 border-degen-400 text-degen-400'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {tab === 'trades' && '⚡'} {tab === 'holders' && '👥'} {tab === 'info' && 'ℹ️'}
                  {tab}
                </button>
              ))}
            </div>

            <div className="p-3 max-h-80 overflow-y-auto scrollbar-thin">
              {/* Recent Trades */}
              {activeTab === 'trades' && (
                <div className="divide-y divide-[var(--color-glass-border)]">
                  {recentTrades.length === 0 && (
                    <p className="py-4 text-center text-[10px] text-[var(--color-muted)]">
                      No trades yet
                    </p>
                  )}
                  {recentTrades.map((t) => (
                    <div
                      key={t.txHash}
                      className="flex items-center justify-between py-2 text-[10px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${t.type === 'buy' ? 'bg-degen-400' : 'bg-red-400'}`}
                        />
                        <span
                          className={`font-semibold ${t.type === 'buy' ? 'text-degen-400' : 'text-red-400'}`}
                        >
                          {t.type === 'buy' ? 'BUY' : 'SELL'}
                        </span>
                        <span className="font-mono text-[var(--color-muted)]">
                          {shortenAddress(t.trader)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-[var(--color-fg)]">
                          {formatCompact(t.amount)}
                        </span>
                        <span className="tabular-nums text-[var(--color-muted)]">
                          ${t.usdValue.toFixed(2)}
                        </span>
                        <span className="text-[var(--color-muted)]">{timeAgo(t.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Holders */}
              {activeTab === 'holders' && (
                <div className="divide-y divide-[var(--color-glass-border)]">
                  {topHolders.map((h) => (
                    <div
                      key={h.address}
                      className="flex items-center justify-between py-2 text-[10px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-4 text-center font-bold ${h.rank <= 3 ? 'text-degen-400' : 'text-[var(--color-muted)]'}`}
                        >
                          {h.rank <= 3 ? ['🥇', '🥈', '🥉'][h.rank - 1] : `#${h.rank}`}
                        </span>
                        <span className="font-mono text-[var(--color-fg)]">
                          {shortenAddress(h.address)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums text-[var(--color-fg)]">
                          {formatCompact(h.balance)}
                        </span>
                        <span className="w-10 text-right text-[var(--color-muted)]">
                          {h.percentage.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Info */}
              {activeTab === 'info' && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Contract</span>
                    <span className="font-mono text-[var(--color-fg)]">
                      {shortenAddress(detail.address)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Chain</span>
                    <span className="text-[var(--color-fg)]">
                      {detail.chain === 'solana' ? 'Solana' : 'Base'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Total Supply</span>
                    <span className="font-mono text-[var(--color-fg)]">
                      {formatCompact(detail.totalSupply)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Bonding Phase</span>
                    <span className="text-[var(--color-fg)]">
                      Phase {detail.bondingPhase + 1}/5
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Status</span>
                    <span className={detail.graduated ? 'text-green-400' : 'text-amber-400'}>
                      {detail.graduated ? 'Graduated to DEX' : 'Bonding'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Creator</span>
                    <span className="text-[var(--color-fg)]">{detail.creatorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-muted)]">Platform Fee</span>
                    <span className="text-[var(--color-muted)]">0.5%</span>
                  </div>
                  {detail.tags.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-muted)]">Tags</span>
                      <div className="flex gap-1">
                        {detail.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[9px] text-[var(--color-muted)]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ════════ RIGHT: Buy/Sell ════════ */}
        <div className="space-y-4">
          {/* Trade Card */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
            {/* Buy/Sell Toggle */}
            <div className="mb-4 flex rounded-xl bg-[var(--color-overlay)] p-0.5">
              <button
                type="button"
                onClick={() => setTradeMode('buy')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${tradeMode === 'buy' ? 'bg-degen-500/20 text-degen-400 shadow-sm' : 'text-[var(--color-muted)]'}`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setTradeMode('sell')}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${tradeMode === 'sell' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-[var(--color-muted)]'}`}
              >
                Sell
              </button>
            </div>

            {/* Price */}
            <div className="mb-4 text-center">
              <div className="text-lg font-black tabular-nums text-[var(--color-fg)]">
                ${formatPrice(detail.price)}
              </div>
              <div className={`text-xs font-semibold ${isUp ? 'text-degen-400' : 'text-red-400'}`}>
                {isUp ? '+' : ''}
                {detail.priceChange24h.toFixed(2)}%
              </div>
            </div>

            {/* Amount Input */}
            <label className="mb-3 block">
              <span className="mb-1 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
                <span>Amount</span>
                <span>Balance: —</span>
              </span>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0.0"
                  value={tradeAmount}
                  onChange={(e) => setTradeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="input w-full pr-14 text-sm font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--color-muted)]">
                  {detail.symbol}
                </span>
              </div>
            </label>

            {/* Total */}
            <div className="mb-3 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
              <span>Total</span>
              <span className="font-mono text-[var(--color-fg)]">
                ${(Number(tradeAmount || 0) * detail.price).toFixed(4)}
              </span>
            </div>

            {/* Slippage */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSlippageConfig(!showSlippageConfig)}
                  className="flex items-center gap-1 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
                >
                  ⚙️ Slippage: {slippage}%
                </button>
                <span className="text-[9px] text-[var(--color-muted)]">Platform fee: 0.5%</span>
              </div>
              {showSlippageConfig && (
                <div className="mt-2 flex items-center gap-1">
                  {[0.5, 1.0, 2.0, 3.0, 5.0].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSlippage(s);
                        setShowSlippageConfig(false);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[9px] font-medium transition-all ${
                        slippage === s
                          ? 'bg-degen-500/15 text-degen-400'
                          : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Wallet Connect / Trade Button */}
            {!isConnected ? (
              <button
                type="button"
                onClick={() => setIsConnected(true)}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 text-xs font-bold text-white transition-all hover:from-purple-500 hover:to-blue-500 active:scale-[0.98]"
              >
                Connect Wallet to Trade
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTrade}
                disabled={!tradeAmount || Number(tradeAmount) <= 0}
                className={`w-full rounded-xl py-3 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 ${
                  tradeMode === 'buy'
                    ? 'bg-gradient-to-r from-degen-600 to-degen-400 hover:from-degen-500 hover:to-degen-300'
                    : 'bg-gradient-to-r from-red-600 to-rose-500 hover:from-red-500 hover:to-rose-400'
                }`}
              >
                {tradeMode === 'buy' ? `Buy ${detail.symbol}` : `Sell ${detail.symbol}`}
              </button>
            )}
          </div>

          {/* Quick Stats */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <div className="text-[var(--color-muted)]">Market Cap</div>
                <div className="font-semibold tabular-nums text-[var(--color-fg)]">
                  ${formatCompact(detail.marketCap)}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-muted)]">24h Volume</div>
                <div className="font-semibold tabular-nums text-[var(--color-fg)]">
                  ${formatCompact(detail.volume24h)}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-muted)]">Holders</div>
                <div className="font-semibold tabular-nums text-[var(--color-fg)]">
                  {detail.holderCount}
                </div>
              </div>
              <div>
                <div className="text-[var(--color-muted)]">7d Change</div>
                <div
                  className={`font-semibold tabular-nums ${detail.priceChange7d >= 0 ? 'text-degen-400' : 'text-red-400'}`}
                >
                  {detail.priceChange7d >= 0 ? '+' : ''}
                  {detail.priceChange7d.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Creator info */}
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-[10px] font-bold text-degen-400">
                {detail.creatorName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-semibold text-[var(--color-fg)]">
                  {detail.creatorName}
                </div>
                <div className="text-[9px] text-[var(--color-muted)]">
                  {shortenAddress(detail.creator)}
                </div>
              </div>
              <Link
                href={`/coins?q=${detail.creatorName}`}
                className="ml-auto text-[9px] text-degen-400 hover:underline"
              >
                View coins →
              </Link>
            </div>
          </div>

          {/* Bonding progress */}
          {!detail.graduated && (
            <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
              <div className="mb-2 flex items-center justify-between text-[10px]">
                <span className="font-medium text-[var(--color-fg)]">Bonding Progress</span>
                <span className="text-[var(--color-muted)]">Phase {detail.bondingPhase + 1}/5</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-degen-500 via-yellow-500 to-orange-500"
                  style={{ width: `${(detail.bondingPhase + 1) * 20}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[8px] text-[var(--color-muted)]">
                <span>Steal Deal</span>
                <span>Early Bird</span>
                <span>Cruise</span>
                <span>Final Call</span>
                <span>Moonshot</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trade Confirmation Modal */}
      {showConfirm && (
        <TradeConfirmModal
          type={tradeMode}
          amount={tradeAmount}
          symbol={detail.symbol}
          price={detail.price}
          gasEstimate={detail.chain === 'solana' ? '~0.005 SOL' : '~0.001 ETH'}
          slippage={slippage}
          onConfirm={executeTrade}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
