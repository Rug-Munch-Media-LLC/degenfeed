'use client';

import Link from 'next/link';
import type { DAOFormState } from './types';
import { MOCK_USER_COINS } from './constants';

interface StepReviewProps {
  form: DAOFormState;
  deploying: boolean;
  deployProgress: number;
  deployed: boolean;
  deployedAddress: string;
  txHash: string;
  snapshotSpaceId: string;
}

export default function StepReview({ form, deploying, deployProgress, deployed, deployedAddress, txHash, snapshotSpaceId }: StepReviewProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
        <h2 className="mb-4 text-sm font-bold text-[var(--color-fg)]">Review Your DAO</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">DAO Name</div>
            <div className="text-sm font-bold text-[var(--color-fg)]">{form.name || 'Unnamed DAO'}</div>
            {form.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {form.tags.map((t) => (
                  <span key={t} className="rounded-full border border-[var(--color-glass-border)] px-1.5 py-0.5 text-[8px] text-[var(--color-muted)]">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">Voting Model</div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              {form.votingModel === 'quadratic' ? 'Quadratic Voting' : '1 Token = 1 Vote'}
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">
              {form.quorumPercent}% quorum · {form.votingPeriodDays}d period{form.timelockDelayHours > 0 ? ` · ${form.timelockDelayHours}h timelock` : ''}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">Treasury</div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              {Math.min(form.threshold, form.signers.length)} of {form.signers.length} multi-sig
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">
              {form.streamingEnabled ? 'Streaming ✓' : ''}{form.streamingEnabled && form.grantProgramEnabled ? ' · ' : ''}{form.grantProgramEnabled ? 'Grants ✓' : ''}
            </div>
          </div>
          <div className="rounded-lg bg-[var(--color-overlay)] p-3">
            <div className="mb-1 text-[10px] font-medium text-[var(--color-muted)]">Token</div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              {form.votingTokenType === 'existing' ? MOCK_USER_COINS.find((c) => c.id === form.existingCoinId)?.symbol || 'Existing coin' : form.newTokenSymbol || 'New token'}
            </div>
            <div className="text-[10px] text-[var(--color-muted)]">
              {form.votingTokenType === 'new' ? `${Number(form.newTokenSupply).toLocaleString()} supply` : 'Existing supply'}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)]">Estimated Gas</span>
          <span className="font-mono text-[11px] font-bold text-[var(--color-accent)]">~0.002 ETH / ~0.01 SOL</span>
        </div>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
          <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)]" style={{ width: '40%' }} />
        </div>
        <div className="mt-1 flex justify-between text-[8px] text-[var(--color-muted)]">
          <span>~$12-25 USD</span>
          <span>varies by network</span>
        </div>
      </div>

      {deploying && (
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5">
          <div className="mb-2 flex items-center justify-between text-[10px]">
            <span className="text-[var(--color-muted)]">Deploying DAO...</span>
            <span className="text-[var(--color-accent)]">{Math.round(deployProgress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--color-glass-border)]">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-secondary)] transition-all duration-500" style={{ width: `${deployProgress}%` }} />
          </div>
        </div>
      )}

      {deployed && (
        <>
          <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="text-sm font-bold text-[var(--color-accent)]">DAO Deployed Successfully!</span>
            </div>
            <div className="space-y-1.5 text-[10px] font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-muted)]">DAO Address:</span>
                <span className="text-[var(--color-fg)]">{deployedAddress.slice(0, 20)}...{deployedAddress.slice(-8)}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(deployedAddress)} className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80" aria-label="Copy DAO address">📋</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-muted)]">Snapshot Space:</span>
                <span className="text-[var(--color-fg)]">{snapshotSpaceId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-muted)]">Tx:</span>
                <span className="text-[var(--color-fg)]">{txHash.slice(0, 20)}...{txHash.slice(-8)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dao/${deployedAddress}`} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-accent-soft)] px-4 py-2 text-[11px] font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition-all">🏛️ View DAO Page</Link>
            <button type="button" onClick={() => navigator.clipboard.writeText(`https://degenfeed.xyz/dao/${form.name.toLowerCase().replace(/\s+/g, '-')}`)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-[var(--color-accent)]/30 transition-all">🔗 Copy Share Link</button>
            {form.votingTokenType === 'new' && (
              <Link href="/creator/studio" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-[11px] font-semibold text-[var(--color-fg)] hover:border-[var(--color-accent)]/30 transition-all">🪙 Add to Creator Coin</Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
