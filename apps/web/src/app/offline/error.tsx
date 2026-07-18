'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function OfflineError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Offline page failed to load" icon="📡" />
  );
}
