'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function LemmyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} title="Lemmy feed failed to load" icon="🗣️" />;
}
