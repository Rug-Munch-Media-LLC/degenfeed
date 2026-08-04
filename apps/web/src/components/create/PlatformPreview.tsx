'use client';

import type { VideoFormat } from './format';
import { formatMeta, platformMeta } from './format';

/**
 * PlatformPreview — show how a video will look on each selected platform.
 *
 * Renders each platform as a framed viewport (9:16 portrait, 16:9 landscape,
 * or the platform's preferred aspect) with lightweight platform chrome so
 * creators can sanity-check crops before publishing.
 */
export function PlatformPreview({
  previewUrl,
  format,
  platforms,
}: {
  previewUrl: string | null;
  format: VideoFormat;
  platforms: string[];
}) {
  if (platforms.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-glass-border)] p-8 text-center">
        <p className="text-xs text-[var(--color-muted)]">
          Select at least one platform to preview how it will look.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--color-fg)]">Platform preview</h3>
        <span className="text-[10px] text-[var(--color-muted)]">
          {formatMeta(format).ratioLabel} · {formatMeta(format).emoji}{' '}
          {formatMeta(format).shortLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {platforms.map((id) => {
          const meta = platformMeta(id);
          const aspect =
            meta.preferredFormat === format ? formatMeta(format).aspect : formatMeta(format).aspect;
          return (
            <div
              key={id}
              className="overflow-hidden rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]"
            >
              {/* Platform chrome */}
              <div className="flex items-center gap-1.5 border-b border-[var(--color-glass-border)] px-2.5 py-1.5">
                <span className="text-[11px]" aria-hidden="true">
                  {meta.icon}
                </span>
                <span className="truncate text-[9px] font-semibold text-[var(--color-fg)]">
                  {meta.label}
                </span>
                {meta.premium && (
                  <span className="ml-auto text-[7px] text-amber-400" title="Pro feature">
                    👑
                  </span>
                )}
              </div>
              {/* Viewport */}
              <div
                className="relative mx-auto bg-black"
                style={{
                  aspectRatio: aspect,
                  maxWidth: '100%',
                }}
              >
                {previewUrl ? (
                  // biome-ignore lint/performance/noImgElement: thumbnail render from object URL
                  <img
                    src={previewUrl}
                    alt={`${meta.label} preview`}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                    <span className="text-xl opacity-40" aria-hidden="true">
                      {meta.icon}
                    </span>
                    <span className="px-3 text-center text-[8px] text-[var(--color-muted)]">
                      Preview after upload
                    </span>
                  </div>
                )}
                {/* Watermark-style overlay for feel */}
                <div className="pointer-events-none absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/40 to-transparent p-2">
                  <span className="rounded bg-black/50 px-1.5 py-0.5 text-[7px] font-medium text-white">
                    {meta.label}
                  </span>
                  <span className="text-[8px] text-white/80" aria-hidden="true">
                    ▶
                  </span>
                </div>
              </div>
              <div className="px-2.5 py-1.5 text-[8px] text-[var(--color-muted)]">
                {meta.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
