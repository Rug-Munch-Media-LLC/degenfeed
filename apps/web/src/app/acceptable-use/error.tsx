'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function AcceptableUseError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Page failed to load" icon="📋" />;
}
