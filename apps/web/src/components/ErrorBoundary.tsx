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

let _codeCounter = 0;
function generateCode(): string {
  _codeCounter += 1;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DF-${rand}`;
}

/**
 * Global error boundary component.
 * Wraps any part of the tree to catch rendering errors and show a fallback UI.
 * Logs errors to console and the `reportError` service.
 */
export class ErrorBoundary extends Component<Props, State> {
  private errorCode = 'DF-0000';

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.errorCode = generateCode();
    console.error(`[ErrorBoundary ${this.errorCode}]`, error, errorInfo);
    reportError(error, {
      tags: {
        source: 'error-boundary',
        code: this.errorCode,
        componentStack: errorInfo.componentStack ?? '',
      },
    });
    this.props.onError?.(error, errorInfo);
  }

  override handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.errorCode = generateCode();
    this.props.onReset?.();
  };

  override render() {
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
          <p className="mb-2 text-sm text-[var(--color-muted)]">
            Something hiccupped. Try refreshing or{' '}
            <button
              type="button"
              onClick={this.handleReset}
              className="underline decoration-dotted underline-offset-2 text-degen-400 hover:text-degen-300 transition-colors"
            >
              try again
            </button>
            .
          </p>
          <p className="mb-6 text-[10px] font-mono text-[var(--color-muted)] opacity-30">
            {this.errorCode}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-lg bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30 active:scale-[0.97]"
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
