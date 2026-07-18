'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function ApiDocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="API docs failed to load" icon="📖" />;
}
