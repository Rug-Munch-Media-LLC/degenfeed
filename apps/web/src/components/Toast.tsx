'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  /** ms to live; default 4000 */
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (kind: ToastKind, message: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

let nextId = 0;
function makeId() {
  nextId += 1;
  return `${Date.now().toString(36)}-${nextId}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((kind: ToastKind, message: string, duration = 4000) => {
    const id = makeId();
    setToasts((prev) => [...prev, { id, kind, message, duration }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismiss }}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

function kindClasses(kind: ToastKind): string {
  switch (kind) {
    case 'success':
      return 'border-degen-500/40 bg-degen-500/10 text-degen-300';
    case 'error':
      return 'border-red-500/40 bg-red-500/10 text-red-300';
    case 'warning':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300';
    default:
      return 'border-white/10 bg-[var(--color-muted)] text-gray-200';
  }
}

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </section>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const ms = toast.duration ?? 4000;
    const timer = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      role={toast.kind === 'error' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-2 ${kindClasses(
        toast.kind,
      )}`}
    >
      <span className="text-sm font-medium leading-snug break-words flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-md p-1 text-current/60 hover:bg-white/5 hover:text-current"
        aria-label="Dismiss"
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
