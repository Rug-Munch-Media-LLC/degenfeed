'use client';

import type { ContentProof, Embed } from '@degenfeed/types';
import { isShortFormVideo, type VideoInfo } from '@degenfeed/utils';
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

function LinkPreview({ embed, authorName }: { embed: Embed; authorName?: string }) {
  const meta = embed.meta as { title?: string; description?: string; image?: string } | undefined;
  const title = meta?.title;
  const description = meta?.description;
  const image = meta?.image;
  const host = embed.url ? embed.url.replace(/^https?:\/\//, '').split('/')[0] : '';

  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="link-preview group mt-2 block overflow-hidden rounded-[12px] border border-[var(--color-border)] bg-[var(--color-card)] transition-all hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:bg-[var(--color-card-hover)]"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {image && (
        <div className="relative aspect-video w-full overflow-hidden">
          <Image
            src={image}
            alt={
              authorName && title
                ? `Preview image for ${title}`
                : title || (authorName ? `Link preview in post by ${authorName}` : 'Link preview')
            }
            fill
            sizes="(max-width: 640px) 100vw, 600px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
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
        {!title && !description && (
          <p className="truncate text-xs text-degen-500">{embed.url.replace(/^https?:\/\//, '')}</p>
        )}
      </div>
    </a>
  );
}

// ─── Video Embed ───────────────────────────────────────────────────

function VideoEmbedCard({ videoInfo }: { videoInfo: VideoInfo }) {
  const isShort = isShortFormVideo(videoInfo);

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

  return (
    <VideoPlayer
      src={videoInfo.url}
      platform="direct"
      aspectRatio={isShort ? '9:16' : '16:9'}
      className="mt-2"
    />
  );
}

// ─── Image Grid ────────────────────────────────────────────────────

function ImageGrid({ images, authorName }: { images: string[]; authorName?: string }) {
  const altText = authorName ? `Image in post by ${authorName}` : 'Post image';

  if (images.length === 1) {
    return (
      <div
        className="image-grid mt-2 max-h-80 overflow-hidden rounded-[12px] border border-[var(--color-border)]"
        role="group"
        aria-label="Post images"
      >
        <Image
          src={images[0]!}
          alt={altText}
          width={200}
          height={200}
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
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
          <Image
            key={url}
            src={url}
            alt={altText}
            width={200}
            height={200}
            className="aspect-square w-full object-cover"
            loading="lazy"
            decoding="async"
          />
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
        <div key={url} className="relative aspect-square">
          <Image
            src={url}
            alt={altText}
            width={200}
            height={200}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
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

export { FrameCard, ImageGrid, LinkPreview, PermanenceBadge, VideoEmbedCard };
