'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function SpacesError({
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
      title="Spaces unavailable"
      message="Could not load spaces."
      icon="🌌"
    />
  );
}
