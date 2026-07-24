/**
 * @degenfeed/web — AlgorithmAuditLog
 *
 * Displays the algorithm's decision history — every post scored, its factors,
 * and how the algorithm decided to rank it. Gives users full transparency
 * into the feed algorithm's behavior.
 *
 * Accessible from Settings or from the feed info panel.
 */

'use client';

import type { AlgorithmAuditEntry } from '@degenfeed/feed-core';
import { useCallback, useEffect, useState } from 'react';

// ─── Factor colors (matches AlgorithmTransparency) ────────────────────

const FACTOR_COLORS: Record<string, string> = {
  recency: '#f59e0b',
  popularity: '#ef4444',
  relevance: '#3b82f6',
  niche: '#8b5cf6',
  protocol: '#10b981',
  quality: '#ec4899',
  diversity: '#06b6d4',
  total: '#a855f7',
};

// ─── Individual audit entry card ──────────────────────────────────────

function AuditEntryCard({ entry }: { entry: AlgorithmAuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-overlay)] transition-colors"
      >
        {/* Position badge */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-degen-500/10 text-xs font-bold text-degen-400 tabular-nums">
          #{entry.positionInFeed}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--color-fg)] truncate">
              {entry.author}
            </span>
            <span className="text-[10px] text-[var(--color-muted)]">{entry.protocol}</span>
          </div>
          <p className="text-xs text-[var(--color-muted)] truncate mt-0.5">
            {entry.postPreview}
          </p>
        </div>

        {/* Score */}
        <div className="text-right shrink-0">
          <div className="text-sm font-bold tabular-nums" style={{ color: FACTOR_COLORS.total }}>
            {entry.totalScore.toFixed(3)}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Expand icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-[var(--color-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[var(--color-glass-border)] px-4 py-3 space-y-3">
          {/* Factor bars */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Score Breakdown
            </h4>
            {(Object.entries(entry.breakdown) as [string, number][]])
              .filter(([key]) => key !== 'total' && key !== 'reasons')
              .map(([key, value]) => {
                const color = FACTOR_COLORS[key] ?? '#888';
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-20 text-[10px] capitalize text-[var(--color-muted)]">
                      {key}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-overlay)] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, value * 100)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="w-10 text-right text-[10px] tabular-nums font-medium" style={{ color }}>
                      {(value * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Reasons */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)] mb-1">
              Reasons
            </h4>
            <div className="flex flex-wrap gap-1">
              {entry.breakdown.reasons.map((r, i) => (
                <span
                  key={i}
                  className="rounded-full bg-[var(--color-overlay)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]"
                >
                  {r.factor}: {r.label}
                </span>
              ))}
            </div>
          </div>

          {/* Context */}
          <div className="grid grid-cols-2 gap-2 text-[10px] text-[var(--color-muted)]">
            <div>
              <span className="font-medium text-[var(--color-fg)]">Mode:</span>{' '}
              {entry.algorithmMode}
            </div>
            <div>
              <span className="font-medium text-[var(--color-fg)]">Time:</span>{' '}
              {new Date(entry.timestamp).toLocaleString()}
            </div>
            <div>
              <span className="font-medium text-[var(--color-fg)]">Weights:</span>{' '}
              {Object.entries(entry.weights)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
            </div>
            <div>
              <span className="font-medium text-[var(--color-fg)]">Niches:</span>{' '}
              {entry.niches.slice(0, 3).join(', ') || 'none'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Audit Log Component ─────────────────────────────────────────

export function AlgorithmAuditLogPanel({
  onClose,
}: {
  onClose?: () => void;
}) {
  const [entries, setEntries] = useState<AlgorithmAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'highest'>('newest');

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      // Try server-side audit log first
      const res = await fetch('/api/feed/audit-log', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { entries: AlgorithmAuditEntry[] };
        setEntries(data.entries ?? []);
      }
    } catch {
      // Fallback to local storage audit log
      try {
        const raw = localStorage.getItem('df_algorithm_audit');
        if (raw) setEntries(JSON.parse(raw) as AlgorithmAuditEntry[]);
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const filtered = entries
    .filter((e) => filter === 'all' || e.protocol === filter)
    .sort((a, b) =>
      sortOrder === 'newest'
        ? b.timestamp - a.timestamp
        : b.totalScore - a.totalScore,
    );

  const protocols = [...new Set(entries.map((e) => e.protocol))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Algorithm Audit Log</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Every post scored by the algorithm is recorded here for full transparency.
            {entries.length > 0 && ` ${entries.length} entries`}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Close
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-2.5 py-1.5 text-xs text-[var(--color-fg)]"
          aria-label="Filter by protocol"
        >
          <option value="all">All Protocols</option>
          {protocols.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'newest' | 'highest')}
          className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-2.5 py-1.5 text-xs text-[var(--color-fg)]"
          aria-label="Sort order"
        >
          <option value="newest">Newest First</option>
          <option value="highest">Highest Score</option>
        </select>
        <button
          type="button"
          onClick={loadEntries}
          className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-[var(--color-overlay)]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-glass-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {entries.length === 0
              ? 'No audit entries yet. Start browsing your feed to populate the log.'
              : 'No entries match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => (
            <AuditEntryCard key={`${entry.postId}-${entry.timestamp}`} entry={entry} />
          ))}
        </div>
      )}

      {/* Footer stats */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
          <span>
            Showing {filtered.length} of {entries.length} entries
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch('/api/feed/audit-log', {
                  method: 'DELETE',
                  credentials: 'include',
                });
                setEntries([]);
              } catch {
                localStorage.removeItem('df_algorithm_audit');
                setEntries([]);
              }
            }}
            className="underline hover:text-red-400"
          >
            Clear log
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Audit Log Button (for embedding in feed UI) ──────────────────────

export function AuditLogButton({
  onClick,
  entryCount,
}: {
  onClick: () => void;
  entryCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
    >
      <span aria-hidden="true">📋</span>
      <span>Audit Log</span>
      {entryCount !== undefined && entryCount > 0 && (
        <span className="rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[10px] tabular-nums text-degen-400">
          {entryCount}
        </span>
      )}
    </button>
  );
}
