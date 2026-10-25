'use client';

/**
 * @degenfeed/ui — prefill banner and the "this text is too long for X" offer.
 */

export interface PrefillBannerProps {
  label: string;
}

export function PrefillBanner({ label }: PrefillBannerProps) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
      <span
        className="flex-shrink-0 text-xs font-bold text-[var(--color-accent)]"
        aria-hidden="true"
      >
        &#x2194;
      </span>
      <span className="text-[11px] text-[var(--color-fg)]">{label}</span>
      <span className="ml-auto text-[10px] text-[var(--color-muted)]">
        You can edit before posting
      </span>
    </div>
  );
}

export interface TranslationOfferProps {
  text: string;
  targetLabel: string;
  charLimit: number;
  onTranslate: () => void;
}

export function TranslationOffer({
  text,
  targetLabel,
  charLimit,
  onTranslate,
}: TranslationOfferProps) {
  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
      <span
        className="flex-shrink-0 text-xs font-bold text-[var(--color-accent)]"
        aria-hidden="true"
      >
        &#x2194;
      </span>
      <span className="flex-1 text-[11px] text-[var(--color-fg)]">
        This text is {text.length} chars but {targetLabel} allows {charLimit}.{' '}
        <button
          type="button"
          className="underline transition-colors hover:text-[var(--color-accent)]"
          onClick={onTranslate}
        >
          Translate for {targetLabel}
        </button>
      </span>
    </div>
  );
}
