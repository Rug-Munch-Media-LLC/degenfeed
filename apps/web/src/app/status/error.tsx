'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function StatusError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Status page failed to load" icon="📊" />;
}
