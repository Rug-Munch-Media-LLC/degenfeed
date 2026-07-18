'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function MastodonError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback error={error} reset={reset} title="Mastodon feed failed to load" icon="🐘" />
  );
}
