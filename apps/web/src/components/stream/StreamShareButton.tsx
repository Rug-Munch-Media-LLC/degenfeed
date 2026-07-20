'use client';

import { useCallback, useState } from 'react';

interface StreamShareButtonProps {
  streamId: string;
  title: string;
}

export function StreamShareButton({ streamId, title }: StreamShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `${window.location.origin}/live/${streamId}`;
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [streamId, title]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-[0.97]"
      aria-label="Share"
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}
