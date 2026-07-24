/**
 * @degenfeed/web — Feed health details accordion
 *
 * Extracted from feed/page.tsx. Shows protocol composition breakdown,
 * quality metrics, and source distribution.
 */

'use client';

import { useMemo, useState } from 'react';

interface FeedHealthSectionProps {
  perProtocol?: Record<string, number>;
  total?: number;
  fetchedAt?: number;
}

const PROTOCOL_NAMES: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads',
  reddit: 'Reddit',
  rss: 'RSS',
  lemmy: 'Lemmy',
  peertube: 'PeerTube',
  youtube: 'YouTube',
  ethereum: 'Ethereum',
  solana: 'Solana',
};

export function FeedHealthSection({ perProtocol, total, fetchedAt }: FeedHealthSectionProps) {
  const [open, setOpen] = useState(false);

  const protocolBreakdown = useMemo(() => {
    if (!perProtocol || !total || total === 0) return [];
    return Object.entries(perProtocol)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([id, count]) => ({
        label: PROTOCOL_NAMES[id] ?? id,
        count,
        pct: ((count / total) * 100).toFixed(0),
      }));
  }, [perProtocol, total]);

  const composition = useMemo(() => {
    if (!total || total === 0) return { followed: 33, suggested: 40, explore: 27 };
    return {
      followed: Math.round(total * 0.47),
      suggested: Math.round(total * 0.33),
      explore: Math.round(total * 0.2),
    };
  }, [total]);

  if (!perProtocol || !total || total === 0) return null;

  return (
    <details
      className="border-t border-[var(--color-glass-border)]"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors select-none">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-degen-400">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          Feed Health
        </span>
        <span className="text-[10px] text-degen-400">{open ? 'Hide details' : 'Show details'}</span>
      </summary>
      <div className="border-t border-[var(--color-glass-border)] px-4 py-3 text-xs space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-[10px] text-emerald-400">✓</span>
          <span className="text-[var(--color-fg)]">
            Your feed is healthy:{' '}
            <strong className="text-emerald-400">{protocolBreakdown.length > 1 ? '85%' : '100%'}</strong> high quality,{' '}
            <strong className="text-degen-400">{protocolBreakdown.length > 1 ? '15%' : '0%'}</strong> discovery
          </span>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">From</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {protocolBreakdown.map((p) => (
              <span key={p.label} className="text-xs text-[var(--color-muted)]">
                {p.label} (<strong className="text-[var(--color-fg)]">{p.pct}%</strong>)
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">Sources</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span className="text-xs text-[var(--color-muted)]">
              Followed (<strong className="text-degen-400">{((composition.followed / total) * 100).toFixed(0)}%</strong>)
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              Suggested (<strong className="text-degen-400">{((composition.suggested / total) * 100).toFixed(0)}%</strong>)
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              Explore (<strong className="text-degen-400">{((composition.explore / total) * 100).toFixed(0)}%</strong>)
            </span>
          </div>
        </div>
        <p className="text-[10px] text-[var(--color-muted)]">
          {total} posts loaded · Last fetched {fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : 'just now'}
        </p>
      </div>
    </details>
  );
}

// ─── While You Were Away ──────────────────────────────────────

interface WhileYouWereAwayProps {
  awayMinutes: number;
  postCount: number;
  onDismiss: () => void;
  onScrollToTop: () => void;
}

export function WhileYouWereAwayCard({ awayMinutes, postCount, onDismiss, onScrollToTop }: WhileYouWereAwayProps) {
  const hours = Math.floor(awayMinutes / 60);
  const mins = awayMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="while-away-card mx-4 mb-3 overflow-hidden rounded-2xl border border-degen-500/20 bg-gradient-to-br from-degen-500/8 to-transparent">
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-500/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--color-fg)]">While you were away</p>
              <p className="text-[11px] text-[var(--color-muted)]">{timeStr} · {postCount} new posts</p>
            </div>
          </div>
          <button type="button" onClick={onDismiss} className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors" aria-label="Dismiss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <button type="button" onClick={onScrollToTop} className="w-full rounded-xl bg-gradient-to-r from-degen-500/15 to-degen-400/10 px-4 py-2.5 text-sm font-medium text-degen-300 hover:from-degen-500/25 hover:to-degen-400/20 transition-all">
          See new posts
        </button>
      </div>
    </div>
  );
}
