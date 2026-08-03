'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function ProtocolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Protocol guide failed to load" icon="🗺️" />
  );
}
