'use client';

/**
 * ProtocolFrame — IFrame or proxied content embed with DegenFeed styling overlay
 *
 * Renders external protocol content inside a sandboxed iframe with:
 * - DegenFeed's glass-morphism border/frame
 * - Protocol-colored accent strip
 * - Loading state with neon spinner
 * - Error fallback
 * - "Open in [protocol]" external link
 * - Responsive sizing (fluid height via aspect ratio or auto)
 */

import { useCallback, useRef, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────

export type FrameSize = 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto';

export interface ProtocolFrameProps {
  /** Protocol identifier */
  protocol: string;
  /** Protocol brand color */
  color: string;
  /** URL to embed */
  src: string;
  /** Protocol display name */
  protocolLabel: string;
  /** Title for the frame */
  title?: string;
  /** Aspect ratio (width/height) — defaults to 16/9 */
  aspectRatio?: number;
  /** If true, renders a sandboxed iframe */
  sandboxed?: boolean;
  /** If provided, overrides the size preset */
  size?: FrameSize;
  /** Optional CSS class to apply to wrapper */
  className?: string;
  /** Callback when iframe loads */
  onLoad?: () => void;
  /** Allow fullscreen */
  allowFullscreen?: boolean;
  /** Custom allow attribute */
  allow?: string;
}

// ─── Size map ───────────────────────────────────────────────────────────

const SIZE_MAP: Record<FrameSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'w-full',
  auto: 'w-full',
};

// ─── Component ──────────────────────────────────────────────────────────

export function ProtocolFrame({
  protocol,
  color,
  src,
  protocolLabel,
  title,
  aspectRatio = 16 / 9,
  sandboxed = true,
  size = 'full',
  className = '',
  onLoad,
  allowFullscreen = true,
  allow = 'clipboard-read; clipboard-write; autoplay; encrypted-media; fullscreen; picture-in-picture',
}: ProtocolFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const handleRetry = useCallback(() => {
    setError(false);
    setLoading(true);
    setFrameKey((k) => k + 1);
  }, []);

  const sizeClass = SIZE_MAP[size] || 'w-full';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${sizeClass} ${className}`}
      style={{
        borderColor: `${color}33`,
        backgroundColor: 'var(--color-card)',
        boxShadow: `0 0 30px ${color}08`,
      }}
    >
      {/* Protocol-colored accent bar */}
      <div
        className="absolute left-0 right-0 top-0 z-10 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${color}, ${color}88, transparent)`,
        }}
        aria-hidden="true"
      />

      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--color-glass-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Protocol dot */}
          <span
            className="inline-flex h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          {/* Title */}
          <span className="truncate text-xs font-medium text-[var(--color-fg-secondary)]">
            {title || `${protocolLabel} — ${protocol}`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Open external */}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors hover:bg-[var(--color-overlay-hover)]"
            style={{ color: 'var(--color-muted)' }}
            title={`Open in ${protocolLabel}`}
          >
            ↗ Open
          </a>
        </div>
      </div>

      {/* Frame body */}
      <div className="relative">
        {/* Loading overlay */}
        {loading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <div
              className="h-8 w-8 animate-spin rounded-full border-2"
              style={{
                borderColor: `${color}33`,
                borderTopColor: color,
              }}
            />
            <span className="text-xs text-[var(--color-muted)]">Loading {protocolLabel}...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            className="flex flex-col items-center justify-center gap-3 px-6 py-12"
            style={{ backgroundColor: 'var(--color-bg)' }}
          >
            <div className="text-2xl">⚠</div>
            <p className="text-sm text-[var(--color-muted)] text-center">
              Could not load {protocolLabel} content.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-lg px-4 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              Retry
            </button>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] underline underline-offset-2"
              style={{ color: 'var(--color-muted)' }}
            >
              Open directly ↗
            </a>
          </div>
        )}

        {/* Iframe */}
        <div
          className={`relative ${loading || error ? 'hidden' : ''}`}
          style={{ aspectRatio: size === 'auto' ? undefined : String(aspectRatio) }}
        >
          <iframe
            key={frameKey}
            ref={iframeRef}
            src={src}
            title={title || `${protocolLabel} embedded content`}
            className="h-full w-full"
            style={{
              border: 'none',
              minHeight: size === 'auto' ? '400px' : undefined,
            }}
            sandbox={sandboxed ? 'allow-scripts allow-same-origin allow-forms allow-popups' : undefined}
            allow={allow}
            allowFullScreen={allowFullscreen}
            loading="lazy"
            onLoad={handleLoad}
            onError={handleError}
          />
        </div>
      </div>

      {/* Powered by footer */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderTop: '1px solid var(--color-glass-border)', backgroundColor: 'var(--color-bg-tertiary)' }}
      >
        <span className="text-[10px] text-[var(--color-muted)]">
          Embedded via DegenFeed · Content hosted by {protocolLabel}
        </span>
        <a
          href="/feed"
          className="text-[10px] font-medium transition-colors"
          style={{ color: 'var(--color-accent)' }}
        >
          DegenFeed ←
        </a>
      </div>
    </div>
  );
}
