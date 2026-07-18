'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function SubscribeError({
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
      title="Subscription unavailable"
      message="Could not load subscription information."
      icon="⭐"
    />
  );
}
