'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function SettingsError({
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
      title="Settings unavailable"
      message="Could not load settings."
      icon="⚙️"
    />
  );
}
