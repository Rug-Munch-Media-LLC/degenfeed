'use client';

/**
 * TipModal — shared tip dialog used by TipButton.
 *
 * Features: chain selector, amount presets, message, confirm, send, success.
 */

import type { SmartChainOption, TipStep } from './useTip';
import {
  CHAIN_ICONS,
  FIAT_PRESETS,
  PROTOCOL_BADGES,
  PROTOCOL_EMOJIS,
  SATS_PRESETS,
} from './useTip';

interface TipModalProps {
  open: boolean;
  step: TipStep;
  /** Author/recipient */
  authorDisplayName: string;
  protocol: string;
  /** Chain & amount state */
  smartChains: SmartChainOption[];
  selectedChain: string;
  onSelectChain: (chain: string) => void;
  chainLoading: boolean;
  selectedAmount: string;
  onSelectAmount: (amount: string) => void;
  isLightning: boolean;
  selectedToken: string;
  onSelectToken: (token: string) => void;
  amountUsd: number;
  tipMessage: string;
  onMessageChange: (msg: string) => void;
  feeEstimate: string;
  /** Wallet state */
  hasEvm: boolean;
  hasSol: boolean;
  /** Send state */
  sending: boolean;
  error: string | undefined;
  txHash: string | undefined;
  explorerUrl: string;
  contentUrl?: string;
  showConfetti: boolean;
  /** Callbacks */
  onContinue: () => void;
  onBack: () => void;
  onSend: () => void;
  onClose: () => void;
  onShareTip: () => void;
}

export default function TipModal({
  open,
  step,
  authorDisplayName,
  protocol,
  smartChains,
  selectedChain,
  onSelectChain,
  chainLoading,
  selectedAmount,
  onSelectAmount,
  isLightning,
  selectedToken,
  onSelectToken,
  amountUsd,
  tipMessage,
  onMessageChange,
  feeEstimate,
  hasEvm,
  hasSol,
  sending,
  error,
  txHash,
  explorerUrl,
  contentUrl,
  showConfetti,
  onContinue,
  onBack,
  onSend,
  onClose,
  onShareTip,
}: TipModalProps) {
  const hasProtocol = PROTOCOL_EMOJIS[protocol];
  const presets = isLightning ? SATS_PRESETS : FIAT_PRESETS;

  if (!open) return null;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex items-center justify-center bg-[var(--color-glass-bg)] p-0 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      aria-modal="true"
      aria-label={`Tip ${authorDisplayName}`}
    >
      <section
        className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
        tabIndex={-1}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            {hasProtocol && (
              <span className="text-sm" title={protocol}>
                {PROTOCOL_EMOJIS[protocol]}
              </span>
            )}
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">
              {step === 'sent' ? '✓ Tip Sent!' : `Tip ${authorDisplayName}`}
            </h2>
            {hasProtocol && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase ${PROTOCOL_BADGES[protocol]?.bg ?? 'bg-gray-900/20'} ${PROTOCOL_BADGES[protocol]?.text ?? 'text-gray-400'} ${PROTOCOL_BADGES[protocol]?.border ?? 'border-gray-900/50'} border`}
              >
                {protocol}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-card)] hover:text-[var(--color-fg)] transition-colors"
            type="button"
            aria-label="Close"
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4">
          {/* Step: select-amount */}
          {step === 'select-amount' && (
            <>
              <div className="mb-4">
                <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                  Chain
                </span>
                {chainLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
                    <span className="text-xs text-[var(--color-muted)]">Finding best chain...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {smartChains.slice(0, 4).map((sc) => (
                      <button
                        key={sc.chain}
                        type="button"
                        onClick={() => onSelectChain(sc.chain)}
                        className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all ${
                          selectedChain === sc.chain
                            ? 'border-degen-500 bg-degen-500/10'
                            : 'border-[var(--color-border)] hover:border-degen-500/30'
                        }`}
                      >
                        <span className="text-lg">{CHAIN_ICONS[sc.chain] ?? '⛓️'}</span>
                        <span className="text-[10px] font-medium text-[var(--color-fg)] capitalize">
                          {sc.chain}
                        </span>
                        {sc.rank === 1 && (
                          <span className="rounded-full bg-degen-500/20 px-1.5 py-0.5 text-[8px] font-medium text-degen-400">
                            Best
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedChain && (
                  <p className="mt-1.5 text-[10px] text-[var(--color-muted)]">
                    Fee: {feeEstimate} &bull; {isLightning ? 'Instant' : 'Fast'} settlement
                  </p>
                )}
              </div>

              <div className="mb-4">
                <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                  Amount {isLightning ? '(sats)' : '(USD)'}
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => onSelectAmount(p.value)}
                      className={`rounded-xl border px-2 py-2.5 text-center transition-all ${
                        selectedAmount === p.value
                          ? 'border-degen-500 bg-degen-500/10'
                          : 'border-[var(--color-border)] hover:border-degen-500/30'
                      }`}
                      aria-label={p.label}
                    >
                      <div className="text-xs font-semibold text-[var(--color-fg)]">{p.label}</div>
                      <div className="text-[9px] text-[var(--color-muted)]">
                        {!isLightning ? p.cryptoLabel : `~$${p.usdEquivalent.toFixed(2)}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label
                  htmlFor="tip-custom-amount"
                  className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Or custom
                </label>
                <div className="relative">
                  <input
                    id="tip-custom-amount"
                    type="text"
                    value={selectedAmount}
                    onChange={(e) => onSelectAmount(e.target.value)}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm font-mono text-[var(--color-fg)] outline-none focus:border-degen-500 transition-colors"
                    placeholder={isLightning ? '50000' : '25'}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)]">
                    {isLightning ? 'sats' : '$'}
                  </span>
                </div>
              </div>

              {!isLightning && selectedChain && (
                <div className="mb-4">
                  <span className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
                    Token
                  </span>
                  <div className="flex gap-2">
                    {['USDC', 'ETH', 'SOL', 'DAI']
                      .filter((t) => {
                        const chainTokens: Record<string, string[]> = {
                          ethereum: ['ETH', 'USDC', 'USDT', 'DAI'],
                          base: ['ETH', 'USDC'],
                          solana: ['SOL', 'USDC'],
                          polygon: ['MATIC', 'USDC'],
                          optimism: ['ETH', 'USDC'],
                          arbitrum: ['ETH', 'USDC'],
                        };
                        return chainTokens[selectedChain]?.includes(t) ?? true;
                      })
                      .map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => onSelectToken(token)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            selectedToken === token
                              ? 'border-degen-500 bg-degen-500/20 text-degen-400'
                              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-degen-500/30'
                          }`}
                        >
                          {token}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {amountUsd > 0 && (
                <p className="mb-3 text-center text-[10px] text-[var(--color-muted)]">
                  &asymp; ${amountUsd.toFixed(2)} USD
                </p>
              )}
              <button
                type="button"
                disabled={!selectedAmount || Number.parseFloat(selectedAmount) <= 0}
                onClick={onContinue}
                className="btn-primary w-full text-sm disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}

          {/* Step: add-message */}
          {step === 'add-message' && (
            <>
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-degen-500/10 px-3 py-2">
                <span className="text-lg">{CHAIN_ICONS[selectedChain] ?? '⛓️'}</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--color-fg)]">
                    {selectedAmount} {isLightning ? 'sats' : selectedToken}
                  </div>
                  <div className="text-[10px] text-[var(--color-muted)]">
                    via {selectedChain} &bull; {feeEstimate} fee
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onBack}
                  className="text-[10px] text-degen-500 hover:text-degen-400"
                >
                  Change
                </button>
              </div>
              <div className="mb-4">
                <label
                  htmlFor="tip-msg"
                  className="mb-2 block text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]"
                >
                  Message <span className="font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  id="tip-msg"
                  value={tipMessage}
                  onChange={(e) => onMessageChange(e.target.value.slice(0, 140))}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-fg)] outline-none resize-none transition-colors focus:border-degen-500"
                  rows={2}
                  placeholder={`Say something to ${authorDisplayName}...`}
                  aria-label="Tip message"
                />
                <span className="mt-1 block text-right text-[10px] text-[var(--color-muted)]">
                  {tipMessage.length}/140
                </span>
              </div>
              {protocol === 'nostr' && (
                <div className="mb-4 rounded-lg bg-purple-900/10 border border-purple-900/50 p-3">
                  <p className="text-xs text-purple-400">
                    ⚡ This tip will be sent as a NIP-57 Lightning Zap on Nostr
                  </p>
                </div>
              )}
              {protocol === 'farcaster' && (
                <div className="mb-4 rounded-lg bg-indigo-900/10 border border-indigo-900/50 p-3">
                  <p className="text-xs text-indigo-400">
                    ◈ This tip will be sent via Farcaster Frame
                  </p>
                </div>
              )}
              {protocol === 'lens' && (
                <div className="mb-4 rounded-lg bg-green-900/10 border border-green-900/50 p-3">
                  <p className="text-xs text-green-400">
                    ◎ This tip uses Lens Protocol collect/open action
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-card)] transition-colors"
                >
                  Back
                </button>
                <button type="button" onClick={onContinue} className="btn-primary flex-1 text-sm">
                  Review Tip
                </button>
              </div>
            </>
          )}

          {/* Step: confirm */}
          {step === 'confirm' && (
            <>
              <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                    Tip Summary
                  </span>
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-[10px] text-degen-500 hover:text-degen-400"
                  >
                    Edit
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Recipient</span>
                    <span className="font-medium text-[var(--color-fg)]">{authorDisplayName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Amount</span>
                    <span className="font-medium text-[var(--color-fg)]">
                      {selectedAmount} {isLightning ? 'sats' : selectedToken}
                      <span className="ml-1 text-[10px] text-[var(--color-muted)]">
                        (&asymp; ${amountUsd.toFixed(2)})
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Chain</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--color-fg)]">
                      {CHAIN_ICONS[selectedChain] ?? ''} {selectedChain}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Fee</span>
                    <span className="text-[var(--color-muted)]">{feeEstimate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-muted)]">Protocol</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[var(--color-fg)]">
                      {PROTOCOL_EMOJIS[protocol] ?? ''} {protocol}
                    </span>
                  </div>
                  {tipMessage && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-muted)]">Message</span>
                      <span className="max-w-[180px] truncate text-right text-[var(--color-fg)]">
                        &ldquo;{tipMessage}&rdquo;
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {selectedChain !== 'lightning' && !hasEvm && !hasSol && (
                <div className="mb-4 rounded-lg border border-yellow-900/50 bg-yellow-900/10 p-3">
                  <p className="text-xs text-yellow-400">
                    Connect your wallet to complete this tip. You'll be prompted to sign a
                    transaction.
                  </p>
                </div>
              )}
              {error && (
                <div className="mb-4 rounded-lg border border-red-900/50 bg-red-900/10 p-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] hover:bg-[var(--color-card)] transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={onSend}
                  disabled={sending}
                  className="btn-primary flex-1 text-sm disabled:opacity-50"
                >
                  {sending ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending...
                    </span>
                  ) : (
                    `Send ${selectedAmount} ${isLightning ? 'sats' : selectedToken}`
                  )}
                </button>
              </div>
            </>
          )}

          {/* Step: sending */}
          {step === 'sending' && (
            <div className="py-8 text-center">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/20">
                <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
              </div>
              <p className="text-sm font-medium text-[var(--color-fg)]">Sending your tip...</p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {selectedChain === 'lightning'
                  ? 'Generating Lightning invoice'
                  : selectedChain === 'solana'
                    ? 'Confirm in your Solana wallet'
                    : 'Confirm in your wallet'}
              </p>
            </div>
          )}

          {/* Step: sent */}
          {step === 'sent' && (
            <>
              {showConfetti && (
                <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute text-xl"
                      style={{
                        animation: `tip-confetti ${0.8 + Math.random() * 0.6}s ease-out forwards`,
                        animationDelay: `${i * 0.04}s`,
                        left: `${20 + Math.random() * 60}%`,
                        top: '40%',
                      }}
                      aria-hidden="true"
                    >
                      {['⚡', '✨', '💎', '🔥', '⭐', '💚', '🎯', '💫', '🚀', '❤️'][i % 10]}
                    </span>
                  ))}
                </div>
              )}
              <div className="py-6 text-center">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-900/30">
                  <span className="text-2xl">{CHAIN_ICONS[selectedChain] ?? '✅'}</span>
                </div>
                <p className="mb-1 text-lg font-bold text-[var(--color-fg)]">Tip sent!</p>
                <p className="text-sm text-[var(--color-muted)]">
                  {selectedAmount} {isLightning ? 'sats' : selectedToken} to {authorDisplayName}
                </p>
                {protocol && (
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    via {protocol} on {selectedChain}
                  </p>
                )}
                {txHash && explorerUrl !== '#' && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-degen-500 hover:text-degen-400"
                  >
                    View on block explorer
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M7 17L17 7M7 7h10v10" />
                    </svg>
                  </a>
                )}
                {contentUrl && (
                  <button
                    type="button"
                    onClick={onShareTip}
                    className="mt-3 w-full rounded-xl border border-degen-500/30 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/10"
                  >
                    Share this tip
                  </button>
                )}
              </div>
              <button type="button" onClick={onClose} className="btn-primary w-full text-sm">
                Done
              </button>
            </>
          )}
        </div>

        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <p className="text-center text-[10px] text-[var(--color-muted)]">
            Powered by DegenFeed &bull; {protocol} on {selectedChain} &bull; No platform fees
          </p>
        </div>

        <style>{`
          @keyframes tip-confetti {
            0% { transform: translateY(0) scale(0.3) rotate(0deg); opacity: 1; }
            40% { transform: translateY(-40px) scale(1.2) rotate(180deg); opacity: 1; }
            100% { transform: translateY(80px) scale(0.4) rotate(360deg); opacity: 0; }
          }
          @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
        `}</style>
      </section>
    </dialog>
  );
}
