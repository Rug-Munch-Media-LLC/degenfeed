'use client';

/**
 * @degenfeed/ui — LinkPreview
 *
 * Automatically detect URLs in text and fetch OG metadata.
 * Shows a rich preview card below the textarea/composed post.
 */

import { memo, useCallback, useEffect, useState } from 'react';

export interface LinkPreviewData {
  url: string;
  title: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  text: string;
  /** Max number of previews to show (default: 1) */
  max?: number;
}

const URL_REGEX =
  /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

const PREVIEW_CACHE = new Map<string, LinkPreviewData>();

export const LinkPreview = memo(function LinkPreview({ text, max = 1 }: LinkPreviewProps) {
  const [previews, setPreviews] = useState<LinkPreviewData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urls = Array.from(new Set(text.match(URL_REGEX) ?? [])).slice(0, max);
    if (urls.length === 0) {
      setPreviews([]);
      return;
    }

    // Check cache first
    const cached = urls.map((u) => PREVIEW_CACHE.get(u)).filter(Boolean) as LinkPreviewData[];
    if (cached.length === urls.length) {
      setPreviews(cached);
      return;
    }

    setLoading(true);
    const fetchPromises = urls.map(async (url) => {
      // Check cache
      const cached = PREVIEW_CACHE.get(url);
      if (cached) return cached;

      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as LinkPreviewData;
        PREVIEW_CACHE.set(url, data);
        return data;
      } catch {
        // Fallback: just show the URL
        const fallback: LinkPreviewData = { url, title: url };
        PREVIEW_CACHE.set(url, fallback);
        return fallback;
      }
    });

    Promise.allSettled(fetchPromises).then((results) => {
      const valid = results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter(Boolean) as LinkPreviewData[];
      setPreviews(valid);
      setLoading(false);
    });
  }, [text, max]);

  if (previews.length === 0 && !loading) return null;

  return (
    <div className="link-preview-container" role="region" aria-label="Link previews">
      {loading && (
        <div className="link-preview-skeleton">
          <div className="link-preview-skeleton-img skeleton-shimmer" />
          <div className="link-preview-skeleton-body">
            <div className="skeleton-shimmer h-3 w-3/4 mb-2 rounded" />
            <div className="skeleton-shimmer h-2.5 w-full mb-1 rounded" />
            <div className="skeleton-shimmer h-2 w-1/2 rounded" />
          </div>
        </div>
      )}
      {previews.map((preview) => (
        <a
          key={preview.url}
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="link-preview-card"
          onClick={(e) => e.stopPropagation()}
        >
          {preview.image ? (
            <div className="link-preview-img-wrapper">
              {/* biome-ignore lint/performance/noImgElement: shared UI package, not Next.js-coupled */}
              <img
                src={preview.image}
                alt=""
                className="link-preview-img"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : null}
          <div className="link-preview-body">
            <div className="link-preview-site">
              {preview.favicon && (
                // biome-ignore lint/performance/noImgElement: shared UI package
                <img src={preview.favicon} alt="" className="link-preview-favicon" />
              )}
              <span className="link-preview-sitename">
                {preview.siteName ?? new URL(preview.url).hostname}
              </span>
            </div>
            <div className="link-preview-title">{preview.title}</div>
            {preview.description && <div className="link-preview-desc">{preview.description}</div>}
          </div>
        </a>
      ))}
    </div>
  );
});
