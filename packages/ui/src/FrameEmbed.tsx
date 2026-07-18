'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';

interface FrameButton {
  index: number;
  label: string;
  action?: string;
  target?: string;
}

export interface FrameEmbedProps {
  url: string;
  image: string;
  title?: string;
  buttons?: FrameButton[];
  postUrl?: string;
  input?: { text?: string };
  state?: string;
  aspectRatio?: '1:1' | '1.91:1';
}

/**
 * Interactive Farcaster Frame embed.
 * Renders the frame image and interactive buttons that POST to
 * /api/frame/action, updating the frame state on response.
 */
export function FrameEmbed({
  url,
  image,
  title,
  buttons = [],
  postUrl,
  aspectRatio = '1.91:1',
}: FrameEmbedProps) {
  const [frameImage, setFrameImage] = useState(image);
  const [frameButtons, setFrameButtons] = useState(buttons);
  const [framePostUrl, setFramePostUrl] = useState(postUrl);
  const [loading, setLoading] = useState<number | null>(null);

  const safeOpen = (targetUrl: string) => {
    try {
      const parsed = new URL(targetUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Invalid URL — do nothing
    }
  };

  const handleButton = useCallback(
    async (btn: FrameButton, idx: number) => {
      // Non-POST actions: open link / mint in new tab
      if (btn.action === 'link' || btn.action === 'mint') {
        safeOpen(btn.target || url);
        return;
      }

      // post / post_redirect: call the backend proxy
      const targetPostUrl = postUrl || framePostUrl;
      if (!targetPostUrl) return;

      setLoading(idx);
      try {
        const res = await fetch('/api/frame/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postUrl: targetPostUrl,
            buttonIndex: btn.index,
          }),
        });

        if (!res.ok) {
          setLoading(null);
          return;
        }

        const data = (await res.json()) as {
          image?: string;
          buttons?: FrameButton[];
          postUrl?: string;
        };

        if (data.image) setFrameImage(data.image);
        if (data.buttons) setFrameButtons(data.buttons);
        if (data.postUrl) setFramePostUrl(data.postUrl);

        // post_redirect: navigate after frame update
        if (btn.action === 'post_redirect') {
          const redirectTarget = btn.target || data.image;
          if (redirectTarget) {
            safeOpen(redirectTarget);
          }
        }
      } catch {
        // Silently fail — frame remains in current state
      } finally {
        setLoading(null);
      }
    },
    [url, postUrl, framePostUrl, safeOpen],
  );

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-purple-500/20">
      {/* Frame image */}
      <div
        className={`relative w-full overflow-hidden bg-muted/30 ${aspectRatio === '1:1' ? 'aspect-square' : 'aspect-[1.91/1]'}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="img"
        aria-label={title ? `Farcaster Frame: ${title}` : 'Farcaster Frame'}
      >
        <Image
          src={frameImage}
          alt={title ? `Farcaster Frame: ${title}` : 'Farcaster Frame'}
          fill
          className="object-cover"
          sizes="(max-width: 600px) 100vw, 600px"
          loading="lazy"
          decoding="async"
        />
        {loading !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          </div>
        )}
      </div>

      {/* Frame buttons */}
      {frameButtons.length > 0 && (
        <div className="grid gap-1 border-t border-[var(--color-glass-border)] p-1.5 grid-cols-1">
          {frameButtons.map((btn, idx) => (
            <button
              key={btn.index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleButton(btn, idx);
              }}
              disabled={loading !== null}
              className="flex-1 rounded bg-purple-900/20 px-2 py-1.5 text-center text-xs font-medium text-purple-300 transition-colors hover:bg-purple-900/40 hover:text-purple-200 disabled:opacity-50"
            >
              {btn.action === 'mint' && '◆ '}
              {btn.action === 'link' && '↗ '}
              {btn.action === 'post_redirect' && '→ '}
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
