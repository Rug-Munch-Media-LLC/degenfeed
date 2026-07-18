'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function DevelopersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Developers page failed to load" icon="🛠" />
  );
}
