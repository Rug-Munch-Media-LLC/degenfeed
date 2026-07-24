'use client';

export function Step4_WalletSignature({
  onBack,
  onSign,
  signing,
}: {
  onBack: () => void;
  onSign: () => void;
  signing: boolean;
}) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-[var(--color-fg)]">Authorize Registration</h2>
      <p className="mb-5 text-sm text-[var(--color-muted)]">
        Sign one message with your wallet to authorize all registrations. This is a message, not a
        transaction — no gas fee for the signature itself.
      </p>

      <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <h3 className="mb-2 text-sm font-medium text-[var(--color-fg)]">
          You are authorizing DegenFeed to:
        </h3>
        <ul className="space-y-2 text-sm text-[var(--color-muted)]">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">1.</span>
            Create accounts on your behalf on supported protocols
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">2.</span>
            Pay gas fees (Farcaster on Base, Lens on Polygon) using our premium wallet
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">3.</span>
            Transfer all account ownership and keys to your wallet
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-degen-400">4.</span>
            Store your encrypted credentials (recoverable by you only)
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onSign}
          disabled={signing}
          className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)] disabled:opacity-40"
        >
          {signing ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black/80" />
              Signing...
            </span>
          ) : (
            'Sign with Wallet'
          )}
        </button>
      </div>
    </div>
  );
}
