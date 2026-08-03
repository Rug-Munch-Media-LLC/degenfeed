'use client';

/**
 * PremiumPaymentModal — 5-step subscription checkout
 *
 * Step 1: Select tier (with first-month pricing for Pro)
 * Step 2: Payment method (ETH on Base, USDC on Base, SOL)
 * Step 3: Confirm details
 * Step 4: Transaction (calls API, shows tx hash, waits for confirmation)
 * Step 5: Confirmation / success
 */

import { useCallback, useState } from 'react';
import { type PremiumTier, TIERS, type TierConfig } from '../hooks/usePremium';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

// === Types ===============================================================

type PaymentStep = 'select-tier' | 'payment-method' | 'confirm' | 'processing' | 'success';

type PaymentMethod = 'eth-base' | 'usdc-base' | 'sol' | null;

interface StepProps {
  tier: TierConfig;
  onSelect: (tier: PremiumTier) => void;
}

// === Close icon ==========================================================

function CloseIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
      aria-label="Close"
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

// === Step indicator ======================================================

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i <= current ? 'bg-degen-400 w-6' : 'bg-[var(--color-muted)]/30 w-1.5'
          }`}
        />
      ))}
    </div>
  );
}

// === Step 1: Select Tier =================================================

function StepSelectTier({ onSelect }: { onSelect: (tier: PremiumTier) => void }) {
  const paidTiers = TIERS.filter((t) => t.id !== 'free' && t.id !== 'enterprise');

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Choose your plan</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Upgrade with crypto. Cancel anytime.
        </p>
      </div>

      <div className="grid gap-3">
        {paidTiers.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => onSelect(tier.id)}
            className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all hover:border-degen-500/30 ${
              tier.popular
                ? 'border-degen-500/40 bg-degen-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-card)]'
            }`}
          >
            {tier.popular && (
              <span className="absolute -top-2 -right-2 rounded-full bg-degen-500 px-2 py-0.5 text-[10px] font-bold text-black">
                {tier.badge}
              </span>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--color-fg)]">{tier.name}</h3>
              </div>
              <div className="mt-1">
                <span className="text-2xl font-bold text-degen-400">{tier.price}</span>
              </div>
              {/* Cost breakdown tooltip */}
              {tier.id === 'pro' && (
                <div className="mt-1.5 rounded-lg bg-degen-500/5 border border-degen-500/10 px-3 py-1.5">
                  <p className="text-[11px] text-degen-400/80 leading-relaxed">
                    💡 Covers Farcaster ($5) + Lens ($2) registration fees. No hidden costs.
                  </p>
                </div>
              )}
              <ul className="mt-3 space-y-1">
                {tier.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                    <span className="text-degen-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
                {tier.features.length > 4 && (
                  <li className="text-[10px] text-[var(--color-muted)] pl-5">
                    +{tier.features.length - 4} more features
                  </li>
                )}
              </ul>
            </div>
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-degen-400 mt-1">
              <div className="h-2.5 w-2.5 rounded-full bg-degen-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// === Step 2: Payment Method ==============================================

function StepPaymentMethod({
  tier,
  onSelect,
  onBack,
}: {
  tier: TierConfig;
  onSelect: (method: PaymentMethod) => void;
  onBack: () => void;
}) {
  const methods: Array<{ id: PaymentMethod; label: string; icon: string; desc: string }> = [
    { id: 'eth-base', label: 'ETH on Base', icon: 'Ξ', desc: 'Pay with native ETH on Base L2' },
    { id: 'usdc-base', label: 'USDC on Base', icon: '₮', desc: 'Pay with USDC on Base L2' },
    { id: 'sol', label: 'SOL', icon: '◎', desc: 'Pay with native SOL on Solana' },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Payment method</h2>
        <p className="text-sm text-[var(--color-muted)]">
          {tier.name} — {tier.firstMonthPrice ?? tier.price}
        </p>
      </div>

      <div className="space-y-2">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-left transition-all hover:border-degen-500/30"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-lg text-degen-400">
              {m.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--color-fg)]">{m.label}</div>
              <div className="text-xs text-[var(--color-muted)]">{m.desc}</div>
            </div>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-[var(--color-muted)]"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        ← Back to plans
      </button>
    </div>
  );
}

// === Step 3: Confirm =====================================================

function StepConfirm({
  tier,
  method,
  onConfirm,
  onBack,
}: {
  tier: TierConfig;
  method: PaymentMethod;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const methodLabels: Record<string, string> = {
    'eth-base': 'ETH on Base',
    'usdc-base': 'USDC on Base',
    sol: 'SOL',
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">Confirm subscription</h2>
      </div>

      <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Plan</span>
          <span className="font-semibold text-[var(--color-fg)]">{tier.name}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-muted)]">Payment</span>
          <span className="font-semibold text-[var(--color-fg)]">{methodLabels[method ?? '']}</span>
        </div>
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-muted)]">Amount</span>
            <span className="text-lg font-bold text-degen-400">{tier.price}</span>
          </div>
        </div>
        {tier.id === 'pro' && (
          <div className="rounded-lg bg-degen-500/5 border border-degen-500/10 px-3 py-2">
            <p className="text-[11px] text-degen-400/80 leading-relaxed">
              💡 Your subscription covers the <strong>Farcaster ($5)</strong> and{' '}
              <strong>Lens ($2)</strong> protocol registration fees.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-[var(--color-muted)]">
        Cancel anytime. Your subscription auto-renews monthly at {tier.price}.
      </p>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full rounded-xl bg-degen-500 py-3 text-sm font-bold text-black hover:bg-degen-400 transition-colors"
      >
        Confirm & Pay
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
      >
        ← Change payment method
      </button>
    </div>
  );
}

// === Step 4: Processing ==================================================

function StepProcessing({
  txHash,
  status,
}: {
  txHash: string | null;
  status: 'sending' | 'confirming' | 'confirmed';
}) {
  const statusMessages: Record<string, { text: string; icon: string }> = {
    sending: { text: 'Sending transaction to your wallet…', icon: '✍️' },
    confirming: { text: 'Waiting for confirmation on-chain…', icon: '⏳' },
    confirmed: { text: 'Transaction confirmed!', icon: '✅' },
  };

  const msg = statusMessages[status] ?? { text: 'Processing…', icon: '⏳' };

  return (
    <div className="flex flex-col items-center justify-center py-6 space-y-4">
      <div className="text-3xl">{msg.icon}</div>
      <p className="text-sm font-medium text-[var(--color-fg)]">{msg.text}</p>
      {txHash && (
        <div className="w-full max-w-xs rounded-lg bg-[var(--color-overlay)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-muted)] mb-1">Transaction</p>
          <code className="text-xs font-mono text-degen-400 break-all">{txHash}</code>
        </div>
      )}
      {status !== 'confirmed' && (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
      )}
    </div>
  );
}

// === Step 5: Success =====================================================

function StepSuccess({ tier, onClose }: { tier: TierConfig; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-4 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/20 text-3xl">
        🎉
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold text-[var(--color-fg)]">
          You&apos;re now a {tier.name} subscriber!
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Billing at {tier.price}. Cancel anytime from Settings.
        </p>
      </div>

      <div className="w-full rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] mb-2">
          What&apos;s next
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
            <span className="text-degen-400 mt-0.5">✦</span>
            {tier.features.slice(1, 4).join(' · ')}
          </li>
          {tier.id === 'pro' && (
            <>
              <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                <span className="text-degen-400 mt-0.5">✦</span>
                Your Farcaster ($5) and Lens ($2) registration fees are covered
              </li>
              <li className="flex items-start gap-2 text-xs text-[var(--color-muted)]">
                <span className="text-degen-400 mt-0.5">✦</span>
                Register at /settings to create your accounts
              </li>
            </>
          )}
        </ul>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl bg-degen-500 py-3 text-sm font-bold text-black hover:bg-degen-400 transition-colors"
      >
        Start exploring
      </button>
    </div>
  );
}

// === Main Modal ==========================================================

interface PremiumPaymentModalProps {
  open: boolean;
  onClose: () => void;
  initialTier?: PremiumTier;
  /** Called when payment succeeds and subscription is active */
  onSuccess?: () => void;
}

export function PremiumPaymentModal({
  open,
  onClose,
  initialTier,
  onSuccess,
}: PremiumPaymentModalProps) {
  const { walletAddress } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<PaymentStep>('select-tier');
  const [selectedTier, setSelectedTier] = useState<TierConfig | null>(
    initialTier ? (TIERS.find((t) => t.id === initialTier) ?? null) : null,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'sending' | 'confirming' | 'confirmed'>('sending');

  const totalSteps = 5;
  const currentStepIdx =
    step === 'select-tier'
      ? 0
      : step === 'payment-method'
        ? 1
        : step === 'confirm'
          ? 2
          : step === 'processing'
            ? 3
            : 4;

  // Reset state when modal opens
  const reset = useCallback(() => {
    setStep('select-tier');
    setSelectedTier(initialTier ? (TIERS.find((t) => t.id === initialTier) ?? null) : null);
    setPaymentMethod(null);
    setTxHash(null);
    setTxStatus('sending');
  }, [initialTier]);

  const handleTierSelect = useCallback((tierId: PremiumTier) => {
    const tier = TIERS.find((t) => t.id === tierId);
    if (!tier) return;
    setSelectedTier(tier);
    setStep('payment-method');
  }, []);

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    setPaymentMethod(method);
    setStep('confirm');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedTier || !paymentMethod) return;

    setStep('processing');
    setTxStatus('sending');

    try {
      // Step 1: Call the API to create a payment intent
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tier: selectedTier.id,
          paymentMethod,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errData?.error ?? `Payment failed (${res.status})`);
      }

      const data = (await res.json()) as {
        txHash?: string;
        requiresSignature?: boolean;
        message?: string;
      };

      if (data.txHash) {
        setTxHash(data.txHash);
        setTxStatus('confirming');

        // Poll for confirmation
        const pollInterval = setInterval(async () => {
          try {
            const confirmRes = await fetch(`/api/billing/status?tx=${data.txHash}`, {
              credentials: 'include',
            });
            if (confirmRes.ok) {
              const confirmData = (await confirmRes.json()) as { confirmed?: boolean };
              if (confirmData.confirmed) {
                clearInterval(pollInterval);
                setTxStatus('confirmed');
                setTimeout(() => setStep('success'), 800);
              }
            }
          } catch {
            /* keep polling */
          }
        }, 3000);

        // Timeout after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120_000);
      } else {
        // Instant confirmation (mock/simulated)
        setTxHash(data.txHash ?? '0x0000…simulated');
        setTxStatus('confirmed');
        setTimeout(() => setStep('success'), 800);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Payment failed');
      setStep('confirm');
    }
  }, [selectedTier, paymentMethod, showToast]);

  const handleClose = useCallback(() => {
    const wasSuccessful = step === 'success';
    reset();
    onClose();
    if (wasSuccessful) {
      // Give parent a chance to refresh premium status after successful payment
      onSuccess?.();
    }
  }, [reset, onClose, step, onSuccess]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className={`relative w-full ${
          step === 'processing' ? 'max-w-sm' : step === 'success' ? 'max-w-sm' : 'max-w-md'
        } rounded-t-2xl sm:rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Subscription payment"
      >
        <CloseIcon onClick={handleClose} />

        {/* Progress dots */}
        <StepDots current={currentStepIdx} total={totalSteps} />

        {/* Step content */}
        {step === 'select-tier' && <StepSelectTier onSelect={handleTierSelect} />}

        {step === 'payment-method' && selectedTier && (
          <StepPaymentMethod
            tier={selectedTier}
            onSelect={handleMethodSelect}
            onBack={() => setStep('select-tier')}
          />
        )}

        {step === 'confirm' && selectedTier && paymentMethod && (
          <StepConfirm
            tier={selectedTier}
            method={paymentMethod}
            onConfirm={handleConfirm}
            onBack={() => setStep('payment-method')}
          />
        )}

        {step === 'processing' && <StepProcessing txHash={txHash} status={txStatus} />}

        {step === 'success' && selectedTier && (
          <StepSuccess tier={selectedTier} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}
