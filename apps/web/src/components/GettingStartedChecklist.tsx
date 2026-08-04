'use client';

/**
 * @components/GettingStartedChecklist — Feed empty-state onboarding checklist.
 *
 * Shows a set of clickable tasks for new users: connect wallet, link protocol,
 * follow creators, create first post. Each item tracks progress in localStorage.
 *
 * Design: Dark neon glass card with progress ring. Completing all items
 * shows a celebratory state.
 *
 * Accessibility: All items are <button type="button">s with aria-labels. Role="list".
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// === Types ================================================================

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** href to navigate to when clicked */
  href: string;
  /** Check function: return true if this item is completed */
  checkFn?: () => boolean;
}

// === Constants ============================================================

const STORAGE_KEY_MANUAL = 'degenfeed_checklist_manual';

const ITEMS: ChecklistItem[] = [
  {
    id: 'wallet',
    label: 'Connect your wallet',
    description: 'Link ETH or SOL wallet to sign in and post across all networks',
    icon: '🔑',
    href: '/feed',
    checkFn: () => {
      if (typeof window === 'undefined') return false;
      try {
        return localStorage.getItem('degenfeed_wallet_connected') === 'true';
      } catch {
        return false;
      }
    },
  },
  {
    id: 'protocol',
    label: 'Link at least one protocol',
    description: 'Connect Nostr, Farcaster, Lens, or another social graph',
    icon: '🔗',
    href: '/profile/preferences',
    checkFn: () => {
      if (typeof window === 'undefined') return false;
      try {
        const stored = localStorage.getItem('degenfeed_protocols');
        if (!stored) return false;
        const protocols = JSON.parse(stored) as string[];
        return protocols.length > 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'follow',
    label: 'Follow 5 creators',
    description: 'Build your timeline by following people across networks',
    icon: '👥',
    href: '/discover',
    checkFn: () => {
      if (typeof window === 'undefined') return false;
      try {
        const stored = localStorage.getItem('degenfeed_follow_count');
        return stored !== null && Number.parseInt(stored, 10) >= 5;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'post',
    label: 'Create your first post',
    description: 'Publish a cross-protocol post to all your linked networks',
    icon: '✍️',
    href: '/feed',
    checkFn: () => {
      if (typeof window === 'undefined') return false;
      try {
        return localStorage.getItem('degenfeed_first_post') === 'true';
      } catch {
        return false;
      }
    },
  },
];

// === Component ============================================================

interface GettingStartedChecklistProps {
  /** If true, shows in compact mode (for sidebar/widget use) */
  compact?: boolean;
  /** Called when all items are completed */
  onAllComplete?: () => void;
}

export function GettingStartedChecklist({
  compact = false,
  onAllComplete,
}: GettingStartedChecklistProps) {
  const [manuallyChecked, setManuallyChecked] = useState<Set<string>>(new Set());

  // Load manually checked items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MANUAL);
      if (stored) {
        setManuallyChecked(new Set(JSON.parse(stored) as string[]));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleManual = useCallback((id: string) => {
    setManuallyChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Persist
      try {
        localStorage.setItem(STORAGE_KEY_MANUAL, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Check completion status using both auto-checks and manual checks
  const statuses = useMemo(() => {
    return ITEMS.map((item) => {
      const autoDone = item.checkFn?.() ?? false;
      const manualDone = manuallyChecked.has(item.id);
      return {
        ...item,
        done: autoDone || manualDone,
        autoDone,
      };
    });
  }, [manuallyChecked]);

  const completedCount = statuses.filter((s) => s.done).length;
  const totalCount = statuses.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = completedCount >= totalCount;

  // Notify parent when all complete
  useEffect(() => {
    if (allDone) {
      onAllComplete?.();
    }
  }, [allDone, onAllComplete]);

  // == Circular progress SVG ==
  const CIRCLE_RADIUS = 32;
  const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
  const strokeDashoffset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;

  // == Render ==

  if (allDone && compact) return null;

  return (
    <div
      className={`rounded-2xl border border-[var(--color-glass-border)] bg-gradient-to-br from-degen-500/[0.03] to-transparent backdrop-blur-xl ${
        compact ? 'p-4' : 'p-6 sm:p-8'
      }`}
      role="region"
      aria-label="Getting started checklist"
    >
      {allDone ? (
        /* == All done state == */
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-degen-500/10">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20 6L9 17l-5-5"
                stroke="#00ff41"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
            You&apos;re all set!
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
            You&apos;ve completed the getting started checklist.
          </p>
          <p className="mt-4 text-xs" style={{ color: 'var(--color-muted)', opacity: 0.7 }}>
            Tip: The more you engage, the better your For You feed becomes.
          </p>
        </div>
      ) : (
        <>
          {/* == Header with progress ring == */}
          <div className="mb-5 flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              <svg
                width="72"
                height="72"
                viewBox="0 0 72 72"
                className="absolute"
                aria-hidden="true"
              >
                {/* Background circle */}
                <circle
                  cx="36"
                  cy="36"
                  r={CIRCLE_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="4"
                />
                {/* Progress arc */}
                <circle
                  cx="36"
                  cy="36"
                  r={CIRCLE_RADIUS}
                  fill="none"
                  stroke="url(#checklist-grad)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 36 36)"
                  style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
                />
                <defs>
                  <linearGradient id="checklist-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--color-accent)" />
                    <stop offset="100%" stopColor="var(--color-accent-secondary)" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="relative text-lg font-bold" style={{ color: 'var(--color-fg)' }}>
                {percent}%
              </span>
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: 'var(--color-fg)' }}>
                Getting Started
              </h2>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                {completedCount} of {totalCount} tasks complete
              </p>
              {!compact && (
                <p
                  className="mt-1 text-[11px]"
                  style={{ color: 'var(--color-muted)', opacity: 0.7 }}
                >
                  Complete these tasks to unlock the full DegenFeed experience.
                </p>
              )}
            </div>
          </div>

          {/* == Checklist items == */}
          <ul className="space-y-2">
            {statuses.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={`group flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 ${
                    item.done
                      ? 'border-degen-500/20 bg-degen-500/[0.04]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]'
                  }`}
                >
                  {/* Checkbox circle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleManual(item.id);
                    }}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      item.done
                        ? 'border-degen-500 bg-degen-500 shadow-[0_0_6px_rgba(0,255,65,0.3)]'
                        : 'border-white/20 group-hover:border-white/40'
                    }`}
                    aria-label={
                      item.done
                        ? `Mark "${item.label}" as incomplete`
                        : `Mark "${item.label}" as complete`
                    }
                  >
                    {item.done ? (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M10 3L4.5 9L2 6.5"
                          stroke="black"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span
                        className={`text-sm font-semibold transition-colors ${
                          item.done ? 'text-white/60' : 'text-white/80 group-hover:text-white'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.done && (
                        <span className="rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[9px] font-medium text-degen-400">
                          Done
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-0.5 text-xs leading-relaxed ${
                        item.done ? 'text-white/30' : 'text-white/40'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  {!item.done && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5"
                      style={{ color: 'var(--color-muted)', opacity: 0.3 }}
                      aria-hidden="true"
                    >
                      <path
                        d="M6 4l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </a>
              </li>
            ))}
          </ul>

          {/* == Compact footer == */}
          {!compact && (
            <p
              className="mt-4 text-center text-[10px]"
              style={{ color: 'var(--color-muted)', opacity: 0.3 }}
            >
              Tasks auto-detect when completed. You can also manually check them off.
            </p>
          )}
        </>
      )}
    </div>
  );
}
