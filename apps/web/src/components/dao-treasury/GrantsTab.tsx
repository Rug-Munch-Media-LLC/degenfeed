'use client';

import { formatUsd, type GrantCard, getStatusBadge, StatCard } from './_helpers';

interface GrantsTabProps {
  grants: GrantCard[];
}

export function GrantsTab({ grants }: GrantsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Grant Programs</h2>
        <button
          type="button"
          className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          + Submit Grant Application
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Distributed" value={formatUsd(55000)} />
        <StatCard label="Active Grants" value="3" />
        <StatCard label="Success Rate" value="80%" color="var(--color-accent)" />
        <StatCard label="Avg. Grant Size" value={formatUsd(13750)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {grants.map((g) => {
          const badge = getStatusBadge(g.status);
          return (
            <div
              key={g.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{g.title}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {g.applicant} · {g.category}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}
                >
                  {badge.label}
                </span>
              </div>
              <div className="mb-3 flex items-center justify-between text-xs">
                <span className="text-[var(--color-muted)]">Requested: {g.requestedAmount}</span>
                <span className="font-medium tabular-nums">
                  {new Date(g.submittedAt).toLocaleDateString()}
                </span>
              </div>
              {g.status !== 'Under Review' && (
                <div>
                  <div className="mb-1 flex justify-between text-[10px] text-[var(--color-muted)]">
                    <span>Milestone Progress</span>
                    <span>{g.progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${g.progress}%`,
                        backgroundColor:
                          g.progress === 100 ? 'var(--color-success)' : 'var(--color-accent)',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
