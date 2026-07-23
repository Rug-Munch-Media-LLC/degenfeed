'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

export type ToastKind = 'info' | 'success' | 'error' | 'warning' | 'tip';

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

/* === Kind tokens ============================================ */

function kindClasses(kind: ToastKind): string {
  switch (kind) {
    case 'success':
      return 'border-degen-500/40 bg-degen-500/10 text-degen-300';
    case 'error':
      return 'border-red-500/40 bg-red-500/10 text-red-300';
    case 'warning':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300';
    case 'tip':
      return 'border-amber-400/40 bg-amber-500/10 text-amber-300';
    default:
      return 'border-white/10 bg-[var(--color-muted)] text-[var(--color-fg)]';
  }
}

/* === SVG Icons ============================================== */

function SuccessIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8.5l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2L1 14h14L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1l2 4 4 .5-3 3.5 1 5L8 11.5 4 14l1-5-3-3.5 4-.5L8 1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function kindIcon(kind: ToastKind): ReactNode {
  switch (kind) {
    case 'success':
      return <SuccessIcon />;
    case 'error':
      return <ErrorIcon />;
    case 'warning':
      return <WarningIcon />;
    case 'tip':
      return <TipIcon />;
    default:
      return <InfoIcon />;
  }
}

/* === Viewport =============================================== */

function ToastViewport() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <section
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:right-4 sm:left-auto sm:top-[5.5rem] sm:items-end"
      aria-label="Notifications"
      style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.2))' }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </section>
  );
}

/* === Item =================================================== */

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const elRef = useRef<HTMLDivElement>(null);

  const ms = toast.duration ?? 4000;

  const handleDismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Wait for exit animation
    setTimeout(() => onDismiss(toast.id), 250);
  }, [exiting, onDismiss, toast.id]);

  // Auto-dismiss timer
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [ms, handleDismiss]);

  // == Swipe to dismiss ==
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0]?.clientX ?? 0;
    setIsSwiping(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    currentXRef.current = e.touches[0]?.clientX ?? 0;
    const diff = currentXRef.current - startXRef.current;
    if (diff > 0) {
      setSwipeOffset(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = currentXRef.current - startXRef.current;
    setIsSwiping(false);
    if (diff > 80) {
      handleDismiss();
    } else {
      setSwipeOffset(0);
    }
  }, [handleDismiss]);

  return (
    <div
      ref={elRef}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-xl toast-swipe-region ${
        exiting ? 'toast-exit' : 'toast-enter'
      } ${kindClasses(toast.kind)}`}
      style={{
        transform: isSwiping ? `translateX(${swipeOffset}px)` : undefined,
        transition: isSwiping ? 'none' : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-start gap-3">
        {/* Icon circle */}
        <span
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          aria-hidden="true"
          style={{ backgroundColor: 'currentColor', color: 'var(--color-card)' }}
        >
          {kindIcon(toast.kind)}
        </span>

        {/* Message */}
        <span className="flex-1 text-sm font-medium leading-snug break-words">{toast.message}</span>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-md p-1 text-current/60 hover:bg-white/5 hover:text-current transition-colors duration-[var(--duration-fast)]"
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

      {/* Progress bar */}
      <div
        className="toast-progress-bar"
        style={{ animationDuration: `${ms}ms` }}
        aria-hidden="true"
      />
    </div>
  );
}
