'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function CommunitiesError({
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
      title="Communities unavailable"
      message="Could not load communities."
      icon="👥"
    />
  );
}
