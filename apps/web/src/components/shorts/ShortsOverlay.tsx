'use client';

/**
 * ShortsOverlay — Bottom info overlay on the shorts card.
 *
 * Shows creator avatar + handle, source protocol badge, caption,
 * hashtags, Zora NFT mint badge (if minted), and cross-platform
 * action buttons for tipping across ETH (Base), SOL (Solana),
 * Lightning (Nostr), and Zora collect.
 *
 * Design: Immersive dark cyberpunk with neon-green degen accents.
 * Gradient fade from transparent to black at the bottom for readability.
 */

import Image from 'next/image';
import { ShortsSourceBadge } from './ShortsSourceBadge';
import type { ZoraNftInfo, CrossChainTip, ShortSource } from '../../hooks/useUnifiedShorts';

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function truncateText(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

function formatMintPrice(price: string, currency: string): string {
  const num = Number.parseFloat(price);
  if (Number.isNaN(num)) return price;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M ${currency}`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K ${currency}`;
  if (num >= 0.001) return `${num.toFixed(3)} ${currency}`;
  return `${price} ${currency}`;
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface ShortsOverlayProps {
  source: ShortSource;
  sourceLabel: string;
  sourceColor?: string;
  avatarUrl?: string;
  displayName: string;
  handle: string;
  caption: string;
  hashtags: string[];
  niche?: string;
  publishedAt: number;
  visible: boolean;
  captionExpanded: boolean;
  onToggleCaption: () => void;
  onProfileClick?: (e: React.MouseEvent) => void;
  /** Zora NFT mint data */
  nft?: ZoraNftInfo;
  /** Cross-platform tip addresses */
  tips?: CrossChainTip;
  /** Callbacks for tip actions */
  onTipEth?: () => void;
  onTipSol?: () => void;
  onCollectZora?: () => void;
  onTipLightning?: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ShortsOverlay({
  source,
  sourceLabel,
  sourceColor,
  avatarUrl,
  displayName,
  handle,
  caption,
  hashtags,
  niche,
  publishedAt,
  visible,
  captionExpanded,
  onToggleCaption,
  onProfileClick,
  nft,
  tips,
  onTipEth,
  onTipSol,
  onCollectZora,
  onTipLightning,
}: ShortsOverlayProps) {
  if (!visible) return null;

  const hasNft = Boolean(nft);
  const hasTipZora = Boolean(tips?.zora);
  const hasEthTip = Boolean(tips?.eth && onTipEth);
  const hasSolTip = Boolean(tips?.sol && onTipSol);
  const hasLightningTip = Boolean(tips?.lightning && onTipLightning);
  const showCollectSection = hasNft || hasTipZora || hasEthTip || hasSolTip || hasLightningTip;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      {/* Gradient fade for readability */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />

      <div className="relative z-10 px-4 pb-5 pt-16">
        {/* ── Creator row ── */}
        <div className="mb-2 flex items-center gap-2">
          {onProfileClick ? (
            <button type="button" onClick={onProfileClick} className="flex items-center gap-2 group">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={30}
                  height={30}
                  className="h-7 w-7 rounded-full border border-white/10 object-cover transition-transform duration-200 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400 transition-transform duration-200 group-hover:scale-110">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold text-white drop-shadow-lg">
                {displayName}
              </span>
              <span className="hidden text-xs text-white/60 drop-shadow-lg sm:inline">
                @{handle}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  width={30}
                  height={30}
                  className="h-7 w-7 rounded-full border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-degen-500/20 text-[10px] font-bold text-degen-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold text-white drop-shadow-lg">
                {displayName}
              </span>
              <span className="hidden text-xs text-white/60 drop-shadow-lg sm:inline">
                @{handle}
              </span>
            </div>
          )}

          {/* Source badge */}
          <ShortsSourceBadge source={source} label={sourceLabel} color={sourceColor} size="sm" />
        </div>

        {/* ── Caption ── */}
        <div className="mb-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCaption();
            }}
            className="block text-left"
            aria-expanded={captionExpanded}
          >
            <p className="text-sm leading-snug text-white/90 drop-shadow-lg">
              {captionExpanded ? caption : truncateText(caption, 100)}
            </p>
            {caption.length > 100 && !captionExpanded && (
              <span className="text-[11px] font-medium text-white/50">…more</span>
            )}
          </button>
        </div>

        {/* ── Hashtags ── */}
        {hashtags.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <a
                key={tag}
                href={`/topics/${encodeURIComponent(tag.slice(1))}`}
                className="text-xs font-medium text-degen-400/90 transition-colors hover:text-degen-300 drop-shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {tag}
              </a>
            ))}
          </div>
        )}

        {/* ── Niche + Time ── */}
        <div className="mb-2 flex items-center gap-1.5">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-white/50"
          >
            <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span className="text-xs text-white/60 drop-shadow-lg">
            {niche
              ? `${niche} · ${formatTimeAgo(publishedAt)}`
              : formatTimeAgo(publishedAt)}
          </span>
        </div>

        {/* ── Zora NFT mint badge ── */}
        {nft && (
          <div className="mb-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCollectZora?.();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
              style={{
                backgroundColor: '#0052FF18',
                borderColor: '#0052FF40',
                color: '#0052FF',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="4" opacity=".3" />
                <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Collect on Zora</span>
              <span className="ml-0.5 opacity-70">
                {formatMintPrice(nft.mintPrice, nft.mintCurrency)}
              </span>
              <span className="opacity-50">
                · {nft.mintedCount}/{nft.editionSize}
              </span>
            </button>
          </div>
        )}

        {/* ── Cross-platform tip buttons ── */}
        {showCollectSection && (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Tip via ETH (Base) */}
            {tips?.eth && onTipEth && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTipEth();
                }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
                style={{
                  backgroundColor: '#627EEA18',
                  borderColor: '#627EEA40',
                  color: '#627EEA',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5L12 2zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span>ETH</span>
              </button>
            )}

            {/* Tip via SOL (Solana) */}
            {tips?.sol && onTipSol && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTipSol();
                }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
                style={{
                  backgroundColor: '#9945FF18',
                  borderColor: '#9945FF40',
                  color: '#9945FF',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" opacity=".3" />
                  <path d="M12 6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6z" />
                </svg>
                <span>SOL</span>
              </button>
            )}

            {/* Collect via Zora (if not shown above) */}
            {tips?.zora && !nft && onCollectZora && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCollectZora();
                }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
                style={{
                  backgroundColor: '#0052FF18',
                  borderColor: '#0052FF40',
                  color: '#0052FF',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="4" opacity=".3" />
                  <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span>Zora</span>
              </button>
            )}

            {/* Tip via Lightning (Nostr) */}
            {tips?.lightning && onTipLightning && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onTipLightning();
                }}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wider transition-all hover:brightness-110 active:scale-95"
                style={{
                  backgroundColor: '#F5A62318',
                  borderColor: '#F5A62340',
                  color: '#F5A623',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <span>⚡</span>
              </button>
            )}
          </div>
        )}

        {/* ── Swipe up hint ── */}
        <div className="mt-3 flex items-center gap-1.5 opacity-40">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-white/50">
            <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[9px] text-white/40">Swipe up for details</span>
        </div>
      </div>
    </div>
  );
}
