'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function NewsletterError({
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
      title="Newsletter unavailable"
      message="Could not load newsletter."
      icon="📧"
    />
  );
}
