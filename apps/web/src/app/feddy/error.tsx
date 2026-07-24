'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function FeddyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Communities failed to load" icon="👥" />;
}
