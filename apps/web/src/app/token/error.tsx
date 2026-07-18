'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function TokenError({
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
      title="Token data unavailable"
      message="Could not load token information."
      icon="🪙"
    />
  );
}
