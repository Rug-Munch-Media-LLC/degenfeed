'use client';

import { ErrorFallback } from '../../components/ErrorFallback';

export default function LeaderboardError({
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
      title="Leaderboard unavailable"
      message="Could not load leaderboard data. Please try again."
      icon="🏆"
    />
  );
}
