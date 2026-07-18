/**
 * Shorts page loading skeleton — full-screen vertical video placeholder
 * with action rail and bottom info bar, matching the TikTok-style layout.
 */

import { Line } from '@/components/loading/PageSkeleton';

export default function ShortsLoading() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-12 w-12 animate-pulse rounded-full"
          style={{ backgroundColor: 'var(--color-muted)', opacity: 0.2 }}
        />
        <Line width="w-32" height="h-4" />
        <Line width="w-48" height="h-3" />
      </div>
    </div>
  );
}
