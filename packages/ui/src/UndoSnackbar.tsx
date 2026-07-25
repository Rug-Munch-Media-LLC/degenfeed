'use client';

/**
 * @degenfeed/ui — UndoSnackbar
 *
 * Transient snackbar with an Undo action.
 * Appears after destructive operations (delete post, send, etc.)
 * Auto-dismisses after `duration` ms.
 */

import { memo, useCallback, useEffect, useState } from 'react';

export interface UndoConfig {
  message: string;
  onUndo: () => void;
  /** Auto-dismiss duration in ms (default: 5000) */
  duration?: number;
}

interface UndoSnackbarProps {
  config: UndoConfig | null;
  onDismiss: () => void;
}

export const UndoSnackbar = memo(function UndoSnackbar({ config, onDismiss }: UndoSnackbarProps) {
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!config) return;
    setDismissing(false);
    const timer = setTimeout(() => {
      setDismissing(true);
      setTimeout(onDismiss, 300); // wait for fade-out
    }, config.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [config, onDismiss]);

  if (!config) return null;

  return (
    <div
      className={`undo-snackbar ${dismissing ? 'undo-snackbar-dismissing' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="undo-snackbar-message">{config.message}</span>
      <button
        type="button"
        className="undo-snackbar-action"
        onClick={() => {
          config.onUndo();
          setDismissing(true);
          setTimeout(onDismiss, 300);
        }}
      >
        Undo
      </button>
    </div>
  );
});

/* ─── Hook: useUndoStack ───────────────────────────────────── */

export interface UndoItem {
  id: string;
  message: string;
  onUndo: () => void;
  timestamp: number;
}

export function useUndoStack() {
  const [current, setCurrent] = useState<UndoItem | null>(null);
  const [queue, setQueue] = useState<UndoItem[]>([]);

  const push = useCallback((item: UndoItem) => {
    setCurrent(item);
    setQueue((q) => [item, ...q].slice(0, 10));
  }, []);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  const undo = useCallback(() => {
    if (current) {
      current.onUndo();
      setCurrent(null);
    }
  }, [current]);

  return { current, push, dismiss, undo };
}
