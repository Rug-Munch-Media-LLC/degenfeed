'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function LiveShortsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Live Shorts failed to load" icon="🎬" />;
}
