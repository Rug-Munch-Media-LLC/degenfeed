'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function AuthCallbackError({
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
      title="Authentication failed"
      message="We couldn't complete the sign-in process. This may be due to an expired link or a temporary issue with the authentication provider."
      icon="🔑"
    />
  );
}
