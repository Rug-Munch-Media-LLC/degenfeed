'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function AuthError({
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
      title="Authentication error"
      message="Something went wrong during authentication. Please try again."
      icon="🔐"
    />
  );
}
