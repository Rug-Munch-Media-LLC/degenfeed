'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function DigestError({
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
      title="Digest being prepared"
      message="Your daily digest is being prepared. Check back in a moment."
      icon="📋"
    />
  );
}
