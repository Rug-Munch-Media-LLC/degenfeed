'use client';

import { ErrorFallback } from '@/components/ErrorFallback';

export default function PostIdError({
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
      title="Post failed to load"
      message="This post may have been deleted or is temporarily unavailable."
      icon="📄"
    />
  );
}
