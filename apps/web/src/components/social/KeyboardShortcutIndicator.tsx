'use client';

/**
 * KeyboardShortcutIndicator — Floating pill showing available keyboard shortcuts.
 * Hover to expand, auto-hides after inactivity.
 */

import { useEffect, useState } from 'react';

interface Shortcut {
  key: string;
  label: string;
}

const SHORTCUTS: Shortcut[] = [
  { key: 'j', label: 'Next post' },
  { key: 'k', label: 'Previous post' },
  { key: 'l', label: 'Like' },
  { key: 'r', label: 'Reply' },
  { key: 't', label: 'Tip' },
  { key: 'n', label: 'New post' },
  { key: '/', label: 'Search' },
  { key: 'Space', label: 'Scroll down' },
];

export function KeyboardShortcutIndicator() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Show briefly on mount, then fade
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggle = () => {
    setExpanded((e) => !e);
    setVisible(true);
  };

  if (!visible && !expanded) return null;

  return (
    <div
      className="fixed bottom-20 right-4 z-40"
      onPointerEnter={() => setVisible(true)}
      onPointerLeave={() => !expanded && setVisible(false)}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-mono transition-all hover:scale-105"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(16px)',
          color: 'var(--color-fg)',
        }}
        aria-label="Toggle keyboard shortcuts"
      >
        <kbd className="rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-black">
          ⌨
        </kbd>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Shortcuts
        </span>
      </button>

      {expanded && (
        <div
          className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border p-3 backdrop-blur-xl"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-glass-bg-heavy)',
          }}
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            Keyboard shortcuts
          </div>
          <div className="space-y-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.key} className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-fg-secondary)]">{s.label}</span>
                <kbd
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold font-mono"
                  style={{
                    background: 'var(--color-overlay)',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {s.key === 'Space' ? '␣' : s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
