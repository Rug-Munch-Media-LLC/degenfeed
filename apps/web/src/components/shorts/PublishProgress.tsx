'use client';

/**
 * PublishProgress — Per-protocol publish result display.
 *
 * Shows a checklist-style progress of short video publishing to each
 * selected protocol, with success/error states and direct links.
 */

import { PROTOCOL_META, type ShortProtocol } from './protocolMeta';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PublishResult {
  ok: boolean;
  url?: string;
  error?: string;
  protocol: ShortProtocol;
}

interface PublishProgressProps {
  results: Record<string, PublishResult>;
  /** Which protocols are still in-flight */
  pending?: string[];
  /** Optional viewer count estimate per protocol */
  reachEstimate?: number;
  totalProtocols?: number;
}

// ─── Protocol badge icon ──────────────────────────────────────────────────

function ProtocolIcon({ protocol, color }: { protocol: string; color: string }) {
  const icon = PROTOCOL_META[protocol as ShortProtocol]?.icon ?? protocol;
  const fill = color;
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
      style={{ backgroundColor: `${fill}22`, color: fill }}
    >
      {icon.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Progress Indicator ───────────────────────────────────────────────────

function ProgressDot({ state }: { state: 'pending' | 'success' | 'error' }) {
  switch (state) {
    case 'pending':
      return (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-degen-400" />
      );
    case 'success':
      return (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-degen-500/20">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-degen-400">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500/20">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-red-400">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </span>
      );
  }
}

// ─── Main Component ──────────────────────────────────────────────────────

export function PublishProgress({
  results,
  pending = [],
  reachEstimate,
  totalProtocols,
}: PublishProgressProps) {
  const allKeys = [...new Set([...Object.keys(results), ...pending])];

  const completedCount = Object.values(results).filter((r) => r.ok).length;
  const totalCount = totalProtocols ?? allKeys.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary bar */}
      <div className="mb-1 flex items-center justify-between text-xs text-white/60">
        <span>
          Publishing to protocols… {completedCount}/{totalCount}
        </span>
        {reachEstimate != null && (
          <span className="text-degen-400/80">
            ~{reachEstimate.toLocaleString()} potential viewers
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-degen-500 to-degen-400 transition-all duration-700 ease-out"
          style={{ width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }}
        />
      </div>

      {/* Per-protocol results */}
      <div className="mt-1 flex flex-col gap-1">
        {allKeys.map((protocol) => {
          const meta = PROTOCOL_META[protocol as ShortProtocol];
          const label = meta?.label ?? protocol;
          const color = meta?.color ?? '#666';
          const result = results[protocol];
          const isPending = pending.includes(protocol);

          return (
            <div
              key={protocol}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-all ${
                result?.ok
                  ? 'bg-degen-500/5'
                  : result?.error
                    ? 'bg-red-500/5'
                    : 'bg-white/[0.02]'
              }`}
            >
              <ProgressDot
                state={
                  isPending ? 'pending' : result?.ok ? 'success' : result?.error ? 'error' : 'pending'
                }
              />

              <ProtocolIcon protocol={protocol} color={color} />

              <span className="flex-1 font-medium text-white/80">{label}</span>

              {isPending && (
                <span className="text-[10px] text-white/40">publishing…</span>
              )}

              {result?.ok && result?.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-degen-400 transition-colors hover:bg-degen-500/10 hover:border-degen-500/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  View
                </a>
              )}

              {result?.ok && !result?.url && (
                <span className="text-[10px] text-degen-400/60">done</span>
              )}

              {result?.error && (
                <span
                  className="max-w-[140px] truncate text-[10px] text-red-400/80"
                  title={result.error}
                >
                  {result.error}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
