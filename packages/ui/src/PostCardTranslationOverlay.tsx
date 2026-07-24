/**
 * @degenfeed/ui — PostCard Translation Preview Overlay
 */

'use client';

import { TranslationPreview } from './TranslationPreview';

interface TranslationOverlayProps {
  translationResult: {
    translated: string;
    truncated: boolean;
    originalLength: number;
    translatedLength: number;
    maxLength: number;
    strippedMarkdown: boolean;
    removedProtocolElements: string[];
  } | null;
  translateTarget: string | null;
  onClose: () => void;
  onPost: (content: string, targetProtocol: string) => void;
}

export function TranslationOverlay({
  translationResult,
  translateTarget,
  onClose,
  onPost,
}: TranslationOverlayProps) {
  if (!translationResult) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      aria-modal="true"
      aria-label="Translation preview"
      role="dialog"
    >
      <div
        className="flex w-full max-w-xl flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
        role="none"
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">Translate Post</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              role="img"
              aria-label="Close icon"
            >
              <title>Close</title>
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TranslationPreview
            originalContent=""
            fromProtocol=""
            translated={translationResult}
            toProtocol={translateTarget ?? ''}
            onPost={onPost}
          />
        </div>
      </div>
    </section>
  );
}
