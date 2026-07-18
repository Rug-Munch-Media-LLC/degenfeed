'use client';

import { useCallback, useState } from 'react';

/**
 * Represents a moderation flag or community note attached to a post.
 */
export interface ModerationFlag {
  /** Reason for the flag (e.g. "spam", "misleading", "nsfw") */
  reason: string;
  /** Human-readable label for the reason */
  label: string;
  /** Severity of the flag */
  severity: 'info' | 'warning' | 'critical';
  /** Who flagged it (e.g. "Community Notes", "Auto-moderation", "Moderator") */
  source: string;
  /** Optional explanation text */
  explanation?: string;
  /** ISO timestamp when the flag was applied */
  timestamp?: string;
}

interface ModerationNoteProps {
  /** The moderation flags applied to this post */
  flags: ModerationFlag[];
  /** Whether to show the note expanded by default */
  expanded?: boolean;
  /** Called when the user provides feedback on the flag (helpful / not helpful) */
  onFeedback?: (helpful: boolean) => void;
}

const SEVERITY_CONFIG = {
  info: {
    bg: 'bg-blue-500/8',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    icon: 'ℹ',
  },
  warning: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    icon: '⚠',
  },
  critical: {
    bg: 'bg-red-500/8',
    border: 'border-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
    icon: '🚫',
  },
};

function formatTimestamp(ts?: string): string {
  if (!ts) return '';
  try {
    const date = new Date(ts);
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

/**
 * Displays moderation flags / community notes attached to a post.
 * Shows why content was flagged and who flagged it.
 * Follows the "Community Notes" transparency model popularized by X/Twitter.
 */
export function ModerationNote({ flags, expanded = false, onFeedback }: ModerationNoteProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const [feedbackGiven, setFeedbackGiven] = useState<'helpful' | 'not-helpful' | null>(null);

  const handleFeedback = useCallback(
    (helpful: boolean) => {
      setFeedbackGiven(helpful ? 'helpful' : 'not-helpful');
      onFeedback?.(helpful);
    },
    [onFeedback],
  );

  if (flags.length === 0) return null;

  // Use the highest severity flag for the collapsed view
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const topFlag = [...flags].sort(
    (a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3),
  )[0];
  if (!topFlag) return null;

  const cfg = SEVERITY_CONFIG[topFlag.severity];

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl border ${cfg.border} ${cfg.bg} transition-all`}
    >
      {/* Collapsed / header bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--color-overlay)]"
        aria-expanded={isExpanded}
        aria-label={`Moderation note: ${topFlag.label}. Click to ${isExpanded ? 'collapse' : 'expand'}.`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} aria-hidden="true" />
        <span className={`text-xs font-medium ${cfg.text}`}>
          {flags.length === 1 ? topFlag.label : `${topFlag.label} +${flags.length - 1} more`}
        </span>
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">{topFlag.source}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`shrink-0 text-[var(--color-muted)] transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-inherit px-3 py-3 space-y-2">
          <p className="text-[11px] font-medium text-[var(--color-fg)]">
            Why was this content flagged?
          </p>

          {flags.map((flag, idx) => {
            const fCfg = SEVERITY_CONFIG[flag.severity];
            return (
              <div
                key={`${flag.reason}-${idx}`}
                className="flex items-start gap-2 rounded-lg bg-[var(--color-overlay)] p-2"
              >
                <span className={`mt-0.5 text-xs ${fCfg.text}`} aria-hidden="true">
                  {fCfg.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium ${fCfg.text}`}>{flag.label}</span>
                    <span className="text-[9px] text-[var(--color-muted)]">{flag.source}</span>
                    {flag.timestamp && (
                      <span className="text-[9px] text-[var(--color-muted)]">
                        · {formatTimestamp(flag.timestamp)}
                      </span>
                    )}
                  </div>
                  {flag.explanation && (
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)] leading-relaxed">
                      {flag.explanation}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Is this helpful? feedback */}
          {!feedbackGiven && onFeedback && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-[var(--color-muted)]">Was this helpful?</span>
              <button
                type="button"
                onClick={() => handleFeedback(true)}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-green-400 hover:bg-green-500/10 transition-colors"
                aria-label="Yes, this note was helpful"
              >
                👍 Yes
              </button>
              <button
                type="button"
                onClick={() => handleFeedback(false)}
                className="rounded px-2 py-0.5 text-[10px] font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                aria-label="No, this note was not helpful"
              >
                👎 No
              </button>
            </div>
          )}

          {feedbackGiven && (
            <p className="text-[10px] text-[var(--color-muted)]">
              {feedbackGiven === 'helpful'
                ? 'Thanks for your feedback!'
                : "Thanks — we'll review this flag."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
