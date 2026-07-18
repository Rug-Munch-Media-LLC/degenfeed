'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function HealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Health status failed to load" icon="💚" />
  );
}
