'use client';

import { ErrorBoundary } from './ErrorBoundary';

/**
 * Client boundary wrapper for the server-side layout.
 * Catches rendering errors in the entire app tree.
 */
export function GlobalErrorBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
