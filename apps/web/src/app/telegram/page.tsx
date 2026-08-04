'use client';

/**
 * Telegram Mini App Page
 *
 * Telegram-optimized Mini App showing user's coins, portfolio,
 * quick buy/sell, and coin activity feed.
 * Optimized for Telegram's 390px in-app browser width.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTelegram } from '../../lib/telegram-provider';

// ─── Types ─────────────────────────────────────────────────────────────

interface UserCoin {
  symbol: string;
  name: string;
  balance: number;
  price: number;
  priceChange24h: number;
  value: number;
}

interface ActivityItem {
  id: string;
  type: 'buy' | 'sell' | 'holder' | 'alert';
  symbol: string;
  text: string;
  timestamp: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

function formatPrice(p: number): string {
  if (p < 0.00001) return '<$0.00001';
  if (p < 0.001) return p.toFixed(6);
  return p.toFixed(4);
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Mock Data ─────────────────────────────────────────────────────────

function generateMockCoins(): UserCoin[] {
  const symbols = ['DEGEN', 'PEPE', 'MOCHI', 'RUG', 'WAGMI', 'GM', 'LFG', 'MOON'];
  return symbols.map((s) => {
    const price = Math.random() * 0.05 + 0.0001;
    const balance = Math.floor(Math.random() * 100000) + 100;
    return {
      symbol: s,
      name: `${s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()} Token`,
      balance,
      price,
      priceChange24h: -30 + Math.random() * 60,
      value: price * balance,
    };
  });
}

function generateMockActivity(): ActivityItem[] {
  const symbols = ['DEGEN', 'PEPE', 'MOCHI', 'RUG'];
  const types: ActivityItem['type'][] = ['buy', 'sell', 'holder', 'alert'];
  return Array.from({ length: 20 }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)] ?? 'alert';
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const texts: Record<ActivityItem['type'], string[]> = {
      buy: [`Bought ${symbol}`, `Purchased more ${symbol}`, `Accumulated ${symbol}`],
      sell: [`Sold some ${symbol}`, `Took profit on ${symbol}`, `Reduced ${symbol} position`],
      holder: [
        `New whale detected in ${symbol}`,
        `${symbol} holder count up`,
        `Big wallet moved ${symbol}`,
      ],
      alert: [`${symbol} price target hit`, `${symbol} volume spike`, `${symbol} trending`],
    };
    const textList = texts[type];
    return {
      id: `act-${i}`,
      type,
      symbol,
      text: textList[Math.floor(Math.random() * textList.length)],
      timestamp: Date.now() - Math.floor(Math.random() * 86400000),
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
}

// ══════════════════════════════════════════════════════════════════════
// PORTFOLIO CARD
// ══════════════════════════════════════════════════════════════════════

function PortfolioCard({ coins }: { coins: UserCoin[] }) {
  const totalValue = coins.reduce((sum, c) => sum + c.value, 0);
  const bestPerformer = useMemo(
    () =>
      coins.reduce(
        (best, c) => (c.priceChange24h > (best?.priceChange24h ?? -Infinity) ? c : best),
        coins[0],
      ),
    [coins],
  );

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--color-fg)]">💰 Portfolio</h2>
        <span className="text-xs text-[var(--color-muted)]">{coins.length} coins</span>
      </div>

      <div className="mb-4">
        <div className="text-2xl font-black tabular-nums text-[var(--color-fg)]">
          ${formatCompact(totalValue)}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px]">
          <span className="text-[var(--color-muted)]">Best: {bestPerformer?.symbol}</span>
          <span className="text-degen-400">+{bestPerformer?.priceChange24h.toFixed(1)}%</span>
        </div>
      </div>

      {/* Coin list */}
      <div className="space-y-2">
        {coins.slice(0, 5).map((coin) => (
          <Link
            key={coin.symbol}
            href={`/coins/${coin.symbol.toLowerCase()}`}
            className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] px-3 py-2 hover:bg-[var(--color-overlay)] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-degen-500/20 to-purple-500/20 text-[9px] font-bold text-degen-400">
                {coin.symbol.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--color-fg)] truncate">
                  {coin.symbol}
                </div>
                <div className="text-[9px] text-[var(--color-muted)]">
                  {formatCompact(coin.balance)} coins
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-medium tabular-nums text-[var(--color-fg)]">
                ${formatCompact(coin.value)}
              </div>
              <div
                className={`text-[9px] font-medium ${
                  coin.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'
                }`}
              >
                {coin.priceChange24h >= 0 ? '+' : ''}
                {coin.priceChange24h.toFixed(1)}%
              </div>
            </div>
          </Link>
        ))}
      </div>

      {coins.length > 5 && (
        <Link
          href="/portfolio"
          className="mt-2 block text-center text-[10px] text-degen-400 hover:underline"
        >
          View all {coins.length} coins →
        </Link>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// QUICK TRADE BAR
// ══════════════════════════════════════════════════════════════════════

function QuickTradeBar({ coins }: { coins: UserCoin[] }) {
  const [selectedCoin, setSelectedCoin] = useState(coins[0]?.symbol ?? '');
  const [tradeAmount, setTradeAmount] = useState('');
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');

  const selected = coins.find((c) => c.symbol === selectedCoin);

  const handleTrade = useCallback(() => {
    if (!tradeAmount || Number(tradeAmount) <= 0) return;
    alert(
      `✅ ${tradeMode === 'buy' ? 'Bought' : 'Sold'} ${tradeAmount} ${selectedCoin} successfully!`,
    );
    setTradeAmount('');
  }, [tradeAmount, selectedCoin, tradeMode]);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">⚡ Quick Trade</h2>

      {/* Coin selector */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {coins.slice(0, 6).map((c) => (
          <button
            key={c.symbol}
            type="button"
            onClick={() => setSelectedCoin(c.symbol)}
            className={`rounded-lg px-2.5 py-1 text-[9px] font-semibold transition-all ${
              selectedCoin === c.symbol
                ? 'bg-degen-500/20 text-degen-400'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {c.symbol}
          </button>
        ))}
      </div>

      {/* Buy/Sell toggle */}
      <div className="mb-3 flex rounded-lg bg-[var(--color-overlay)] p-0.5">
        <button
          type="button"
          onClick={() => setTradeMode('buy')}
          className={`flex-1 rounded-md py-1.5 text-[10px] font-bold transition-all ${
            tradeMode === 'buy' ? 'bg-degen-500/20 text-degen-400' : 'text-[var(--color-muted)]'
          }`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setTradeMode('sell')}
          className={`flex-1 rounded-md py-1.5 text-[10px] font-bold transition-all ${
            tradeMode === 'sell' ? 'bg-red-500/20 text-red-400' : 'text-[var(--color-muted)]'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Price info */}
      {selected && (
        <div className="mb-3 flex items-center justify-between text-[10px]">
          <span className="text-[var(--color-muted)]">{selected.symbol}</span>
          <span className="font-mono text-[var(--color-fg)]">${formatPrice(selected.price)}</span>
          <span
            className={`font-medium ${
              selected.priceChange24h >= 0 ? 'text-degen-400' : 'text-red-400'
            }`}
          >
            {selected.priceChange24h >= 0 ? '+' : ''}
            {selected.priceChange24h.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Amount input */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="0.0"
          value={tradeAmount}
          onChange={(e) => setTradeAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          className="input w-full pr-14 text-xs font-mono"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-[var(--color-muted)]">
          {selectedCoin}
        </span>
      </div>

      {/* Total */}
      {selected && tradeAmount && (
        <div className="mb-3 flex items-center justify-between text-[9px] text-[var(--color-muted)]">
          <span>Total</span>
          <span className="font-mono text-[var(--color-fg)]">
            ${(Number(tradeAmount) * selected.price).toFixed(4)}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={handleTrade}
        disabled={!tradeAmount || Number(tradeAmount) <= 0}
        className={`w-full rounded-xl py-2.5 text-xs font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 ${
          tradeMode === 'buy'
            ? 'bg-gradient-to-r from-degen-600 to-degen-400'
            : 'bg-gradient-to-r from-red-600 to-rose-500'
        }`}
      >
        {tradeMode === 'buy' ? `Buy ${selectedCoin}` : `Sell ${selectedCoin}`}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ACTIVITY FEED
// ══════════════════════════════════════════════════════════════════════

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">📡 Activity</h2>

      <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
        {items.slice(0, 15).map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2"
          >
            <span className="text-sm leading-none mt-0.5">
              {item.type === 'buy'
                ? '🟢'
                : item.type === 'sell'
                  ? '🔴'
                  : item.type === 'holder'
                    ? '👤'
                    : '🔔'}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-[var(--color-fg)]">{item.text}</p>
              <p className="text-[8px] text-[var(--color-muted)]">{timeAgo(item.timestamp)}</p>
            </div>
            <Link
              href={`/coins/${item.symbol.toLowerCase()}`}
              className="shrink-0 text-[8px] text-degen-400 hover:underline"
            >
              {item.symbol}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// BOT COMMANDS REFERENCE
// ══════════════════════════════════════════════════════════════════════

function BotCommandsCard() {
  const commands = [
    { cmd: '/coin', desc: 'Coin info & stats' },
    { cmd: '/price', desc: 'Current price' },
    { cmd: '/buy', desc: 'Buy coins' },
    { cmd: '/sell', desc: 'Sell coins' },
    { cmd: '/holders', desc: 'Holder count' },
    { cmd: '/leaderboard', desc: 'Top holders' },
    { cmd: '/tip @user', desc: 'Send Lightning tip' },
    { cmd: '/alert price', desc: 'Set price alert' },
    { cmd: '/community', desc: 'Open community' },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-fg)]">🤖 Bot Commands</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {commands.map((c) => (
          <div
            key={c.cmd}
            className="rounded-lg border border-[var(--color-glass-border)] px-2.5 py-1.5"
          >
            <code className="text-[9px] font-mono font-semibold text-degen-400">{c.cmd}</code>
            <p className="text-[8px] text-[var(--color-muted)] mt-0.5">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════

export default function TelegramMiniAppPage() {
  const tg = useTelegram();

  const [coins, setCoins] = useState<UserCoin[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'portfolio' | 'trade' | 'activity'>(
    'portfolio',
  );

  useEffect(() => {
    // Load data
    setCoins(generateMockCoins());
    setActivity(generateMockActivity());
    setLoading(false);

    // Signal ready to Telegram
    if (tg.isTelegram && tg.miniApp) {
      tg.miniApp.ready();
    }
  }, [tg.isTelegram, tg.miniApp]);

  // Set up MainButton if available
  useEffect(() => {
    if (!tg.mainButton || !tg.isTelegram) return;
    tg.mainButton.mount();
    tg.mainButton.setParams({ text: 'Open DegenFeed' });
    const offClick = tg.mainButton.onClick(() => {
      window.location.href = 'https://app.degenfeed.xyz';
    });
    tg.mainButton.setParams({ isVisible: true });

    return () => {
      offClick();
      tg.mainButton?.setParams({ isVisible: false });
    };
  }, [tg.mainButton, tg.isTelegram]);

  if (loading) {
    return (
      <div className="mx-auto max-w-md px-3 py-4 space-y-4 animate-pulse">
        <div className="skeleton h-32 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </div>
    );
  }

  return (
    <div
      className="mx-auto min-h-screen max-w-md px-3 py-4 space-y-4"
      style={{
        // Telegram Mini App viewport
        maxWidth: tg.isTelegram ? '100vw' : '420px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-[var(--color-fg)]">DegenFeed</h1>
          <p className="text-[10px] text-[var(--color-muted)]">
            {tg.user
              ? `Hi, ${tg.user.first_name || tg.user.username || 'Crypto Degener'} 👋`
              : 'Your Web3 Social Hub'}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-[9px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Web App ↗
        </Link>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 rounded-xl bg-[var(--color-overlay)] p-0.5">
        {(['portfolio', 'trade', 'activity'] as const).map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={`flex-1 rounded-lg py-2 text-[9px] font-bold capitalize transition-all ${
              activeSection === section
                ? 'bg-[var(--color-card)] text-degen-400 shadow-sm'
                : 'text-[var(--color-muted)]'
            }`}
          >
            {section === 'portfolio' && '💰 '}
            {section === 'trade' && '⚡ '}
            {section === 'activity' && '📡 '}
            {section}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeSection === 'portfolio' && <PortfolioCard coins={coins} />}
      {activeSection === 'trade' && <QuickTradeBar coins={coins} />}
      {activeSection === 'activity' && <ActivityFeed items={activity} />}

      {/* Bot commands reference (always visible at bottom) */}
      {activeSection !== 'trade' && <BotCommandsCard />}

      {/* Footer */}
      <div className="pb-8 text-center text-[8px] text-[var(--color-muted)]">
        <p>DegenFeed — Rug Munch Media LLC</p>
        {tg.isTelegram && (
          <button
            type="button"
            onClick={tg.closeApp}
            className="mt-2 text-degen-400 hover:underline"
          >
            Close Mini App
          </button>
        )}
      </div>
    </div>
  );
}
