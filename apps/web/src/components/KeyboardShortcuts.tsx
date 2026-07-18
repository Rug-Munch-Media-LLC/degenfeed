'use client';

import { memo, useCallback, useEffect, useRef } from 'react';

interface ShortcutGroup {
  title: string;
  icon: string;
  shortcuts: { keys: string[]; desc: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    icon: '⌂',
    shortcuts: [
      { keys: ['j', '↓'], desc: 'Next post' },
      { keys: ['k', '↑'], desc: 'Previous post' },
      { keys: ['Enter'], desc: 'Open post' },
      { keys: ['Esc'], desc: 'Close modal / overlay' },
      { keys: ['?'], desc: 'Show / hide shortcuts' },
    ],
  },
  {
    title: 'Compose',
    icon: '✎',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], desc: 'Publish post' },
      { keys: ['/poll'], desc: 'Create a poll' },
      { keys: ['/image'], desc: 'Add an image' },
      { keys: ['/link'], desc: 'Add a link' },
      { keys: ['/code'], desc: 'Add code block' },
      { keys: ['/thread'], desc: 'Start a thread' },
      { keys: ['/schedule'], desc: 'Schedule post' },
    ],
  },
  {
    title: 'Feed',
    icon: '≡',
    shortcuts: [
      { keys: ['1', '2', '3', '4', '5'], desc: 'Switch feed tabs' },
      { keys: ['r'], desc: 'Refresh feed' },
      { keys: ['l'], desc: 'Like / unlike post' },
      { keys: ['t'], desc: 'Repost' },
      { keys: ['c'], desc: 'Compose new post' },
    ],
  },
  {
    title: 'Search',
    icon: '⌕',
    shortcuts: [
      { keys: ['Ctrl', 'K'], desc: 'Open search (Cmd+K on Mac)' },
    ],
  },
  {
    title: 'Theme & Layout',
    icon: '☀',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'D'], desc: 'Toggle dark mode' },
      { keys: ['Ctrl', 'Shift', 'L'], desc: 'Cycle feed layout (compact → comfortable → media-grid → reader)' },
    ],
  },
];

function Kbd({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {keys.map((k, i) => (
        <span key={k}>
          <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-[var(--color-muted)] shadow-sm">
            {k}
          </kbd>
          {i < keys.length - 1 && (
            <span className="mx-1 text-[10px] text-[var(--color-muted)]">+</span>
          )}
        </span>
      ))}
    </span>
  );
}

function ShortcutGroupCard({ group }: { group: ShortcutGroup }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-fg)]">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-degen-500/10 text-xs text-degen-400">
          {group.icon}
        </span>
        {group.title}
      </h3>
      <div className="space-y-2">
        {group.shortcuts.map((s) => (
          <div
            key={`${group.title}-${s.desc}`}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--color-overlay)]"
          >
            <span className="text-xs text-[var(--color-muted)]">{s.desc}</span>
            <Kbd keys={s.keys} />
          </div>
        ))}
      </div>
    </section>
  );
}

export const KeyboardShortcuts = memo(function KeyboardShortcuts({
  open,
  onClose,
  isFirstVisit,
}: {
  open: boolean;
  onClose: () => void;
  isFirstVisit?: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(
          'input, button, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleKeyDown);
    // Focus the close button on open
    const closeBtn = overlayRef.current?.querySelector<HTMLButtonElement>(
      'button[aria-label="Close shortcuts"]',
    );
    closeBtn?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      role="dialog"
    >
      <div
        className="mx-4 w-full max-w-lg rounded-2xl border border-white/[0.06] bg-[var(--color-glass-bg)] shadow-2xl backdrop-blur-2xl sm:max-w-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '85vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-fg)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-degen-500/10 text-sm text-degen-400">
              ⌨
            </span>
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
            aria-label="Close shortcuts"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Groups ── */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(85vh - 70px)' }}>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {GROUPS.map((group) => (
              <ShortcutGroupCard key={group.title} group={group} />
            ))}
          </div>

          {isFirstVisit && (
            <div className="mt-6 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
              <p className="text-center text-xs text-[var(--color-muted)]">
                Press <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-medium leading-none text-[var(--color-muted)]">?</kbd>{' '}
                at any time to view shortcuts
              </p>
            </div>
          )}

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-colors hover:border-white/20 hover:text-[var(--color-fg)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
