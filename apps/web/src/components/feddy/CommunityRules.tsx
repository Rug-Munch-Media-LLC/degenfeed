'use client';

import type { FeddyCommunity } from './types';

export function CommunityRules({ community }: { community: FeddyCommunity }) {
  const hasRules = community.rules && community.rules.length > 0;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-[var(--color-fg)]">Rules</h3>

      {!hasRules && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <span className="mb-2 text-3xl">📜</span>
          <p className="text-sm text-[var(--color-muted)]">No rules set for this community yet.</p>
        </div>
      )}

      {hasRules && (
        <ol className="space-y-3">
          {community.rules.map((rule, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-degen-500/15 text-xs font-bold text-degen-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-[var(--color-fg)]">{rule}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
