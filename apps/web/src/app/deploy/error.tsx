'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function DeployError({
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
      title="Launchpad unavailable"
      message="Could not load the launchpad."
      icon="🚀"
    />
  );
}
