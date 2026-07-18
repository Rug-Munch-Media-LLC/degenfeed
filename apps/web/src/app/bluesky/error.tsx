'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function BlueskyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Bluesky feed failed to load" icon="🦋" />
  );
}
