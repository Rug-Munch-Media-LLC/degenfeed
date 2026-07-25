'use client';

import type { TipMenuOption } from '../types';
import { AMOUNT_PRESETS_SATS, AMOUNT_PRESETS_USD } from '../constants';

export function MenuDropdown({
  options,
  selectedMethod,
  onSelect,
  showAmount,
  amount,
  onAmountChange,
  isLightning,
  selectedOption,
  onSend,
  onConnectAndTip,
  sending,
  sent,
  error,
  evmAccount,
  solAccount,
  isExternalProtocol,
  protocol,
}: {
  options: TipMenuOption[];
  selectedMethod: string | null;
  onSelect: (method: string) => void;
  showAmount: boolean;
  amount: string;
  onAmountChange: (amount: string) => void;
  isLightning: boolean;
  selectedOption: TipMenuOption | undefined;
  onSend: () => void;
  onConnectAndTip: () => void;
  sending: boolean;
  sent: boolean;
  error: string | null;
  evmAccount: string | null;
  solAccount: string | null;
  isExternalProtocol?: boolean;
  protocol?: string;
}) {
  const hasWallet = !!evmAccount || !!solAccount;
  const amountPresets = isLightning ? AMOUNT_PRESETS_SATS : AMOUNT_PRESETS_USD;

  if (sent) {
    return (
      <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-green-900/50 bg-[var(--color-card)] p-4 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-900/30">
            <span className="text-lg">✅</span>
          </div>
          <p className="text-sm font-semibold text-[var(--color-fg)]">Tip sent!</p>
          {selectedOption && (
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
              {amount} {isLightning ? 'sats' : 'USD'} via {selectedOption.label}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl backdrop-blur-xl">
      <div className="max-h-80 overflow-y-auto p-3">
        {isExternalProtocol && protocol && (
          <div className="mb-2 rounded-lg bg-amber-900/10 border border-amber-900/30 px-2.5 py-1.5">
            <p className="text-[10px] text-amber-400">
              🌐 {protocol} content — native tip option shown first
            </p>
          </div>
        )}

        {!hasWallet && (
          <div className="mb-2 rounded-lg bg-blue-900/10 border border-blue-900/30 px-2.5 py-1.5">
            <p className="text-[10px] text-blue-400">Connect wallet for full options</p>
            <button
              type="button"
              onClick={onConnectAndTip}
              className="mt-1 w-full rounded-lg bg-blue-500/20 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-500/30 transition-colors"
            >
              Connect Wallet
            </button>
          </div>
        )}

        <div className="mb-3 space-y-1">
          {options.map((opt) => (
            <button
              key={opt.method}
              type="button"
              onClick={() => {
                if (opt.available) onSelect(opt.method);
                else if (opt.method === 'degenfeed_tip' || opt.method === 'qr_code') onConnectAndTip();
              }}
              disabled={!opt.available && !opt.isBridge}
              className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all ${
                selectedMethod === opt.method
                  ? 'border-degen-500 bg-degen-500/10'
                  : opt.available
                    ? 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-card)]'
                    : 'border-transparent opacity-40 cursor-not-allowed'
              }`}
            >
              <span className="text-base">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-[var(--color-fg)] truncate">{opt.label}</span>
                  {opt.recommended && (
                    <span className="shrink-0 rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[8px] font-medium text-degen-400">Best</span>
                  )}
                  {opt.isNative && (
                    <span className="shrink-0 rounded-full bg-purple-900/20 px-1.5 py-0.5 text-[8px] font-medium text-purple-400">Native</span>
                  )}
                  {opt.isBridge && (
                    <span className="shrink-0 rounded-full bg-cyan-900/20 px-1.5 py-0.5 text-[8px] font-medium text-cyan-400">Bridge</span>
                  )}
                </div>
                <span className="text-[9px] text-[var(--color-muted)] line-clamp-1">{opt.description}</span>
              </div>
              <span className="shrink-0 text-[9px] text-[var(--color-muted)]">{opt.fee}</span>
            </button>
          ))}
        </div>

        {showAmount && selectedMethod && (
          <div className="mb-3">
            <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Amount {isLightning ? '(sats)' : '(USD)'}
            </label>
            <div className="flex gap-1 mb-2">
              {amountPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onAmountChange(preset.value)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-center text-[10px] font-medium transition-all ${
                    amount === preset.value
                      ? 'border-degen-500 bg-degen-500/10 text-degen-400'
                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-degen-500/30'
                  }`}
                >
                  <div>{preset.label}</div>
                  <div className="text-[8px] opacity-60">
                    {isLightning ? `~$${preset.usd.toFixed(2)}` : `${preset.value} USD`}
                  </div>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
              placeholder={isLightning ? '1000' : '10'}
              aria-label="Custom tip amount"
            />
          </div>
        )}

        {selectedOption?.fee && (
          <p className="mb-3 text-[9px] text-[var(--color-muted)] text-center">
            Fee: {selectedOption.fee}
            {selectedOption.chain && ` • ${selectedOption.chain}`}
          </p>
        )}

        {error && (
          <div className="mb-2 rounded-lg bg-red-900/20 border border-red-900/40 px-2.5 py-1.5">
            <p className="text-[10px] text-red-400">{error}</p>
          </div>
        )}

        {selectedMethod && (
          <button
            type="button"
            onClick={onSend}
            disabled={sending || !amount || Number.parseFloat(amount) <= 0}
            className="btn-primary w-full text-xs py-2 disabled:opacity-50"
          >
            {sending ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </span>
            ) : (
              `Send ${amount} ${isLightning ? 'sats' : `$${amount}`}`
            )}
          </button>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] px-3 py-2">
        <p className="text-center text-[8px] text-[var(--color-muted)]">Powered by DegenFeed • No platform fees</p>
      </div>
    </div>
  );
}
