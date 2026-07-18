'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function AboutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="About page failed to load" icon="📄" />;
}
