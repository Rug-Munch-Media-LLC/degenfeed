/**
 * @degenfeed/ui — Lemmy Thread View Media Components
 *
 * ImagePreview, VideoPreview, LinkPreview, and parseContentMedia.
 */

'use client';

import { memo, useMemo, useRef, useState } from 'react';
import { getDomain, getFaviconUrl, isImageUrl, isVideoUrl } from './lemmy-helpers';
import { useInView } from './lemmy-hooks';

// ─── Media Parsing ──────────────────────────────────────────────────

export function parseContentMedia(content: string): {
  cleanText: string;
  media: { images: string[]; videos: string[]; links: { url: string; text: string }[] };
} {
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,:;!?)]|[\w-]+(?:\.[a-z]{2,}){1,2}[^\s<]*)/gi;
  const images: string[] = [];
  const videos: string[] = [];
  const links: { url: string; text: string }[] = [];
  const segments: string[] = [];
  let lastIndex = 0;

  const re = new RegExp(urlRegex.source, 'gi');
  let match = re.exec(content);
  while (match !== null) {
    let url = match[0];
    url = url.replace(/[.,:;!?)\]]+$/, '');
    if (match.index > lastIndex) segments.push(content.slice(lastIndex, match.index));
    if (isImageUrl(url)) images.push(url);
    else if (isVideoUrl(url)) videos.push(url);
    else {
      links.push({ url, text: url });
      segments.push(url);
    }
    lastIndex = match.index + match[0].length;
    match = re.exec(content);
  }
  if (lastIndex < content.length) segments.push(content.slice(lastIndex));

  return { cleanText: segments.join(''), media: { images, videos, links } };
}

// ─── Media Preview Components ───────────────────────────────────────

export const ImagePreview = memo(function ImagePreview({ src }: { src: string }) {
  const [expanded, setExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);

  return (
    <div ref={ref} className="mt-1.5">
      {inView && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="group relative block overflow-hidden rounded-lg border border-white/10 transition-all hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
            aria-label={expanded ? 'Collapse image' : 'Expand image'}
          >
            <div
              className={`relative ${expanded ? 'max-h-[600px]' : 'max-h-[200px]'} overflow-hidden transition-all duration-300`}
            >
              <img
                src={src}
                alt=""
                className={`w-full object-cover transition-all duration-300 ${expanded ? 'max-h-[600px]' : 'max-h-[200px]'} ${loaded ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={() => setLoaded(true)}
              />
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-degen-400" />
                </div>
              )}
            </div>
            <div className="absolute bottom-1 right-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] text-white/70 opacity-0 transition-opacity group-hover:opacity-100">
              {expanded ? 'Collapse' : 'Expand'}
            </div>
          </button>
          {expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
              aria-label="Close expanded image"
            >
              <img
                src={src}
                alt="Expanded"
                className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setExpanded(false);
                }}
              />
              <button
                type="button"
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                aria-label="Close"
                onClick={() => setExpanded(false)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </button>
          )}
        </>
      )}
      {!inView && <div className="h-[100px] rounded-lg bg-white/[0.02] animate-pulse" />}
    </div>
  );
});

export const VideoPreview = memo(function VideoPreview({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [showPlayer, setShowPlayer] = useState(false);

  const embedUrl = useMemo(() => {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host.includes('youtube.com')) {
        const v = parsed.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
      }
      if (host.includes('youtu.be')) {
        const id = parsed.pathname.slice(1).split('?')[0];
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
      }
      if (host.includes('vimeo.com')) {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
      }
    } catch {
      /* invalid URL */
    }
    return null;
  }, [url]);

  if (showPlayer && embedUrl) {
    return (
      <div className="mt-1.5 aspect-video w-full overflow-hidden rounded-lg border border-white/10">
        <iframe
          src={embedUrl}
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Video"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div ref={ref} className="mt-1.5">
      {inView && (
        <button
          type="button"
          onClick={() => setShowPlayer(true)}
          className="group relative block w-full overflow-hidden rounded-lg border border-white/10 bg-black/40 transition-all hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-degen-400/60"
        >
          <div className="flex items-center gap-2 p-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" opacity="0.6" />
            </svg>
            <span className="truncate text-xs text-white/60">{getDomain(url)}</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </button>
      )}
      {!inView && <div className="h-[40px] rounded-lg bg-white/[0.02] animate-pulse" />}
    </div>
  );
});

export const LinkPreview = memo(function LinkPreview({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const domain = getDomain(url);

  return (
    <div ref={ref} className="mt-1.5">
      {inView && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 transition-all hover:border-white/20 hover:bg-white/[0.04]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <img
            src={getFaviconUrl(url)}
            alt=""
            className="h-4 w-4 rounded"
            width={16}
            height={16}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="truncate text-xs text-white/50 transition-colors group-hover:text-white/70">
            {domain}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            className="ml-auto shrink-0 text-white/30"
            aria-hidden="true"
          >
            <path
              d="M5 2H2V10H10V7M6 6L10 2M10 2H7M10 2V5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      )}
      {!inView && <div className="h-[32px] rounded-lg bg-white/[0.02] animate-pulse" />}
    </div>
  );
});

export const MediaContent = memo(function MediaContent({
  images,
  videos,
  links,
}: {
  images: string[];
  videos: string[];
  links: { url: string; text: string }[];
}) {
  return (
    <div className="space-y-1">
      {images.slice(0, 4).map((src) => (
        <ImagePreview key={src} src={src} />
      ))}
      {images.length > 4 && (
        <p className="text-[10px] text-gray-600 px-1">+{images.length - 4} more images</p>
      )}
      {videos.slice(0, 2).map((url) => (
        <VideoPreview key={url} url={url} />
      ))}
      {videos.length > 2 && (
        <p className="text-[10px] text-gray-600 px-1">+{videos.length - 2} more videos</p>
      )}
      {links.slice(0, 3).map((link) => (
        <LinkPreview key={link.url} url={link.url} />
      ))}
      {links.length > 3 && (
        <p className="text-[10px] text-gray-600 px-1">+{links.length - 3} more links</p>
      )}
    </div>
  );
});
