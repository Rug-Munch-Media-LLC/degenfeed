'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function TrendingError({
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
      title="Trending unavailable"
      message="Could not load trending topics. Please try again."
      icon="🔥"
    />
  );
}
