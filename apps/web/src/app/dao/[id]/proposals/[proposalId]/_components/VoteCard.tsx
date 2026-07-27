'use client';

import { formatTimeAgo, shortAddr } from '../../../layout';
import type { VoteChoice, VoteEntry } from '../types';

const choiceColors: Record<VoteChoice, { label: string; color: string; bg: string }> = {
  for: { label: 'FOR', color: 'text-degen-400', bg: 'bg-degen-500/15' },
  against: { label: 'AGAINST', color: 'text-red-400', bg: 'bg-red-500/15' },
  abstain: {
    label: 'ABSTAIN',
    color: 'text-[var(--color-muted)]',
    bg: 'bg-[var(--color-glass-border)]',
  },
};

export function VoteCard({ vote }: { vote: VoteEntry }) {
  const cc = choiceColors[vote.choice];

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-glass-border)] text-sm">
            {vote.voterAvatar}
          </span>
          <div>
            <div className="text-xs font-semibold text-[var(--color-fg)]">
              {shortAddr(vote.voter)}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-muted)]">
              <span>{vote.votingPower.toLocaleString()} votes</span>
              {vote.delegated && (
                <span className="rounded bg-amber-500/10 px-1 text-[8px] text-amber-400">
                  Delegated
                </span>
              )}
            </div>
          </div>
        </div>
        <span className={`rounded-md px-2.5 py-1 text-[9px] font-bold ${cc.bg} ${cc.color}`}>
          {cc.label}
        </span>
      </div>
      {vote.reason && (
        <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">{vote.reason}</p>
      )}
      <div className="mt-2 text-[9px] font-mono text-[var(--color-muted)]">
        {formatTimeAgo(vote.timestamp)}
      </div>
    </div>
  );
}
