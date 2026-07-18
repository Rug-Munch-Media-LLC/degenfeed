import { useState } from 'react';

export interface PaywallRequirement {
  recipient: string;
  amount: string;
  paymentUrl: string;
}

export interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  requirement: PaywallRequirement;
  onVerify: () => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string };
}

export function PaywallModal({ open, onClose, requirement, onVerify }: PaywallModalProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  if (!open) return null;

  const handlePay = () => {
    window.open(requirement.paymentUrl, '_blank', 'noopener,noreferrer');
  };

  const handleVerify = async () => {
    setVerifying(true);
    setResult(null);
    const res = await onVerify();
    setResult(res);
    setVerifying(false);
  };

  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      aria-modal="true"
      aria-label="Paywall"
      role="dialog"
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Unlock content</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
            type="button"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              role="img"
              aria-label="Close icon"
            >
              <title>Close</title>
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">🔒</div>
          <p className="text-sm text-[var(--color-muted)]">This post is locked.</p>
          <p className="text-2xl font-bold text-[var(--color-fg)]">
            Unlock for {requirement.amount} SOL
          </p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={handlePay}
            className="w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-[var(--color-fg)] hover:bg-purple-500 transition-colors"
          >
            Pay with Solana
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3 text-sm font-semibold text-[var(--color-fg)] hover:bg-[var(--color-muted)] transition-colors disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'I have paid — verify'}
          </button>
        </div>
        {result && (
          <p
            className={`mt-3 text-center text-xs ${result.ok ? 'text-green-400' : 'text-red-400'}`}
          >
            {result.ok ? 'Payment verified!' : result.error || 'Verification failed'}
          </p>
        )}
      </div>
    </section>
  );
}
