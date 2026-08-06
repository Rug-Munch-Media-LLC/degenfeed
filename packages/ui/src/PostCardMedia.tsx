'use client';

import type { ContentProof, Embed } from '@degenfeed/types';
import { isShortFormVideo, proxyMediaUrl, type VideoInfo } from '@degenfeed/utils';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { FrameEmbed } from './FrameEmbed';
import { VideoPlayer } from './VideoPlayer';

// ─── Frame Data ────────────────────────────────────────────────────

interface FrameData {
  url: string;
  image: string;
  title?: string;
  buttons: Array<{ index: number; label: string; action?: string; target?: string }>;
  postUrl?: string;
  version: string;
}

function FrameCard({ url }: { url: string }) {
  const [frame, setFrame] = useState<FrameData | null>(null);
  const [_loading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/frame/resolve?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FrameData>) : null))
      .then((d) => {
        if (!cancelled && d?.image) setFrame(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!frame) return null;

  return (
    <FrameEmbed
      url={frame.url}
      image={frame.image}
      title={frame.title}
      buttons={frame.buttons}
      postUrl={frame.postUrl}
    />
  );
}

// ─── Link Preview ──────────────────────────────────────────────────

function LinkPreview({
  embed,
  authorName,
  mediaPriority = false,
}: {
  embed: Embed;
  authorName?: string;
  /** Eager-load the preview image for above-the-fold cards. */
  mediaPriority?: boolean;
}) {
  const meta = embed.meta as { title?: string; description?: string; image?: string } | undefined;
  const title = meta?.title;
  const description = meta?.description;
  const image = meta?.image;
  // Some protocol bridges emit `{ kind: 'link' }` embeds without a URL (e.g.
  // Farcaster casts with text-only embeds). Never call .replace() on undefined.
  const url = embed.url || '';
  const host = url ? url.replace(/^https?:\/\//, '').split('/')[0] : '';

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview group mt-2 block overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:bg-[var(--color-card-hover)]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {image && (
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={proxyMediaUrl(image)}
            alt={
              authorName && title
                ? `Preview image for ${title}`
                : title || (authorName ? `Link preview in post by ${authorName}` : 'Link preview')
            }
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading={mediaPriority ? 'eager' : 'lazy'}
            priority={mediaPriority}
            decoding="async"
            onError={(e) => {
              // Broken preview image → collapse the image block instead of
              // showing a broken-image icon.
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}
      <div className="p-3">
        {host && (
          <p className="mb-1 text-[11px] text-[var(--color-muted)] uppercase tracking-wide">
            {host}
          </p>
        )}
        {title && (
          <p className="link-title mb-1 text-sm font-semibold text-[var(--color-fg)] line-clamp-1">
            {title}
          </p>
        )}
        {description && (
          <p className="link-desc text-xs text-[var(--color-muted)] line-clamp-2">{description}</p>
        )}
        {!title && !description && url && (
          <p className="truncate text-xs text-degen-500">{url.replace(/^https?:\/\//, '')}</p>
        )}
      </div>
    </a>
  );
}

// ─── Video Embed ───────────────────────────────────────────────────

function VideoEmbedCard({ videoInfo }: { videoInfo: VideoInfo }) {
  const isShort = isShortFormVideo(videoInfo);
  const [open, setOpen] = useState(false);

  if (videoInfo.platform === 'youtube') {
    return (
      <div className={isShort ? 'max-w-[360px] mx-auto' : ''}>
        <VideoPlayer
          youtubeId={videoInfo.id}
          platform="youtube"
          aspectRatio={isShort ? '9:16' : '16:9'}
          className="mt-2"
        />
      </div>
    );
  }

  // Direct (mp4/webm) and PeerTube videos: show a poster thumbnail with a
  // play button overlay; tapping opens the full player in a modal/lightbox.
  const poster = proxyMediaUrl(videoInfo.url);

  return (
    <>
      <div className="relative mt-2 overflow-hidden rounded-xl bg-black" style={{ aspectRatio: isShort ? '9/16' : '16/9' }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/40"
          aria-label="Play video"
        >
          {/* Poster frame (proxy URL keeps hotlink-protected hosts working) */}
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-70"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-95">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      </div>

      {/* Lightbox modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          <div
            className="w-full max-w-4xl overflow-hidden rounded-xl bg-black"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: '90vh' }}
          >
            <VideoPlayer
              src={videoInfo.url}
              platform="direct"
              aspectRatio={isShort ? '9:16' : '16:9'}
              className="max-h-[90vh]"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Close video"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M15 5L5 15M5 5l10 10" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}

// ─── Audio Embed ───────────────────────────────────────────────────

function AudioEmbedCard({ embed }: { embed: Embed }) {
  const title =
    typeof embed.meta?.title === 'string'
      ? embed.meta.title
      : typeof embed.meta?.podcastTitle === 'string'
        ? embed.meta.podcastTitle
        : 'Audio';
  const artist =
    typeof embed.meta?.artist === 'string'
      ? embed.meta.artist
      : typeof embed.meta?.podcastHost === 'string'
        ? embed.meta.podcastHost
        : undefined;

  return (
    <div
      className="mt-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card)] p-3"
      role="group"
      aria-label="Audio player"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-fg)]">{title}</p>
          {artist && <p className="truncate text-xs text-[var(--color-muted)]">{artist}</p>}
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: 'var(--color-accent)20', color: 'var(--color-accent)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z" />
          </svg>
          Audio
        </span>
      </div>

      {/* Minimal waveform-style visualizer + native player */}
      <div className="mb-2 flex h-8 items-center gap-[2px]" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="w-full rounded-full"
            style={{
              height: `${30 + Math.abs(Math.sin(i * 1.7)) * 60}%`,
              backgroundColor: 'var(--color-accent)55',
              opacity: 0.4 + (Math.abs(Math.sin(i * 1.7)) * 0.6),
            }}
          />
        ))}
      </div>

      <audio src={embed.url} controls preload="none" className="w-full" style={{ maxWidth: '100%' }} />
    </div>
  );
}

// ─── Image Grid ────────────────────────────────────────────────────

/**
 * Single broken-image fallback for an image tile. Shown when the proxy
 * returns 404/415 or the upstream host is unreachable.
 */
function BrokenImageTile({ label }: { label: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-[var(--color-overlay)]"
      role="img"
      aria-label={`Image unavailable — ${label}`}
    >
      <span className="text-2xl opacity-30" aria-hidden="true">
        🖼️
      </span>
    </div>
  );
}

function ImageTile({
  src,
  alt,
  className = '',
  mediaPriority = false,
  fill = false,
}: {
  src: string;
  alt: string;
  className?: string;
  mediaPriority?: boolean;
  fill?: boolean;
}) {
  const [error, setError] = useState(false);
  const proxied = proxyMediaUrl(src);

  if (error || !proxied) {
    return <BrokenImageTile label={alt} />;
  }

  if (fill) {
    return (
      <Image
        src={proxied}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 600px"
        className={`object-cover ${className}`}
        loading={mediaPriority ? 'eager' : 'lazy'}
        priority={mediaPriority}
        decoding="async"
        onError={() => setError(true)}
      />
    );
  }

  return (
    <Image
      src={proxied}
      alt={alt}
      width={200}
      height={200}
      className={`object-cover ${className}`}
      loading={mediaPriority ? 'eager' : 'lazy'}
      priority={mediaPriority}
      decoding="async"
      onError={() => setError(true)}
    />
  );
}

function ImageGrid({
  images,
  authorName,
  mediaPriority = false,
}: {
  images: string[];
  authorName?: string;
  /** Eager-load images for above-the-fold cards. */
  mediaPriority?: boolean;
}) {
  const altText = authorName ? `Image in post by ${authorName}` : 'Post image';

  if (images.length === 1) {
    return (
      <div
        className="image-grid mt-2 max-h-80 overflow-hidden rounded-[12px] border border-[var(--color-border)]"
        role="group"
        aria-label="Post images"
      >
        <ImageTile src={images[0]!} alt={altText} mediaPriority={mediaPriority} />
      </div>
    );
  }
  if (images.length === 2) {
    return (
      <div
        className="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-xl"
        role="group"
        aria-label="Post images"
      >
        {images.map((url) => (
          <div key={url} className="relative aspect-square w-full overflow-hidden">
            <ImageTile src={url} alt={altText} mediaPriority={mediaPriority} fill />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      className="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-xl"
      role="group"
      aria-label="Post images"
    >
      {images.slice(0, 4).map((url, idx) => (
        <div key={url} className="relative aspect-square w-full overflow-hidden">
          <ImageTile src={url} alt={altText} mediaPriority={mediaPriority} fill />
          {idx === 3 && images.length > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm font-bold text-[var(--color-fg)]">
              +{images.length - 4}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Permanence Badge ──────────────────────────────────────────────

function PermanenceBadge({ proof }: { proof: ContentProof }) {
  const tooltipParts: string[] = [];
  if (proof.arweaveTxId) {
    tooltipParts.push(`Arweave: ${proof.arweaveTxId.slice(0, 8)}...${proof.arweaveTxId.slice(-4)}`);
  }
  if (proof.ipfsCid) {
    tooltipParts.push(`IPFS: ${proof.ipfsCid.slice(0, 8)}...`);
  }
  if (proof.onChainTxHash) {
    const chainName = proof.onChainChainId === 8453 ? 'Base' : `Chain ${proof.onChainChainId}`;
    tooltipParts.push(
      `${chainName}: ${proof.onChainTxHash.slice(0, 8)}...${proof.onChainTxHash.slice(-4)}`,
    );
  }

  const tooltip =
    tooltipParts.length > 0
      ? `Stored permanently\n${tooltipParts.join('\n')}`
      : 'Stored permanently';

  return (
    <div className="mb-3 flex flex-wrap gap-2 items-center">
      <a
        href={
          proof.arweaveTxId
            ? `https://arweave.net/${proof.arweaveTxId}`
            : proof.ipfsCid
              ? `https://ipfs.io/ipfs/${proof.ipfsCid}`
              : undefined
        }
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-full bg-cyan-950/40 px-2 py-0.5 text-[10px] font-medium text-cyan-400 hover:bg-cyan-900/50 transition-colors"
        title={tooltip}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span>🔗</span> Permanent
      </a>

      {proof.onChainTxHash && (
        <a
          href={
            proof.onChainChainId === 8453
              ? `https://basescan.org/tx/${proof.onChainTxHash}`
              : proof.onChainChainId === 1
                ? `https://etherscan.io/tx/${proof.onChainTxHash}`
                : undefined
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-amber-950/40 px-2 py-0.5 text-[10px] font-medium text-amber-400 hover:bg-amber-900/50 transition-colors"
          title={`On-chain anchor on ${proof.onChainChainId === 8453 ? 'Base' : `Chain ${proof.onChainChainId}`}: ${proof.onChainTxHash.slice(0, 8)}...${proof.onChainTxHash.slice(-4)}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <span>🔒</span> On-chain
        </a>
      )}
    </div>
  );
}

// ─── Media Rendering ───────────────────────────────────────────────

export interface MediaSectionProps {
  embed: Embed;
}

export {
  AudioEmbedCard,
  FrameCard,
  ImageGrid,
  LinkPreview,
  PermanenceBadge,
  VideoEmbedCard,
};
