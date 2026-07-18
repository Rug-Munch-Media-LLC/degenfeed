'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function ShortsError({
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
      title="Shorts unavailable"
      message="Could not load short-form content."
      icon="📱"
    />
  );
}
