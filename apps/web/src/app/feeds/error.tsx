'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function FeedsError({
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
      title="Feeds unavailable"
      message="Could not load your feeds."
      icon="📰"
    />
  );
}
