'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function LiveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Live page failed to load" icon="📡" />;
}
