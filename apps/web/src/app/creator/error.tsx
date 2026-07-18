'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function CreatorError({
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
      title="Creator Studio unavailable"
      message="Could not load creator tools."
      icon="🎨"
    />
  );
}
