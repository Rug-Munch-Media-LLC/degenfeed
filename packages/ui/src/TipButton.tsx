'use client';

/**
 * @degenfeed/ui — TipButton
 *
 * Cross-protocol tipping button. Detects the author's available tip methods
 * (via `GET /api/tipping/detect`), shows the currency options for the post's
 * protocol (via `GET /api/tipping/options`), opens a modal for amount +
 * optional message, then creates the tip via `POST /api/tipping/send`.
 *
 * Protocol coverage:
 *   mastodon, bluesky, nostr, farcaster, lens, solana, ethereum, generic.
 * Currency coverage:
 *   SOL, USDC, ETH, BTC (Lightning zaps), Blinks (Solana Actions), x402.
 */

import { getCurrencyMeta, getDefaultCurrency } from '@degenfeed/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TipCurrencyOption {
  currency: string;
  label: string;
  symbol: string;
  method: string;
  chain?: string;
  fee?: string;
}

export interface TippingDetectResult {
  acceptsTips: boolean;
  preferredCurrency: string;
  methods: TipCurrencyOption[];
  detected: {
    evmAddress?: string;
    solanaAddress?: string;
    lightningAddress?: string;
    cashapp?: string;
  };
}

export interface TippingSendResult {
  success: boolean;
  tipId?: string;
  postId: string;
  protocol: string;
  currency: string;
  method: string;
  amount: number;
  amountUsd: number;
  recipientAddress: string;
  processing: 'intent' | 'invoice' | 'blink' | 'x402' | 'frame' | 'collect';
  intent?: Record<string, unknown>;
  actionUrl?: string;
  instructions?: string;
  error?: string;
}

export interface TipButtonProps {
  /** The post being tipped */
  postId: string;
  /** Protocol of the post: mastodon | bluesky | nostr | farcaster | lens | … */
  protocol: string;
  /** Recipient wallet address / protocol id (from post author) */
  recipientAddress?: string;
  /** Author profile text (bio / description / metadata) for detection */
  authorProfile?: string;
  /** Connected protocols of the VIEWER — used for preferred currency fallback */
  connectedProtocols?: string[];
  /** Override the default tip currency */
  defaultCurrency?: string;
  /** Predefined tip amounts in USD */
  tipAmounts?: number[];
  /** Label shown on the button */
  label?: string;
  /** Optional callback when a tip is successfully created */
  onTipped?: (result: TippingSendResult) => void;
  /** Optional external handler for full wallet flows (opened on "More methods") */
  onOpenModal?: () => void;
  /** Base URL for the API (defaults to same-origin) */
  apiBase?: string;
  className?: string;
}

interface OptionState {
  currencies: TipCurrencyOption[];
  defaultCurrency: string;
}

const PROTOCOL_CURRENCY: Record<string, string> = {
  farcaster: 'base',
  lens: 'matic',
  solana: 'sol',
  ethereum: 'eth',
  nostr: 'btc',
  bluesky: 'eth',
  mastodon: 'eth',
  threads: 'eth',
};

// ─── Component ────────────────────────────────────────────────────────────

export function TipButton({
  postId,
  protocol,
  recipientAddress,
  authorProfile,
  connectedProtocols = [],
  defaultCurrency,
  tipAmounts = [1, 5, 10],
  label = 'Tip',
  onTipped,
  onOpenModal,
  apiBase = '',
  className = '',
}: TipButtonProps) {
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<OptionState | null>(null);
  const [detect, setDetect] = useState<TippingDetectResult | null>(null);
  const [amount, setAmount] = useState(1);
  const [customAmount, setCustomAmount] = useState('');
  const [currency, setCurrency] = useState<string>('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<TippingSendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveCurrency =
    currency ||
    defaultCurrency ||
    detect?.preferredCurrency ||
    PROTOCOL_CURRENCY[protocol] ||
    getDefaultCurrency(connectedProtocols, protocol) ||
    'eth';

  const currencyMeta = getCurrencyMeta(effectiveCurrency);

  // Fetch currency options for this protocol + detect author tips on open.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setDetect(null);
    setOptions(null);
    setDetecting(true);

    const params = new URLSearchParams({ protocol });
    if (recipientAddress) params.set('recipientAddress', recipientAddress);
    if (authorProfile) params.set('profile', authorProfile.slice(0, 4096));

    Promise.all([
      fetch(`${apiBase}/api/tipping/options?${new URLSearchParams({ protocol }).toString()}`, {
        credentials: 'include',
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { currencies?: TipCurrencyOption[]; defaultCurrency?: string } | null) => {
          if (data?.currencies?.length) {
            setOptions({
              currencies: data.currencies,
              defaultCurrency: data.defaultCurrency || '',
            });
          }
        })
        .catch(() => {}),
      fetch(`${apiBase}/api/tipping/detect?${params.toString()}`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: TippingDetectResult | null) => setDetect(data))
        .catch(() => {}),
    ]).finally(() => setDetecting(false));
  }, [open, protocol, recipientAddress, authorProfile, apiBase]);

  const currencies = useMemo(() => {
    if (options?.currencies?.length) return options.currencies;
    if (detect?.methods?.length) return detect.methods;
    return null;
  }, [options, detect]);

  const quickAmounts = tipAmounts;

  const handleAmountSelect = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) setAmount(parsed);
  };

  const effectiveAmount = customAmount ? Number.parseFloat(customAmount) || amount : amount;

  const handleSend = useCallback(async () => {
    if (!recipientAddress) {
      setError('No tip address available for this author');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/tipping/send`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          postId,
          protocol,
          amount: effectiveAmount,
          currency: effectiveCurrency,
          recipientAddress,
          message: message || undefined,
        }),
      });
      const data = (await res.json()) as TippingSendResult & { error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send tip');
      }
      setResult(data);
      onTipped?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }, [
    recipientAddress,
    postId,
    protocol,
    effectiveAmount,
    effectiveCurrency,
    message,
    apiBase,
    onTipped,
  ]);

  const detectedAvailable = detect?.acceptsTips !== false;
  const noAddress =
    !recipientAddress &&
    !detect?.detected?.evmAddress &&
    !detect?.detected?.solanaAddress &&
    !detect?.detected?.lightningAddress;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={sending}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm transition-all duration-[var(--duration-fast)] glow-hover ${
          result
            ? 'bg-green-500/20 text-green-400 animate-tip-pulse'
            : 'hover:bg-primary/10 text-muted-foreground hover:text-primary'
        } ${className}`}
        aria-label={`Tip this ${protocol} post`}
        title={
          detect?.preferredCurrency ? `Tip — ${currencyMeta.label} preferred` : 'Tip the author'
        }
      >
        {sending ? (
          <span className="animate-spin">⚡</span>
        ) : result ? (
          <>
            <span>✓</span>
            <span className="text-green-400">Tipped</span>
          </>
        ) : (
          <>
            <span>⚡</span>
            <span>{label}</span>
          </>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop for modal */}
          <button
            type="button"
            aria-label="Close tip modal"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-xl animate-slide-up">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px]"
                  style={{
                    backgroundColor: `${currencyMeta.color}20`,
                    color: currencyMeta.color,
                  }}
                >
                  {currencyMeta.icon}
                </span>
                <span className="text-sm font-semibold">Send a tip</span>
              </div>
              {detecting && <span className="text-xs text-[var(--color-muted)]">detecting…</span>}
            </div>

            {detect && !detectedAvailable && (
              <p className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                This author may not have tip methods configured — you can still send to a wallet
                address if you have one.
              </p>
            )}
            {noAddress && !detecting && (
              <p className="mb-2 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                No tip address detected for this author.
              </p>
            )}

            {/* Currency selector */}
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Currency
              </p>
              <div className="flex flex-wrap gap-1">
                {(currencies ?? []).map((opt) => {
                  const meta = getCurrencyMeta(opt.currency);
                  return (
                    <button
                      key={opt.currency}
                      type="button"
                      onClick={() => setCurrency(opt.currency)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                        effectiveCurrency === opt.currency
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-primary/30'
                      }`}
                      title={opt.fee ? `Fee: ${opt.fee}` : opt.label}
                    >
                      <span>{meta.icon}</span>
                      <span>{opt.symbol || meta.symbol}</span>
                    </button>
                  );
                })}
                {!currencies && !detecting && (
                  <span className="text-xs text-[var(--color-muted)]">…</span>
                )}
              </div>
            </div>

            {/* Amount selection */}
            <div className="mb-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Amount
              </p>
              <div className="mb-1 flex gap-1">
                {quickAmounts.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleAmountSelect(value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      !customAmount && effectiveAmount === value
                        ? 'bg-primary/15 text-primary'
                        : 'text-[var(--color-muted)] hover:bg-primary/10 hover:text-primary'
                    }`}
                  >
                    ${value}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={customAmount}
                onChange={(e) => handleCustomAmount(e.target.value)}
                placeholder="Custom amount ($)"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-fg)] outline-none focus:border-primary/40"
              />
            </div>

            {/* Message */}
            <div className="mb-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={200}
                placeholder="Message (optional)"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-fg)] outline-none focus:border-primary/40"
              />
            </div>

            {/* Send / result */}
            {error && (
              <p className="mb-2 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
                {error}
              </p>
            )}
            {result ? (
              <div className="rounded-md bg-green-500/10 p-2 text-xs">
                <p className="mb-1 font-semibold text-green-400">
                  ✓ Tip created — ${result.amountUsd.toFixed(2)} ({result.currency.toUpperCase()})
                </p>
                {result.instructions && (
                  <p className="text-[var(--color-muted)]">{result.instructions}</p>
                )}
                {result.actionUrl && (
                  <a
                    href={result.actionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-primary underline"
                  >
                    Open payment link
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || noAddress || detecting}
                className="btn-primary w-full rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {sending ? 'Sending…' : `Tip ${effectiveAmount > 0 ? `$${effectiveAmount}` : ''}`}
              </button>
            )}

            {onOpenModal && (
              <button
                type="button"
                onClick={onOpenModal}
                className="mt-1 w-full rounded-md px-2 py-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                More methods (full wallet flow) →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
