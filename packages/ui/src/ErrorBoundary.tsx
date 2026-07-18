'use client';

// @ts-nocheck — React.Component method overrides conflict with strict noImplicitOverride
import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    console.error('[DegenFeed ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }
      return (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mb-6 text-5xl text-red-400">!</div>
          <h2 className="mb-2 text-xl font-bold text-[var(--color-fg)]">Something went wrong</h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            {this.state.error.message || 'An unexpected error occurred'}
          </p>
          <button type="button" className="btn-primary text-sm" onClick={this.handleRetry}>
            Try again
          </button>
          <p className="mt-4 text-xs text-gray-600">
            If this persists, check the console for details.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
