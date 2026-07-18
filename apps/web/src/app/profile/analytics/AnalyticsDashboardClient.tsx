'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

const AnalyticsDashboard = dynamic(() => import('./AnalyticsDashboard'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl px-4 py-20">
      <div className="space-y-4">
        <div className="skeleton h-8 w-64 rounded-lg bg-[var(--color-muted)]" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl bg-[var(--color-muted)]" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-xl bg-[var(--color-muted)]" />
      </div>
    </div>
  ),
});

export default function AnalyticsDashboardClient(): ReactNode {
  return <AnalyticsDashboard />;
}
