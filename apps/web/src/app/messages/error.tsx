'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function MessagesError({
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
      title="Messages unavailable"
      message="Could not load your conversations. Please try again."
      icon="💬"
    />
  );
}
