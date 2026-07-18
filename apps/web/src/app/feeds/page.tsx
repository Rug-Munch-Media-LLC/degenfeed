'use client';

import dynamic from 'next/dynamic';

const FeedsPageContent = dynamic(() => import('./FeedsPageContent'), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="skeleton h-8 w-48 rounded-lg mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    </div>
  ),
});

export default function Page() {
  return <FeedsPageContent />;
}
