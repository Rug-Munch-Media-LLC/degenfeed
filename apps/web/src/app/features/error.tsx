'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function FeaturesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Features page failed to load" icon="✨" />
  );
}
