'use client';

import { useCallback, useState } from 'react';
import { formatBondingPrice } from '../../hooks/useBondingCurve';

interface BuySellInterfaceProps {
  /** Current price in USD */
  price: number | null;
  /** Token symbol */
  symbol: string;
  /** Max buy per wallet (anti-snipe) */
  maxPerWallet?: string;
  /** Whether the coin has graduated */
  graduated?: boolean;
  /** Phase label */
  phaseLabel?: string;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Error message */
  error?: string;
  /** Callbacks */
  onBuy?: (amount: string) => void;
  onSell?: (amount: string) => void;
  className?: string;
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
}: BuySellInterfaceProps) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('5');

  // Calculate token estimate
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

  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] ${className}`}
    >
      {/* Tab toggle */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setMode('buy')}
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors relative ${
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
          className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors relative ${
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

      <div className="p-4 space-y-4">
        {/* Phase badge */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[var(--color-accent-glow)] px-3 py-1 text-[10px] font-medium text-degen-400">
            ⚡ {phaseLabel}
          </span>
          {!graduated && maxPerWallet && (
            <span className="text-[10px] text-[var(--color-muted)]">
              Max: {maxPerWallet} per wallet
            </span>
          )}
        </div>

        {/* Amount input */}
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-[var(--color-muted)]">
            Amount ({mode === 'buy' ? 'ETH' : symbol})
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.001"
              disabled={disabled || loading}
              className="input pr-16 text-lg font-bold tabular-nums"
              aria-label={`Amount to ${mode}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--color-muted)]">
              {mode === 'buy' ? 'ETH' : symbol}
            </span>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="flex gap-1.5">
          {PRESET_AMOUNTS.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handlePreset(val)}
              disabled={disabled || loading}
              className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium tabular-nums transition-all ${
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
        <div className="rounded-lg bg-[var(--color-muted-bg)] p-3 space-y-1.5">
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
          <div className="flex justify-between text-xs">
            <span className="text-[var(--color-muted)]">Slippage</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-12 rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-0.5 text-right text-[11px] tabular-nums text-[var(--color-fg)]"
                min="0.1"
                max="50"
                step="0.1"
                aria-label="Slippage percentage"
              />
              <span className="text-[var(--color-muted)]">%</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 p-2.5 text-center text-[11px] font-medium text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!isValid || disabled || loading}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
            mode === 'buy'
              ? 'bg-degen-500 text-black hover:bg-degen-400 hover:shadow-[0_0_24px_rgba(0,255,65,0.35)] active:scale-[0.98]'
              : 'bg-red-500 text-white hover:bg-red-400 hover:shadow-[0_0_24px_rgba(255,0,0,0.25)] active:scale-[0.98]'
          } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:scale-100`}
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
          <div className="flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5">
            <span className="text-[10px]">🛡️</span>
            <span className="text-[10px] text-yellow-400">
              Anti-snipe: max {maxPerWallet} per wallet during prebonding. Fair launch for everyone.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
