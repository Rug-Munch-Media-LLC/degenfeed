'use client';

/**
 * Image Discovery Page — Unified image discovery from ALL sources.
 *
 * Features:
 *   1. Masonry grid layout for images
 *   2. Filter by source, category, trending/new
 *   3. Infinite scroll
 *   4. Creator spotlight
 */

import dynamic from 'next/dynamic';
import { ErrorBoundary } from '../../components/ErrorBoundary';

const ImageDiscoveryClient = dynamic(
  () => import('./ImageDiscoveryClient').then((m) => ({ default: m.ImageDiscoveryClient })),
  { ssr: false, loading: () => <ImageDiscoverySkeleton /> },
);

function ImageDiscoverySkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      <div className="mb-6 space-y-4">
        <div className="skeleton-title h-7 w-48" />
        <div className="skeleton-text h-4 w-72" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="skeleton-text h-8 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            className="skeleton-card mb-4"
            style={{ height: `${180 + (i % 5) * 40}px`, breakInside: 'avoid' }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ImagesPage() {
  return (
    <ErrorBoundary>
      <ImageDiscoveryClient />
    </ErrorBoundary>
  );
}
