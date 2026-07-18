'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function NotificationsError({
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
      title="Notifications unavailable"
      message="Could not load your notifications. Please try again."
      icon="🔔"
    />
  );
}
