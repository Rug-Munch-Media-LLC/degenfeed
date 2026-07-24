'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function WaitlistError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Waitlist failed to load" icon="📋" />;
}
