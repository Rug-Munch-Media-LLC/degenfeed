'use client';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  className = '',
}: ErrorStateProps) {
  const errorMessage =
    message || (error instanceof Error ? error.message : error) || 'An unexpected error occurred.';

  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-12 text-center ${className}`}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-red-400"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="mb-1 text-lg font-semibold text-[var(--color-fg)]">{title}</h3>
      <p className="mb-4 max-w-sm text-sm text-[var(--color-muted)]">{errorMessage}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-primary text-sm">
          Try Again
        </button>
      )}
    </div>
  );
}

export { ErrorState };
