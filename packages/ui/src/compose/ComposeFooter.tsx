'use client';

/**
 * @degenfeed/ui — character budget, failure notice, primary submit.
 *
 * One component serves both modes: publish and reply differ only in labels and
 * the applicable limit.
 */

import { ActionButton } from './ActionButton';

export interface ComposeFooterProps {
  textLength: number;
  charLimit: number;
  canSubmit: boolean;
  publishing: boolean;
  busyLabel: string;
  primaryLabel: string;
  failureMessage?: string;
  onClick: () => void;
}

export function ComposeFooter({
  textLength,
  charLimit,
  canSubmit,
  publishing,
  busyLabel,
  primaryLabel,
  failureMessage,
  onClick,
}: ComposeFooterProps) {
  const overLimit = textLength > charLimit;
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          id="compose-char-count"
          aria-live="polite"
          className={`text-xs tabular-nums ${
            overLimit ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)]'
          }`}
        >
          {textLength}/{charLimit}
          {overLimit && <span className="ml-1 font-medium">over limit</span>}
        </span>
        {failureMessage && (
          <span className="truncate text-xs text-[var(--color-danger)]" role="alert">
            {failureMessage}
          </span>
        )}
      </div>
      <ActionButton disabled={!canSubmit || publishing} onClick={onClick} aria-busy={publishing}>
        {publishing ? busyLabel : primaryLabel}
      </ActionButton>
    </div>
  );
}
