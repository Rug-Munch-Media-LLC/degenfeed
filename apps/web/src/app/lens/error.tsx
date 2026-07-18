'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function LensError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Lens feed failed to load" icon="🌿" />;
}
