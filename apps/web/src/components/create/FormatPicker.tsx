'use client';

import type { VideoFormat } from './format';
import { FORMATS, formatMeta } from './format';

/**
 * FormatPicker — Loops-style (vertical/short) vs traditional (horizontal/long).
 *
 * The single source of truth for format selection, shared by the Live flow
 * and the VOD flow. Big touch-friendly cards with phone/TV mockups.
 */
export function FormatPicker({
  value,
  onChange,
  compact = false,
}: {
  value: VideoFormat;
  onChange: (format: VideoFormat) => void;
  compact?: boolean;
}) {
  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[var(--color-fg)]">Choose a format</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
            Vertical for Loops/TikTok-style, horizontal for YouTube/Twitch-style. You can switch
            anytime.
          </p>
        </div>
      )}
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Video format</legend>
        {FORMATS.map((f) => {
          const isActive = value === f.id;
          const id = `format-${f.id}`;
          return (
            <label
              key={f.id}
              htmlFor={id}
              className={`group relative cursor-pointer rounded-2xl border p-3 text-left transition-all sm:p-4 ${
                isActive
                  ? 'border-degen-500/60 bg-degen-500/10 shadow-[0_0_20px_rgba(0,255,65,0.08)]'
                  : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/30 hover:bg-[var(--color-overlay)]'
              }`}
            >
              <input
                type="radio"
                id={id}
                name="video-format"
                value={f.id}
                checked={isActive}
                onChange={() => onChange(f.id)}
                className="sr-only"
              />
              {/* Device mockup */}
              <div className="mb-3 flex h-24 items-center justify-center rounded-xl bg-black/60 sm:h-28">
                <div
                  className={`relative overflow-hidden rounded-md border border-white/15 ${
                    f.id === 'portrait' ? 'h-20 w-12 sm:h-24 sm:w-14' : 'h-14 w-24 sm:h-16 sm:w-28'
                  }`}
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-degen-500/40 via-purple-500/20 to-transparent" />
                  {/* fake play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="black"
                        aria-hidden="true"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg" aria-hidden="true">
                  {f.emoji}
                </span>
                <div className="min-w-0">
                  <div
                    className={`truncate text-xs font-bold sm:text-sm ${
                      isActive ? 'text-degen-400' : 'text-[var(--color-fg)]'
                    }`}
                  >
                    {f.shortLabel}
                  </div>
                  <div className="text-[9px] text-[var(--color-muted)]">{f.ratioLabel}</div>
                </div>
                <span
                  className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all ${
                    isActive
                      ? 'bg-degen-500 text-black'
                      : 'border border-[var(--color-glass-border)] text-transparent'
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                  >
                    <title>Selected</title>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>

              {!compact && (
                <p className="mt-2 text-[9px] leading-relaxed text-[var(--color-muted)] sm:text-[10px]">
                  {f.description}
                </p>
              )}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

/** Compact inline chips variant — used in the VOD metadata step. */
export function FormatChips({
  value,
  onChange,
}: {
  value: VideoFormat;
  onChange: (format: VideoFormat) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FORMATS.map((f) => {
        const isActive = value === f.id;
        const meta = formatMeta(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            aria-pressed={isActive}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-all ${
              isActive
                ? 'bg-degen-500/20 text-degen-400 ring-1 ring-degen-500/40'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            <span aria-hidden="true">{meta.emoji}</span>
            {f.shortLabel}
            <span className="text-[8px] opacity-60">{meta.ratioLabel}</span>
            {isActive && <span aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
