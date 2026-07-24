'use client';

import type { AccountResult, RecoveryAccount, RecoveryPackage } from './types';

function RecoveryCard({ account }: { account: RecoveryAccount }) {
  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-bold text-[var(--color-fg)]">{account.protocol}</span>
      </div>
      {account.identifier && (
        <p className="mb-1 text-xs text-[var(--color-muted)] font-mono truncate">
          {account.identifier}
        </p>
      )}
      <p className="text-[10px] text-degen-400">{account.recoveryMethod}</p>
    </div>
  );
}

export function Step6_Success_RecoveryKeys({
  results,
  recoveryInfo,
  nextSteps,
  onRestart,
}: {
  results: Record<string, AccountResult>;
  recoveryInfo: RecoveryPackage;
  nextSteps: string[];
  onRestart: () => void;
}) {
  const successCount = Object.values(results).filter((r) => r.ok).length;
  const failCount = Object.values(results).filter((r) => !r.ok).length;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500 text-sm text-black font-bold">
          ✓
        </span>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">
          {successCount} Account{failCount > 0 ? '+' : ''} Created!
        </h2>
      </div>
      {failCount > 0 && (
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          {successCount} succeeded, {failCount} had issues (check alternatives below).
        </p>
      )}

      <div className="mb-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
        <p className="text-xs font-medium text-amber-400">⚠️ Save your recovery information</p>
        <p className="text-[11px] text-[var(--color-muted)]">{recoveryInfo.message}</p>
      </div>

      <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">
        Your Accounts &amp; Recovery
      </h3>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {recoveryInfo.accounts.map((acct) => (
          <RecoveryCard key={acct.protocol} account={acct} />
        ))}
      </div>

      <h3 className="mb-2 text-sm font-bold text-[var(--color-fg)]">Next Steps</h3>
      <ul className="mb-6 space-y-1.5">
        {nextSteps.map((step) => (
          <li key={step} className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
            <span className="text-degen-400">{'→'}</span>
            {step}
          </li>
        ))}
      </ul>

      {failCount > 0 && (
        <div className="mb-6 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <p className="mb-1 text-xs font-medium text-amber-400">Free registration alternatives</p>
          <div className="space-y-1 text-[11px] text-[var(--color-muted)]">
            <p>
              🔗{' '}
              <a
                href="https://warpcast.com/~/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-degen-400 hover:underline"
              >
                Farcaster (free on Warpcast)
              </a>
            </p>
            <p>
              ◎{' '}
              <a
                href="https://lens.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-degen-400 hover:underline"
              >
                Lens (free on lens.xyz)
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-lg border border-[var(--color-glass-border)] px-4 py-2 text-sm text-[var(--color-fg)] hover:bg-[var(--color-card)] transition-colors"
        >
          Register Another Wallet
        </button>
        <a
          href="/settings"
          className="rounded-lg bg-degen-500 px-6 py-2 text-sm font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)]"
        >
          Go to Settings
        </a>
      </div>
    </div>
  );
}
