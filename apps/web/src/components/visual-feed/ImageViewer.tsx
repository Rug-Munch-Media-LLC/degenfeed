'use client';

/**
 * Cross-Platform Image Viewer — Full-screen viewer for images from any protocol.
 *
 * Features:
 *   1. Full-screen image viewer with zoom/pan
 *   2. Source protocol badge display
 *   3. Creator info + tip button
 *   4. Bid/buy button (Zora) or collect button (Lens)
 *   5. Comments/reactions from source protocol
 *   6. Share to other protocols
 *   7. Download/save
 */

import type { UnifiedImage } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface ImageViewerProps {
  image: UnifiedImage;
  onClose: () => void;
  onTip?: (image: UnifiedImage) => void;
  onMint?: (image: UnifiedImage) => void;
  onCollect?: (image: UnifiedImage) => void;
  onShare?: (image: UnifiedImage, protocol: string) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

type ZoomLevel = 1 | 2 | 3;

export function ImageViewer({
  image,
  onClose,
  onTip,
  onMint,
  onCollect,
  onShare,
  onNavigate,
  hasPrev = false,
  hasNext = false,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState<ZoomLevel>(1);
  const [loaded, setLoaded] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; text: string; author: string }>>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; imgX: number; imgY: number } | null>(
    null,
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrev) onNavigate?.('prev');
          break;
        case 'ArrowRight':
          if (hasNext) onNavigate?.('next');
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom((z) => Math.min(3, (z + 1) as ZoomLevel));
          break;
        case '-':
          e.preventDefault();
          setZoom((z) => Math.max(1, (z - 1) as ZoomLevel));
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNavigate, hasPrev, hasNext]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Fetch comments if available
  useEffect(() => {
    if (!showComments) return;
    // Fetch comments from source protocol
    fetchComments(image)
      .then(setComments)
      .catch(() => {});
  }, [showComments, image]);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(3, (z + 1) as ZoomLevel)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(1, (z - 1) as ZoomLevel)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        dragRef.current = { startX: e.clientX, startY: e.clientY, imgX: pan.x, imgY: pan.y };
      }
    },
    [zoom, pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragRef.current && zoom > 1) {
        setPan({
          x: dragRef.current.imgX + (e.clientX - dragRef.current.startX),
          y: dragRef.current.imgY + (e.clientY - dragRef.current.startY),
        });
      }
    },
    [zoom],
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(image.fullImageUrl || image.imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `degenfeed-${image.id.replace(/[^a-zA-Z0-9]/g, '-')}.${blob.type.split('/')[1] || 'jpg'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(image.fullImageUrl || image.imageUrl, '_blank');
    }
  }, [image]);

  const SOURCE_ACTIONS: Record<string, { primary: string; action: (img: UnifiedImage) => void }> = {
    zora: {
      primary: 'Mint/Buy',
      action: (img) => onMint?.(img),
    },
    lens: {
      primary: 'Collect',
      action: (img) => onCollect?.(img),
    },
  };

  const sourceAction = SOURCE_ACTIONS[image.source];

  return (
    <div
      className="fixed inset-0 z-[100] flex bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Image viewer: ${image.title || 'Image'}`}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="Close viewer"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          type="button"
          onClick={() => onNavigate?.('prev')}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Previous image"
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={() => onNavigate?.('next')}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="Next image"
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-4">
        {/* Source badge */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${image.sourceColor}22`,
            color: image.sourceColor,
            border: `1px solid ${image.sourceColor}44`,
          }}
        >
          <span>{image.sourceBadge}</span>
          <span>{image.sourceLabel}</span>
        </span>

        {/* Creator info */}
        <div className="flex items-center gap-2">
          {image.author.avatarUrl ? (
            <img
              src={image.author.avatarUrl}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold text-white">
              {image.author.displayName?.[0] ?? '?'}
            </div>
          )}
          <span className="text-sm font-medium text-white">{image.author.displayName}</span>
          {image.author.handle && (
            <span className="text-xs text-white/60">@{image.author.handle}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Metadata */}
          {image.width && image.height && (
            <span className="text-xs text-white/50">
              {image.width}×{image.height}
            </span>
          )}
        </div>
      </div>

      {/* Main image area */}
      <div
        className="flex flex-1 items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        {!loaded && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span className="text-sm text-white/60">Loading...</span>
          </div>
        )}
        <img
          ref={imgRef}
          src={image.fullImageUrl || image.imageUrl}
          alt={image.title || 'Image'}
          className="max-h-screen max-w-full transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            opacity: loaded ? 1 : 0,
          }}
          onLoad={() => setLoaded(true)}
          draggable={false}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          {/* Left: actions */}
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
              aria-label="Zoom out"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <span className="w-8 text-center text-xs text-white/70">{zoom}×</span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
              aria-label="Zoom in"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex h-8 items-center justify-center rounded-lg bg-white/10 px-2 text-xs text-white transition-colors hover:bg-white/20"
            >
              Reset
            </button>

            <div className="mx-2 h-6 w-px bg-white/20" />

            {/* Tip button */}
            <button
              type="button"
              onClick={() => onTip?.(image)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-yellow-500/20 px-3 text-xs font-medium text-yellow-400 transition-colors hover:bg-yellow-500/30"
            >
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Tip
            </button>

            {/* Mint/Collect/Buy button */}
            {sourceAction && (
              <button
                type="button"
                onClick={() => sourceAction.action(image)}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-degen-500/20 px-3 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/30"
              >
                {sourceAction.primary}
              </button>
            )}

            {/* Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Download"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          </div>

          {/* Right: share */}
          <div className="flex items-center gap-2">
            {/* Original link */}
            {image.url && (
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-lg bg-white/10 px-3 text-xs text-white transition-colors hover:bg-white/20"
              >
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open Original
              </a>
            )}

            {/* Share buttons */}
            {['nostr', 'farcaster', 'bluesky', 'lens', 'mastodon'].map((protocol) => (
              <button
                key={protocol}
                type="button"
                onClick={() => onShare?.(image, protocol)}
                className="flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[10px] text-white capitalize transition-colors hover:bg-white/20"
              >
                {protocolBadge(protocol)} {protocol}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comments panel */}
      <div
        className="absolute right-0 top-0 bottom-16 z-10 w-80 overflow-y-auto border-l border-white/10 bg-black/90 p-4 backdrop-blur-md transition-transform"
        style={{ transform: showComments ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Comments</h3>
          <button
            type="button"
            onClick={() => setShowComments(false)}
            className="text-white/60 hover:text-white"
            aria-label="Close comments"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {comments.length === 0 ? (
          <p className="text-sm text-white/40">No comments available.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="mb-3 rounded-lg bg-white/5 p-3">
              <p className="text-xs font-medium text-white/70">{c.author}</p>
              <p className="mt-1 text-sm text-white/90">{c.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Toggle comments button */}
      <button
        type="button"
        onClick={() => setShowComments((v) => !v)}
        className="absolute right-4 top-16 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        aria-label="Toggle comments"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  );
}

function protocolBadge(protocol: string): string {
  const badges: Record<string, string> = {
    nostr: '⚡',
    farcaster: '🟣',
    bluesky: '🦋',
    lens: '🌿',
    mastodon: '🐘',
  };
  return badges[protocol] ?? '📤';
}

async function fetchComments(
  image: UnifiedImage,
): Promise<Array<{ id: string; text: string; author: string }>> {
  try {
    const res = await fetch(`/api/replies?postId=${encodeURIComponent(image.id)}&limit=20`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<{ id: string; text: string; author: { displayName: string } }>;
    };
    return (data.data ?? []).map((c) => ({
      id: c.id,
      text: c.text,
      author: c.author?.displayName ?? 'Anonymous',
    }));
  } catch {
    return [];
  }
}
