'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBondingPrice } from '../../hooks/useBondingCurve';
import { useIsMobile, useKeyboardHeight } from '../../hooks/useMobileResponsive';

interface BuySellInterfaceProps {
  price: number | null;
  symbol: string;
  maxPerWallet?: string;
  graduated?: boolean;
  phaseLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  onBuy?: (amount: string) => void;
  onSell?: (amount: string) => void;
  className?: string;

  // == New Features ======================================

  /** Flash sale active */
  flashSaleDiscount?: number;
  /** Creator event info */
  creatorEventDiscount?: number;
  creatorEventMessage?: string;
  /** User's streak days */
  streakDays?: number;
  /** Price 24h ago (for "buy the dip" calculation) */
  price24hAgo?: number;
  /** Whether one-click buy is enabled */
  oneClickEnabled?: boolean;
  /** Toggle one-click buy */
  onToggleOneClick?: () => void;
  /** Schedule recurring buy */
  onScheduleRecurring?: (amount: string, interval: 'daily' | 'weekly' | 'monthly') => void;
  /** Set price alert */
  onSetAlert?: (targetPrice: number, above: boolean) => void;
}

const PRESET_AMOUNTS = ['0.01', '0.05', '0.1', '0.5', '1'];

export default function BuySellInterface({
  price,
  symbol,
  maxPerWallet = '2 ETH',
  graduated = false,
  phaseLabel = 'Early',
  loading = false,
  disabled = false,
  error,
  onBuy,
  onSell,
  className = '',
  flashSaleDiscount,
  creatorEventDiscount,
  creatorEventMessage,
  streakDays,
  price24hAgo,
  oneClickEnabled,
  onToggleOneClick,
  onScheduleRecurring,
  onSetAlert,
}: BuySellInterfaceProps) {
  const isMobile = useIsMobile();
  const keyboardHeight = useKeyboardHeight();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('5');

  const tokenEstimate = price && amount ? Number.parseFloat(amount) / price : null;

  const handlePreset = useCallback((val: string) => {
    setAmount(val);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!amount || Number.parseFloat(amount) <= 0) return;
    if (mode === 'buy') onBuy?.(amount);
    else onSell?.(amount);
  }, [amount, mode, onBuy, onSell]);

  const isValid = amount && Number.parseFloat(amount) > 0;

  // Scroll input into view when keyboard appears
  useEffect(() => {
    if (keyboardHeight > 0 && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, [keyboardHeight]);

  return (
    <div
      ref={containerRef}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] ${className} ${
        isMobile ? 'w-full' : ''
      }`}
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
    >
      {/* Tab toggle — larger on mobile */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setMode('buy')}
          className={`flex-1 px-4 py-3.5 sm:py-3 text-sm font-semibold transition-colors relative touch-target ${
            mode === 'buy'
              ? 'text-degen-400'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          Buy
          {mode === 'buy' && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-degen-500 shadow-[0_0_8px_rgba(0,255,65,0.6)]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMode('sell')}
          className={`flex-1 px-4 py-3.5 sm:py-3 text-sm font-semibold transition-colors relative touch-target ${
            mode === 'sell'
              ? 'text-red-400'
              : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
          }`}
        >
          Sell
          {mode === 'sell' && (
            <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(255,0,0,0.3)]" />
          )}
        </button>
      </div>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Phase badge + Streak + Social proof */}
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="rounded-full bg-[var(--color-accent-glow)] px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-medium text-degen-400">
            ⚡ {phaseLabel}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Streak badge */}
            {streakDays !== undefined && streakDays >= 2 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[7px] sm:text-[8px] font-medium text-orange-400">
                <span className="animate-streak">🔥</span> {streakDays}d
                {streakDays >= 7 && <span className="text-[6px] ml-0.5 text-degen-400">2x</span>}
              </span>
            )}

            {!graduated && maxPerWallet && (
              <span className="text-[9px] sm:text-[10px] text-[var(--color-muted)]">
                Max: {maxPerWallet}
              </span>
            )}
          </div>
        </div>

        {/* Flash sale banner */}
        {flashSaleDiscount !== undefined && flashSaleDiscount > 0 && (
          <div className="rounded-lg border border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 p-2.5 animate-whale-alert">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-yellow-400">Flash Sale Active!</p>
                <p className="text-[9px] text-yellow-400/70">
                  {flashSaleDiscount}% off — limited time only!
                </p>
              </div>
              <span className="text-[10px] font-bold text-yellow-400 animate-pulse">{flashSaleDiscount}% OFF</span>
            </div>
          </div>
        )}

        {/* Creator event banner */}
        {creatorEventDiscount !== undefined && creatorEventDiscount > 0 && (
          <div className="rounded-lg border border-degen-500/20 bg-gradient-to-r from-degen-500/10 to-purple-500/10 p-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">⭐</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-degen-400">Creator Event!</p>
                <p className="text-[9px] text-degen-400/70 truncate">
                  {creatorEventMessage || 'Special discount from the creator!'}
                </p>
              </div>
              <span className="text-[10px] font-bold text-degen-400">{creatorEventDiscount}% OFF</span>
            </div>
          </div>
        )}

        {/* Amount input */}
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[var(--color-muted)]">
            Amount ({mode === 'buy' ? 'ETH' : symbol})
            <span
              className="ml-1.5 inline-flex cursor-help items-center rounded-full border border-[var(--color-border)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--color-muted)] hover:border-degen-500/30 hover:text-degen-400 transition-colors"
              title="Paired with ETH on Base for simpler trading. No ZORA token needed."
              aria-label="Paired with ETH on Base for simpler trading. No ZORA token needed."
            >
              ⓘ
            </span>
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.001"
              disabled={disabled || loading}
              className="input pr-16 text-base sm:text-lg font-bold tabular-nums"
              aria-label={`Amount to ${mode}`}
              autoComplete="off"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--color-muted)]">
              {mode === 'buy' ? 'ETH' : symbol}
            </span>
          </div>
        </div>

        {/* Preset buttons — responsive grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {PRESET_AMOUNTS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handlePreset(val)}
              disabled={disabled || loading}
              className={`rounded-lg px-2 py-2 sm:py-1.5 text-[11px] font-medium tabular-nums transition-all touch-target ${
                amount === val
                  ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
                  : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)] border border-transparent'
              }`}
            >
              {val}
            </button>
          ))}
        </div>

        {/* Price preview */}
        <div className="rounded-lg bg-[var(--color-muted-bg)] p-2.5 sm:p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-muted)]">Price</span>
            <span className="font-medium tabular-nums text-[var(--color-fg)]">
              {price ? formatBondingPrice(price) : '—'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-muted)]">
              You {mode === 'buy' ? 'receive' : 'send'}
            </span>
            <span className="font-medium tabular-nums text-[var(--color-fg)]">
              {tokenEstimate !== null && tokenEstimate > 0
                ? `${tokenEstimate.toFixed(mode === 'buy' ? 2 : 6)} ${mode === 'buy' ? symbol : 'ETH'}`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span className="text-[var(--color-muted)]">Slippage</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-14 sm:w-12 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 sm:px-1.5 sm:py-0.5 text-right text-[11px] tabular-nums text-[var(--color-fg)]"
                min="0.1"
                max="50"
                step="0.1"
                aria-label="Slippage percentage"
              />
              <span className="text-[var(--color-muted)]">%</span>
            </div>
          </div>
        </div>

        {/* Buy the Dip button */}
        {mode === 'buy' && price24hAgo !== undefined && price24hAgo > 0 && price !== null && price < price24hAgo * 0.95 && (
          <button
            type="button"
            onClick={() => onBuy?.('0.05')}
            disabled={disabled || loading}
            className="w-full rounded-xl py-2.5 text-xs font-bold transition-all touch-target bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30"
          >
            📉 Buy the Dip! Price is {(price24hAgo && price) ? `${Math.round((1 - price / price24hAgo) * 100)}%` : ''} below 24h high
          </button>
        )}

        {/* One-click toggle */}
        {mode === 'buy' && onToggleOneClick && (
          <div className="flex items-center justify-between rounded-lg bg-[var(--color-muted-bg)] px-2.5 py-2">
            <span className="text-[10px] text-[var(--color-muted)]">⚡ One-click buy</span>
            <button
              type="button"
              onClick={onToggleOneClick}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                oneClickEnabled ? 'bg-degen-500' : 'bg-[var(--color-border)]'
              }`}
              aria-label="Toggle one-click buy"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${
                  oneClickEnabled ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        )}

        {/* Recurring / Price alert buttons */}
        {mode === 'buy' && !graduated && (
          <div className="flex gap-1.5">
            {onScheduleRecurring && (
              <button
                type="button"
                onClick={() => onScheduleRecurring(amount || '0.01', 'weekly')}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-[9px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] touch-target"
              >
                🔄 Recurring
              </button>
            )}
            {onSetAlert && (
              <button
                type="button"
                onClick={() => onSetAlert(price ?? 0, true)}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1.5 text-[9px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] touch-target"
              >
                🔔 Price Alert
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 p-2.5 text-center text-[11px] font-medium text-red-400">
            {error}
          </div>
        )}

        {/* Submit button — min-height 48px for touch */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || disabled || loading}
          className={`w-full rounded-xl py-3.5 sm:py-3 text-sm font-bold transition-all touch-target ${
            mode === 'buy'
              ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)] active:scale-[0.98]'
              : 'bg-red-500 text-white hover:bg-red-400 hover:shadow-[0_0_24px_rgba(255,0,0,0.25)] active:scale-[0.98]'
          } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100`}
          style={{ minHeight: 48 }}
        >
          {loading
            ? 'Loading...'
            : disabled
              ? 'Connect Wallet'
              : mode === 'buy'
                ? `Buy ${symbol}`
                : `Sell ${symbol}`}
        </button>

        {/* Anti-snipe info */}
        {mode === 'buy' && !graduated && (
          <div className="flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2 sm:p-2.5">
            <span className="text-[10px] shrink-0">🛡️</span>
            <span className="text-[9px] sm:text-[10px] text-yellow-400">
              Anti-snipe: max {maxPerWallet} per wallet during prebonding.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
