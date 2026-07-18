'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function DocsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Docs failed to load" icon="📚" />;
}
