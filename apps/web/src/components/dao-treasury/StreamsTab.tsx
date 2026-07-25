'use client';

import { formatUsd, type StreamCard } from './_helpers';

interface StreamsTabProps {
  streams: StreamCard[];
}

export function StreamsTab({ streams }: StreamsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Active Payment Streams</h2>
        <button
          type="button"
          className="rounded-lg bg-degen-500/20 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          + New Stream
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {streams.map((s) => {
          const remaining = s.duration ? Math.max(0, s.startedAt + s.duration - Date.now()) : null;
          const totalDuration = s.duration || 1;
          const elapsed = Date.now() - s.startedAt;
          const progress = Math.min(100, (elapsed / totalDuration) * 100);
          return (
            <div
              key={s.id}
              className={`rounded-xl border p-4 ${s.paused ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold">{s.label}</div>
                  <div className="text-xs text-[var(--color-muted)] font-mono">
                    {s.recipient.slice(0, 6)}...{s.recipient.slice(-4)}
                  </div>
                </div>
                {s.paused && (
                  <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
                    Paused
                  </span>
                )}
              </div>
              <div className="mb-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Flow Rate</span>
                  <span className="font-medium">{s.monthlyFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">Total Streamed</span>
                  <span className="font-medium">
                    {s.totalStreamed} {s.tokenSymbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-muted)]">USD Value</span>
                  <span className="font-medium">{formatUsd(s.totalStreamedUsd)}</span>
                </div>
              </div>
              {s.duration && (
                <div className="mb-3">
                  <div className="mb-1 flex justify-between text-[10px] text-[var(--color-muted)]">
                    <span>
                      {remaining && remaining > 0
                        ? `${Math.ceil(remaining / 86400000)}d remaining`
                        : 'Ended'}
                    </span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-bg)]">
                    <div
                      className="h-full rounded-full bg-degen-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
                >
                  {s.paused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
