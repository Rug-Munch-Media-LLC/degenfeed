'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function LegalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Legal page failed to load" icon="⚖" />;
}
