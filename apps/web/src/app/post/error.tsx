'use client';

import { useEffect } from 'react';

export default function PostError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[DegenFeed /post error]', error); }, [error]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="card border-red-900/30 bg-red-950/20 py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-400">!</div>
        <h2 className="mb-2 text-xl font-bold text-white">Post failed to load</h2>
        <p className="mb-4 text-sm text-gray-400">This post may have been deleted or is temporarily unavailable.</p>
        <button type="button" onClick={reset} className="btn-primary text-sm">Try again</button>
      </div>
    </div>
  );
}
