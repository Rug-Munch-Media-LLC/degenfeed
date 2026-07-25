'use client';

/**
 * ImageDiscoveryClient — Full image discovery page with masonry grid,
 * source filters, category filters, infinite scroll, and creator spotlight.
 */

import type { UnifiedImage } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageViewer } from '../../components/visual-feed/ImageViewer';

type SortMode = 'trending' | 'latest';
type CategoryFilter = 'all' | 'art' | 'photography' | 'memes' | 'nft' | 'general' | 'ai';

const CATEGORIES: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'art', label: '🎨 Art' },
  { id: 'photography', label: '📷 Photography' },
  { id: 'memes', label: '😂 Memes' },
  { id: 'nft', label: '💎 NFT' },
  { id: 'ai', label: '🤖 AI' },
  { id: 'general', label: '📸 General' },
];

const SOURCES = [
  { id: 'pixelfed', label: 'Pixelfed', color: '#6366f1' },
  { id: 'zora', label: 'Zora', color: '#8b5cf6' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
  { id: 'nostr', label: 'Nostr', color: '#8e30eb' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'lens', label: 'Lens', color: '#00501e' },
  { id: 'reddit', label: 'Reddit', color: '#ff4500' },
];

interface CreatorSpotlight {
  id: string;
  displayName: string;
  avatarUrl?: string;
  handle?: string;
  imageCount: number;
  source: string;
}

export function ImageDiscoveryClient() {
  const [images, setImages] = useState<UnifiedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('trending');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [activeImage, setActiveImage] = useState<UnifiedImage | null>(null);
  const [creators] = useState<CreatorSpotlight[]>([
    { id: 'fc:1', displayName: 'Trending Creator', source: 'farcaster', imageCount: 142 },
    { id: 'nostr:abc', displayName: 'Nostr Artist', source: 'nostr', imageCount: 89 },
    { id: 'lens:def', displayName: 'Lens Photographer', source: 'lens', imageCount: 234 },
    { id: 'pixelfed:ghi', displayName: 'Pixelfed Shooter', source: 'pixelfed', imageCount: 567 },
  ]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchImages = useCallback(
    async (cursorOffset: number, append: boolean) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      if (!append) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: '30',
          ...(cursorOffset > 0 ? { cursor: String(cursorOffset) } : {}),
          ...(category !== 'all' ? { category } : {}),
          sort,
        });

        const endpoint =
          category !== 'all'
            ? `/api/feed/images/category?${params}`
            : `/api/feed/images/${sort}?${params}`;

        const res = await fetch(endpoint, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as {
          data: UnifiedImage[];
          nextCursor?: string;
          meta?: { total: number; perSource: Record<string, number>; errors?: string[] };
        };

        let newImages = data.data;

        // Apply client-side source filter if active
        if (sourceFilter) {
          newImages = newImages.filter((img) => img.source === sourceFilter);
        }

        if (append) {
          setImages((prev) => [...prev, ...newImages]);
        } else {
          setImages(newImages);
        }

        setHasMore(!!data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load images');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [sort, category, sourceFilter],
  );

  // Initial load and filter changes
  useEffect(() => {
    setCursor(0);
    setImages([]);
    fetchImages(0, false);
  }, [fetchImages]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingRef.current) {
          const newCursor = cursor + 30;
          setCursor(newCursor);
          fetchImages(newCursor, true);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, cursor, fetchImages]);

  const handleImageClick = useCallback((img: UnifiedImage, _index: number) => {
    setActiveImage(img);
  }, []);

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!activeImage) return;
      const idx = images.findIndex((i) => i.id === activeImage.id);
      if (direction === 'prev' && idx > 0) setActiveImage(images[idx - 1]!);
      else if (direction === 'next' && idx < images.length - 1) setActiveImage(images[idx + 1]!);
    },
    [activeImage, images],
  );

  const activeIndex = activeImage ? images.findIndex((i) => i.id === activeImage.id) : -1;

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-sm">
            🖼️
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-fg)]">Image Discovery</h1>
            <p className="text-xs text-[var(--color-muted)]">
              Explore images from every platform — one unified feed
            </p>
          </div>
        </div>

        {/* Sort tabs */}
        <div className="mb-3 flex gap-2">
          {(['trending', 'latest'] as SortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSort(mode)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                sort === mode
                  ? 'bg-degen-500/20 text-degen-400'
                  : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
            >
              {mode === 'trending' ? '🔥 Trending' : '🕐 Latest'}
            </button>
          ))}
        </div>

        {/* Category filters */}
        <div className="mb-3 flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === cat.id
                  ? 'bg-degen-500/20 text-degen-400 border border-degen-500/30'
                  : 'bg-[var(--color-overlay)] text-[var(--color-muted)] border border-transparent hover:border-[var(--color-border)]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Source filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSourceFilter(null)}
            className={`rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
              !sourceFilter
                ? 'bg-white/10 text-white'
                : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
            }`}
          >
            All Sources
          </button>
          {SOURCES.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => setSourceFilter(sourceFilter === src.id ? null : src.id)}
              className={`rounded-full px-3 py-1 text-[10px] font-medium transition-colors ${
                sourceFilter === src.id
                  ? 'text-white'
                  : 'bg-[var(--color-overlay)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
              }`}
              style={{
                backgroundColor: sourceFilter === src.id ? `${src.color}33` : undefined,
                border: sourceFilter === src.id ? `1px solid ${src.color}55` : undefined,
                color: sourceFilter === src.id ? src.color : undefined,
              }}
            >
              {src.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Creator spotlight */}
      {!loading && images.length > 0 && sort === 'trending' && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
            ✨ Creator Spotlight
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {creators.map((c) => (
              <div
                key={c.id}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-glass-border)] px-3 py-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-degen-500 to-purple-500 text-[10px] font-bold text-black">
                  {c.displayName[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-fg)]">{c.displayName}</p>
                  <p className="text-[10px] text-[var(--color-muted)]">{c.imageCount} images</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Masonry grid */}
      {loading && images.length === 0 ? (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="skeleton-card mb-4 animate-pulse rounded-xl"
              style={{
                height: `${200 + (i % 4) * 50}px`,
                breakInside: 'avoid',
                backgroundColor: 'var(--color-overlay)',
              }}
            />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[var(--color-muted)]">
          <span className="mb-3 text-4xl">📭</span>
          <p className="text-sm">No images found. Try a different filter.</p>
        </div>
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
          {images.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => handleImageClick(img, idx)}
              className="group relative mb-4 w-full overflow-hidden rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-glass-border)] transition-all duration-200 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-degen-500"
              style={{ breakInside: 'avoid' }}
            >
              <img
                src={img.imageUrl}
                alt={img.title || 'Image'}
                loading="lazy"
                className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                style={{ aspectRatio: `${img.aspectRatio || 4 / 3}` }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />

              {/* Source badge */}
              <span
                className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: `${img.sourceColor}cc`, color: '#fff' }}
              >
                {img.sourceBadge} {img.sourceLabel}
              </span>

              {/* Bottom gradient + info */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="truncate text-xs font-medium text-white">{img.author.displayName}</p>
                {img.title && <p className="truncate text-[10px] text-white/70">{img.title}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* Loading more indicator */}
      {loading && images.length > 0 && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-degen-500/30 border-t-degen-500" />
        </div>
      )}

      {/* Image viewer modal */}
      {activeImage && (
        <ImageViewer
          image={activeImage}
          onClose={() => setActiveImage(null)}
          onNavigate={handleNavigate}
          hasPrev={activeIndex > 0}
          hasNext={activeIndex < images.length - 1}
          onTip={(img) => {
            window.open(`/tip?to=${encodeURIComponent(img.author.id)}`, '_blank');
          }}
          onMint={(img) => {
            if (img.mintUrl) window.open(img.mintUrl, '_blank', 'noopener,noreferrer');
          }}
          onCollect={(img) => {
            if (img.collectUrl) window.open(img.collectUrl, '_blank', 'noopener,noreferrer');
          }}
          onShare={(img, protocol) => {
            const text = `Check out this image on DegenFeed! ${img.fullImageUrl || img.imageUrl}`;
            const url = `/api/cross-post?text=${encodeURIComponent(text)}&protocol=${protocol}`;
            fetch(url, { method: 'POST', credentials: 'include' }).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
