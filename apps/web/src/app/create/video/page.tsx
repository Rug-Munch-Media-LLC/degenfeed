'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import type { VideoFormat } from '../../../components/create/format';
import { VODCreatorFlow } from '../../../components/create/VODCreatorFlow';

function VodFlowWithParams() {
  const params = useSearchParams();
  const formatParam = params.get('format');
  const initialFormat: VideoFormat =
    formatParam === 'landscape'
      ? 'landscape'
      : formatParam === 'portrait'
        ? 'portrait'
        : 'portrait';

  const autoCapture = params.get('capture') === '1';

  return <VODCreatorFlow initialFormat={initialFormat} autoCapture={autoCapture} />;
}

export default function CreateVideoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl px-4 py-20">
          <div className="skeleton mb-4 h-10 w-64 rounded-xl" />
          <div className="skeleton h-72 w-full rounded-2xl" />
        </div>
      }
    >
      <VodFlowWithParams />
    </Suspense>
  );
}
