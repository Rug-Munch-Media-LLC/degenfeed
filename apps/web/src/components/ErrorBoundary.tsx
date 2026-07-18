'use client';

import { reportError } from '@degenfeed/utils';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback UI. If omitted, uses a minimal fallback. */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Optional error recovery callback */
  onReset?: () => void;
  /** Optional error logging callback */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary component.
 * Wraps any part of the tree to catch rendering errors and show a fallback UI.
 * Logs errors to console and the `reportError` service.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
    reportError(error, {
      tags: { source: 'error-boundary', componentStack: errorInfo.componentStack ?? '' },
    });
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // Default fallback
      return (
        <div className="mx-auto flex min-h-[40vh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10">
            <span className="text-3xl text-red-400" aria-hidden="true">
              ⚠
            </span>
          </div>
          <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Something went wrong</h2>
          <p className="mb-6 text-sm text-[var(--color-muted)]">
            An unexpected error occurred. Please try again.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
            >
              Try Again
            </button>
            <a
              href="/"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-5 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              Go Home
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
