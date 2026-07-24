'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function VisualError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Visual feed failed to load" icon="🎨" />;
}
