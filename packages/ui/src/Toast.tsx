'use client';

/**
 * @degenfeed/ui — Toast
 *
 * Standalone toast notification component with slide-up animation,
 * auto-dismiss, and type-specific icons/colors.
 *
 * Types: info (blue), success (green), error (red), warning (yellow), tip (gold)
 *
 * Usage:
 * ```tsx
 * <Toast
 *   kind="success"
 *   message="Post published!"
 *   onDismiss={() => {}}
 * />
 * ```
 *
 * For a full context-based toast system, compose this with a provider:
 * ```tsx
 * <ToastProvider>
 *   <YourApp />
 *   <ToastViewport>
 *     {toasts.map(t => <Toast key={t.id} {...t} />)}
 *   </ToastViewport>
 * </ToastProvider>
 * ```
 */

import { type ReactNode, useEffect, useId } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'warning' | 'tip';

export interface ToastProps {
  /** Unique identifier for this toast */
  id?: string;
  /** Visual style variant */
  kind: ToastKind;
  /** Message content */
  message: string;
  /** Callback when toast should be removed (auto-dismiss or manual close) */
  onDismiss: (id: string) => void;
  /** Auto-dismiss duration in ms (default: 3000). Set to 0 to disable */
  duration?: number;
  /** Optional action slot (e.g. undo button) */
  action?: ReactNode;
}

const KIND_CLASSES: Record<ToastKind, string> = {
  success: 'border-degen-500/40 bg-degen-500/10 text-degen-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  tip: 'border-amber-400/40 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
};

const KIND_ICONS: Record<ToastKind, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  tip: '⚡',
  info: 'ℹ',
};

/**
 * A single toast notification.
 *
 * Renders a slide-up animated notification with type-specific
 * icon, color, and optional action button. Auto-dismisses
 * after `duration` ms unless duration is 0.
 */
export function Toast({ id, kind, message, onDismiss, duration = 3000, action }: ToastProps) {
  const autoId = useId();
  const toastId = id ?? autoId;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toastId), duration);
    return () => clearTimeout(timer);
  }, [toastId, duration, onDismiss]);

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl animate-toast-in ${KIND_CLASSES[kind]}`}
    >
      {/* Type icon */}
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
        aria-hidden="true"
        style={{ backgroundColor: 'currentColor', color: 'var(--color-card, #000)' }}
      >
        {KIND_ICONS[kind]}
      </span>

      {/* Message */}
      <span className="flex-1 text-sm font-medium leading-snug break-words">{message}</span>

      {/* Optional action (e.g. undo) */}
      {action && <div className="shrink-0">{action}</div>}

      {/* Dismiss button */}
      <button
        type="button"
        onClick={() => onDismiss(toastId)}
        className="shrink-0 rounded-md p-1 text-current/60 hover:bg-white/5 hover:text-current transition-colors duration-[var(--duration-fast,150ms)]"
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M12 4L4 12M4 4l8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Viewport container — wraps multiple toasts and positions them
 * at the bottom of the screen. Stacks them vertically with gap.
 */
export function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      aria-label="Notifications"
    >
      {children}
    </section>
  );
}
