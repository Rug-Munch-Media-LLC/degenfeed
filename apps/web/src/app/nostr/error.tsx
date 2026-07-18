'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function NostrError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Nostr feed failed to load" icon="⚡" />;
}
