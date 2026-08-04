'use client';

/**
 * CreatorCoinComingSoon — reusable "Coming Soon" gate for the creator-coin
 * system. Rendered in place of trade/deploy UI whenever
 * CREATOR_COIN_ENABLED is false, so users see the feature is not launched
 * yet while the rest of the page (chart/info) remains visible.
 *
 * Variants:
 *  - "banner": compact horizontal strip, for full-width page banners.
 *  - "card":   panel that can replace a trade card / sidebar slot.
 *  - "page":   full centered block for dedicated routes (create wizard etc).
 */

interface CreatorCoinComingSoonProps {
  variant?: 'banner' | 'card' | 'page';
  title?: string;
  description?: string;
}

const DEFAULT_TITLE = 'Creator Coins — Coming Soon';
const DEFAULT_DESCRIPTION =
  'The creator-coin system is still in closed testing. Trading and launches will be enabled once the contracts have been verified end-to-end.';

export function CreatorCoinComingSoon({
  variant = 'card',
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
}: CreatorCoinComingSoonProps) {
  if (variant === 'banner') {
    return (
      <div
        className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
        role="status"
      >
        <span className="text-xl" aria-hidden="true">
          🚧
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-amber-400">{title}</p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-[9px] font-semibold text-amber-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          Coming Soon
        </span>
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.03] px-4 py-8 text-center"
        role="status"
      >
        <span className="mb-2 text-2xl" aria-hidden="true">
          🚧
        </span>
        <p className="text-xs font-bold text-[var(--color-fg)]">{title}</p>
        <p className="mt-1.5 max-w-xs text-[10px] leading-relaxed text-[var(--color-muted)]">
          {description}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-[10px] font-semibold text-amber-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
          Not Yet Launched
        </span>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center"
      role="status"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-3xl">
        <span aria-hidden="true">🚧</span>
      </div>
      <h1 className="text-xl font-bold text-[var(--color-fg)]">{title}</h1>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--color-muted)]">
        {description}
      </p>
      <div className="mt-6 flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-[10px] font-semibold text-amber-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Backend live · Frontend gated until verified
      </div>
    </div>
  );
}
