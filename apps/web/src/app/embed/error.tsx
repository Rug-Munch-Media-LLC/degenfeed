'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function EmbedError({
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
      title="Content unavailable"
      message="Could not load embedded content."
      icon="🔗"
    />
  );
}
