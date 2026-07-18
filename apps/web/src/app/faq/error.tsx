'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function FaqError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="FAQ failed to load" icon="❓" />;
}
