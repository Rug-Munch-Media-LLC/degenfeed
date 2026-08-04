'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { VideoFormat } from '../../../components/create/format';
import { LiveCreatorFlow } from '../../../components/create/LiveCreatorFlow';

function LiveFlowWithParams() {
  const params = useSearchParams();
  const formatParam = params.get('format');
  const initialFormat: VideoFormat =
    formatParam === 'landscape'
      ? 'landscape'
      : formatParam === 'portrait'
        ? 'portrait'
        : 'portrait';

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 animate-page-enter">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">
          <span className="text-degen-400" aria-hidden="true">
            🔴
          </span>{' '}
          Go Live
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Vertical or horizontal, every platform, one click.
        </p>
      </div>
      <LiveCreatorFlow initialFormat={initialFormat} />
    </div>
  );
}

export default function CreateLivePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-20">
          <div className="skeleton mb-4 h-10 w-64 rounded-xl" />
          <div className="skeleton h-72 w-full rounded-2xl" />
        </div>
      }
    >
      <LiveFlowWithParams />
    </Suspense>
  );
}
