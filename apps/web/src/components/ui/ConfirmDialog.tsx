'use client';

import { type ReactNode, useEffect, useRef } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      dialogRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const confirmStyles =
    variant === 'danger'
      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
      : variant === 'warning'
        ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
        : 'btn-primary';

  return (
    <div className="fixed inset-0 z-[var(--z-modal-backdrop,60)] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 animate-backdrop-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        tabIndex={-1}
        className="relative z-[var(--z-modal,70)] w-full max-w-md rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 shadow-2xl modal-content-enter"
      >
        <h2 id="confirm-title" className="mb-2 text-lg font-bold text-[var(--color-fg)]">
          {title}
        </h2>
        <div className="mb-6 text-sm text-[var(--color-muted)]">{message}</div>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="btn-ghost text-sm">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all disabled:opacity-50 ${confirmStyles}`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                {confirmLabel}
              </span>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ConfirmDialog };
