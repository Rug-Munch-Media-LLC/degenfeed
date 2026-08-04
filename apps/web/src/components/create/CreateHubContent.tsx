'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { CREATE_OPTIONS } from './format';

/**
 * CreateHubContent — "What do you want to create?"
 *
 * Single entry point for every creation flow:
 *   📹 Short Video · 🎬 Long Video · 🔴 Go Live · 📝 Write Post · 🎙️ Record Podcast
 *
 * Also exposes a mobile quick-capture strip (camera / gallery) that drops the
 * user straight into the VOD flow with the recorder open.
 */
export function CreateHubContent() {
  const { ready, signedInProtocols, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const [captureSource, setCaptureSource] = useState<'camera' | 'gallery' | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const requireSignIn = useCallback(
    (next: () => void) => {
      if (hasSignedIn) next();
      else openSignIn();
    },
    [hasSignedIn, openSignIn],
  );

  const handleCamera = useCallback(() => {
    requireSignIn(() => {
      setCaptureSource('camera');
      window.location.href = '/create/video?capture=1';
    });
  }, [requireSignIn]);

  const handleGallery = useCallback(() => {
    requireSignIn(() => {
      // Fall through to the hidden input; VOD flow also accepts uploads.
      galleryInputRef.current?.click();
    });
  }, [requireSignIn]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="mb-6 text-center sm:text-left">
        <h1
          className="text-[28px] font-black tracking-tight text-[var(--color-fg)]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          What do you want to create?
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          One hub for every format — vertical or horizontal, live or on-demand, everywhere at once.
        </p>
      </div>

      {/* ── Quick capture (mobile-first) ───────────────────── */}
      <section aria-label="Quick capture" className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <button
            type="button"
            onClick={handleCamera}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all hover:border-degen-500/40 hover:bg-[var(--color-overlay)] active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-degen-500/15 text-xl transition-transform group-hover:scale-110">
              📷
            </span>
            <span className="text-xs font-bold text-[var(--color-fg)]">Quick capture</span>
            <span className="text-[9px] text-[var(--color-muted)]">Record from your camera</span>
          </button>
          <button
            type="button"
            onClick={handleGallery}
            className="group flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all hover:border-degen-500/40 hover:bg-[var(--color-overlay)] active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-purple-500/15 text-xl transition-transform group-hover:scale-110">
              🖼️
            </span>
            <span className="text-xs font-bold text-[var(--color-fg)]">From gallery</span>
            <span className="text-[9px] text-[var(--color-muted)]">Upload existing video</span>
            <input
              ref={galleryInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const url = new URL('/create/video', window.location.origin);
                  url.searchParams.set('upload', '1');
                  window.location.href = url.toString();
                }
              }}
            />
          </button>
        </div>
        <input type="hidden" value={captureSource ?? ''} readOnly aria-hidden="true" />
      </section>

      {/* ── Create options ─────────────────────────────────── */}
      <section aria-label="Create options">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CREATE_OPTIONS.map((option) => (
            <Link
              key={option.id}
              href={option.href}
              onClick={(e) => {
                if (option.id === 'post' && !hasSignedIn) {
                  e.preventDefault();
                  openSignIn();
                }
              }}
              className="group relative overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-5 transition-all hover:border-degen-500/25 hover:shadow-[0_0_24px_rgba(0,255,65,0.05)] active:scale-[0.99]"
            >
              <div
                className="absolute right-0 top-0 h-1 w-full opacity-60"
                style={{ background: `linear-gradient(90deg, transparent, ${option.accent})` }}
                aria-hidden="true"
              />
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${option.accent}18` }}
                  aria-hidden="true"
                >
                  {option.emoji}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--color-fg)]">{option.label}</div>
                  <div className="truncate text-[10px] text-[var(--color-muted)]">
                    {option.hint}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
                {option.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-degen-400 opacity-0 transition-opacity group-hover:opacity-100">
                Open flow
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
            </Link>
          ))}

          {/* Format explainer card */}
          <div className="flex flex-col justify-center rounded-2xl border border-degen-500/15 bg-gradient-to-br from-degen-500/[0.06] to-transparent p-5">
            <div className="mb-2 flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-degen-500/15 text-base"
                aria-hidden="true"
              >
                🔄
              </span>
              <span className="text-sm font-bold text-[var(--color-fg)]">
                Same video, every format
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
              Upload once, publish everywhere. Auto-detect vertical vs horizontal from your clip —
              or override it. Schedule it, preview it, ship it.
            </p>
            <Link
              href="/create/video"
              className="mt-3 inline-flex items-center gap-1 self-start rounded-lg bg-degen-500/15 px-3 py-1.5 text-[10px] font-bold text-degen-400 transition-colors hover:bg-degen-500/25"
            >
              Start a video
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Existing flows quick links ─────────────────────── */}
      <section aria-label="Existing tools" className="mt-8">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          More tools
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Video Studio', href: '/creator/video' },
            { label: 'Creator Studio', href: '/creator' },
            { label: 'Live Hub', href: '/live' },
            { label: 'Cross-post', href: '/creator/cross-post' },
            { label: 'Content Library', href: '/creator/content' },
            { label: 'My Videos', href: '/creator/videos' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full border border-[var(--color-glass-border)] px-3 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:border-degen-500/30 hover:text-[var(--color-fg)]"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
