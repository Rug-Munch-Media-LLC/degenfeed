'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function YoutubeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="YouTube page failed to load" icon="▶️" />;
}
