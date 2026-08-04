'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../AuthProvider';
import { CREATE_OPTIONS } from './format';

/**
 * CreateBottomSheet — TikTok-style "+" sheet for mobile.
 *
 * Opened from the center button in BottomNav. Quick actions on top
 * (camera / gallery), then every creation flow:
 *   Short Video · Long Video · Go Live · Write Post · Podcast
 */
export function CreateBottomSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { ready, signedInProtocols, openCompose, openSignIn } = useAuth();
  const hasSignedIn = ready && Object.values(signedInProtocols).some(Boolean);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const handleWritePost = useCallback(() => {
    onClose();
    if (hasSignedIn) openCompose();
    else openSignIn();
  }, [hasSignedIn, onClose, openCompose, openSignIn]);

  const handleRequireAuth = useCallback(
    (next: () => void) => {
      onClose();
      if (hasSignedIn) next();
      else openSignIn();
    },
    [hasSignedIn, onClose, openSignIn],
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-[var(--z-bottom-sheet,60)] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Create menu"
    >
      <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] pb-[max(env(safe-area-inset-bottom,0px),16px)] shadow-2xl sm:rounded-3xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4">
          <div>
            <h2 className="text-base font-bold text-[var(--color-fg)]">Create</h2>
            <p className="text-[11px] text-[var(--color-muted)]">What do you want to make?</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close create menu"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Quick capture */}
        <div className="grid grid-cols-2 gap-2 px-5 pt-4">
          <button
            type="button"
            onClick={() =>
              handleRequireAuth(() => {
                window.location.href = '/create/video?capture=1';
              })
            }
            className="flex items-center gap-2.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2.5 transition-colors hover:border-degen-500/30"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-degen-500/15 text-sm"
              aria-hidden="true"
            >
              📷
            </span>
            <span className="text-left">
              <span className="block text-xs font-bold text-[var(--color-fg)]">Record</span>
              <span className="block text-[9px] text-[var(--color-muted)]">Camera capture</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              handleRequireAuth(() => {
                window.location.href = '/create/video';
              })
            }
            className="flex items-center gap-2.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2.5 transition-colors hover:border-degen-500/30"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-sm"
              aria-hidden="true"
            >
              🖼️
            </span>
            <span className="text-left">
              <span className="block text-xs font-bold text-[var(--color-fg)]">Upload</span>
              <span className="block text-[9px] text-[var(--color-muted)]">From gallery</span>
            </span>
          </button>
        </div>

        {/* Create options */}
        <div className="space-y-1.5 px-5 py-4">
          {CREATE_OPTIONS.map((option) => {
            if (option.id === 'post') {
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={handleWritePost}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--color-overlay)]"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                    style={{ backgroundColor: `${option.accent}18` }}
                    aria-hidden="true"
                  >
                    {option.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[var(--color-fg)]">
                      {option.label}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--color-muted)]">
                      {option.description}
                    </span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-[var(--color-muted)]"
                    aria-hidden="true"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              );
            }
            return (
              <Link
                key={option.id}
                href={option.href}
                onClick={() => {
                  if (!hasSignedIn) {
                    // Sign-in gate for creator flows
                    handleRequireAuth(() => {
                      window.location.href = option.href;
                    });
                  } else {
                    onClose();
                  }
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-[var(--color-overlay)]"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${option.accent}18` }}
                  aria-hidden="true"
                >
                  {option.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[var(--color-fg)]">
                    {option.label}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--color-muted)]">
                    {option.description}
                  </span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[var(--color-muted)]"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
