'use client';

import type { Level, ReputationRecord } from './types';
import { formatDate } from './types';

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg)] p-2.5">
      <div className="text-xs font-bold text-[var(--color-fg)]">{value}</div>
      <div className="text-[9px] text-[var(--color-muted)]">{label}</div>
      {sub && <div className="text-[8px] text-[var(--color-muted)]">{sub}</div>}
    </div>
  );
}

export function ReputationCard({
  reputation,
  level,
  nextLevel,
  progressToNext,
}: {
  reputation: ReputationRecord;
  level: Level;
  nextLevel: Level | null;
  progressToNext: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
            Reputation Score
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black tabular-nums" style={{ color: level.color }}>
              {reputation.total}
            </span>
            <span className="text-sm text-[var(--color-muted)]">/ 1000</span>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-4xl">{level.icon}</span>
          <span className="text-xs font-bold mt-0.5" style={{ color: level.color }}>
            {level.label}
          </span>
        </div>
      </div>
      {nextLevel && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-[var(--color-muted)] mb-1">
            <span>{level.label}</span>
            <span>Next: {nextLevel.label}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round(progressToNext * 100))}%`,
                backgroundColor: level.color,
              }}
            />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <StatBox label="Votes" value="23" />
        <StatBox label="Proposals" value="3" sub="1 passed" />
        <StatBox label="Streak" value={`${reputation.consecutiveVotes}`} sub="consecutive" />
        <StatBox label="Joined" value={formatDate(reputation.joinedAt)} sub="4 months ago" />
      </div>
    </div>
  );
}
