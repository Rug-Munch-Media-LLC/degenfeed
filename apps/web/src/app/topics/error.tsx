'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function TopicsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Topic unavailable"
      message="Could not load this topic."
      icon="📌"
    />
  );
}
