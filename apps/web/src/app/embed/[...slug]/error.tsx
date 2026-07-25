'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function EmbedSlugError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      error={error}
      reset={reset}
      title="Embed failed to load"
      message="The embedded content could not be loaded. It may have been removed or is temporarily unavailable."
      icon="🔗"
    />
  );
}
