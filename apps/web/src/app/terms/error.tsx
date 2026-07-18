'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function TermsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Terms of service failed to load" icon="📝" />
  );
}
