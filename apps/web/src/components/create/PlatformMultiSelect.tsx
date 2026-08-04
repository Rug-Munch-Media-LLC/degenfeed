'use client';

import { usePremium } from '../../hooks/usePremium';
import type { CreatorPlatform } from './format';

/**
 * PlatformMultiSelect — pick where content goes, for both live and VOD.
 *
 * Premium-only platforms (YouTube, Twitch) are gated behind the Pro tier:
 * free users see the lock badge and an upgrade hint; the toggle is disabled.
 */
export function PlatformMultiSelect({
  platforms,
  selected,
  onToggle,
  mode,
  title = 'Publish to',
  subtitle,
}: {
  platforms: CreatorPlatform[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  mode: 'live' | 'vod';
  title?: string;
  subtitle?: string;
}) {
  const { isPremium, loading } = usePremium();

  const premiumLocked = (p: CreatorPlatform) => Boolean(p.premium) && !isPremium;

  return (
    <div className="w-full">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[var(--color-fg)]">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {platforms.map((p) => {
          const locked = premiumLocked(p);
          const isSelected = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={locked}
              onClick={() => onToggle(p.id)}
              aria-pressed={isSelected}
              title={locked ? `${p.label} is a Pro feature` : undefined}
              className={`group relative flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                locked
                  ? 'cursor-not-allowed opacity-60'
                  : isSelected
                    ? 'border-degen-500/40 bg-degen-500/8 shadow-[0_0_12px_rgba(0,255,65,0.05)]'
                    : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/25'
              }`}
            >
              {/* Checkbox */}
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                  isSelected
                    ? 'border-degen-500 bg-degen-500'
                    : 'border-[var(--color-muted)] bg-transparent'
                }`}
                aria-hidden="true"
              >
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <title>Selected</title>
                    <path
                      d="M2.5 6l2.5 2.5 4.5-5"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>

              {/* Icon */}
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: `${p.color}18` }}
                aria-hidden="true"
              >
                {p.icon}
              </span>

              {/* Label */}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[var(--color-fg)]">{p.label}</span>
                  {p.premium && (
                    <span
                      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${
                        isPremium
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-amber-500/10 text-amber-400/80'
                      }`}
                      title={isPremium ? 'Included in your Pro plan' : 'Pro feature'}
                    >
                      {isPremium ? '👑 Pro' : '🔒 Pro'}
                    </span>
                  )}
                </span>
                <span className="block truncate text-[9px] text-[var(--color-muted)]">
                  {p.description}
                </span>
              </span>

              {/* Mode hint */}
              {!locked && (
                <span className="shrink-0 text-[8px] uppercase tracking-wide text-[var(--color-muted)]">
                  {mode === 'live' ? (p.supportsLive ? 'live' : '') : p.supportsVod ? 'vod' : ''}
                </span>
              )}

              {/* Lock overlay for premium */}
              {locked && (
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 text-[9px] font-semibold text-white"
                  aria-hidden="true"
                >
                  🔒 Pro feature
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Upgrade hint when a premium platform is locked */}
      {!loading && platforms.some(premiumLocked) && !isPremium && (
        <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-400/90">
          YouTube &amp; Twitch are{' '}
          <a
            href="/settings#subscription"
            className="font-semibold underline transition-colors hover:text-amber-300"
          >
            Pro features
          </a>{' '}
          — upgrade to stream and publish there too.
        </div>
      )}
    </div>
  );
}

/** Simple selected-platform summary chips. */
export function SelectedPlatformSummary({ selected }: { selected: Set<string> }) {
  if (selected.size === 0) {
    return <span className="text-[10px] text-[var(--color-muted)]">No platforms selected</span>;
  }
  return (
    <span className="text-[10px] text-[var(--color-muted)]">
      {selected.size} platform{selected.size > 1 ? 's' : ''} selected
    </span>
  );
}
