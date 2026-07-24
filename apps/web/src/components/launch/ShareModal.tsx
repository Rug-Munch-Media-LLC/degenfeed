'use client';

import { useCallback, useRef, useState } from 'react';
import { useIsMobile } from '../../hooks/useMobileResponsive';

interface ShareModalProps {
  symbol: string;
  name: string;
  url: string;
  creatorAddress?: string;
  open: boolean;
  onClose: () => void;
}

function getShareText(symbol: string, name: string, url: string, platform: string): string {
  const base = `🚀 Just launched $${symbol} (${name}) on DegenFeed! Fair prebonding curve — get in early before graduation!`;
  switch (platform) {
    case 'twitter':
      return `${base}\n\n${url}\n\n#DegenFeed #CreatorCoins #Web3`;
    default:
      return `${base}\n\n${url}`;
  }
}

const PLATFORMS = [
  { id: 'twitter', label: '𝕏 / Twitter', color: '#1DA1F2', short: '𝕏' },
  { id: 'farcaster', label: '◈ Farcaster', color: '#8a63d2', short: '◈' },
  { id: 'bluesky', label: '☁ Bluesky', color: '#1185fe', short: '☁' },
  { id: 'mastodon', label: '🐘 Mastodon', color: '#6364ff', short: '🐘' },
  { id: 'nostr', label: '☰ Nostr', color: '#8b5cf6', short: '☰' },
  { id: 'copy', label: '📋 Copy Link', color: 'var(--color-muted)', short: '📋' },
];

export default function ShareModal({
  symbol,
  name,
  url,
  creatorAddress,
  open,
  onClose,
}: ShareModalProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleShare = useCallback(
    (platformId: string) => {
      const text = getShareText(symbol, name, url, platformId);

      if (platformId === 'copy') {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setCopyError(null);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {
            try {
              const ta = document.createElement('textarea');
              ta.value = text;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              setCopied(true);
              setCopyError(null);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopyError('Failed to copy');
              setTimeout(() => setCopyError(null), 2000);
            }
          });
        return;
      }

      const encodedText = encodeURIComponent(text);
      const encodedUrl = encodeURIComponent(url);
      let shareUrl: string;

      switch (platformId) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
          break;
        case 'bluesky':
          shareUrl = `https://bsky.app/intent/compose?text=${encodedText}`;
          break;
        case 'farcaster':
          shareUrl = `https://warpcast.com/~/compose?text=${encodedText}&embeds[]=${encodedUrl}`;
          break;
        case 'mastodon':
          shareUrl = `https://mastodon.social/share?text=${encodedText}`;
          break;
        case 'nostr':
          shareUrl = `https://snort.social/new?message=${encodedText}`;
          break;
        default:
          shareUrl = url;
      }

      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    },
    [symbol, name, url],
  );

  // Swipe down to dismiss (mobile)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return;
      touchStartRef.current = { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
    },
    [isMobile],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile || !touchStartRef.current) return;
      const dy = (e.changedTouches[0]?.clientY ?? 0) - touchStartRef.current.y;
      if (dy > 100) {
        onClose();
      }
      touchStartRef.current = null;
    },
    [isMobile, onClose],
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      ref={modalRef}
      className={`fixed inset-0 z-[var(--z-modal-backdrop)] flex ${
        isMobile ? 'items-end mobile-bottom-sheet' : 'items-center justify-center'
      } p-0 sm:p-4`}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={`Share $${symbol}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-in" />

      {/* Modal content */}
      <div
        className={`relative w-full max-w-md animate-slide-up shadow-2xl border border-[var(--color-border)] bg-[var(--color-card)] ${
          isMobile ? 'modal-mobile-content rounded-t-2xl rounded-b-none pb-safe' : 'rounded-2xl p-6'
        } ${isMobile ? 'p-5' : ''}`}
        style={isMobile ? { maxHeight: '90dvh' } : undefined}
      >
        {/* Swipe indicator (mobile) */}
        {isMobile && (
          <div className="flex justify-center mb-3">
            <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
          </div>
        )}

        {/* Close button — larger on mobile */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute ${
            isMobile ? 'right-3 top-3' : 'right-4 top-4'
          } flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] touch-target`}
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className={`text-center ${isMobile ? 'mb-4 mt-2' : 'mb-6'}`}>
          <div className="mx-auto mb-3 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-purple-500/20">
            <span className="text-xl sm:text-2xl">🚀</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--color-fg)]">Share ${symbol}</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Spread the word across the fediverse
          </p>
          {creatorAddress && (
            <p className="mt-1 font-mono text-[10px] text-[var(--color-muted)]">
              {creatorAddress.slice(0, 8)}...{creatorAddress.slice(-6)}
            </p>
          )}
        </div>

        {/* Platform buttons */}
        <div className={`space-y-2.5 ${isMobile ? 'flex-1 overflow-y-auto' : ''}`}>
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => handleShare(platform.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-3.5 sm:py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:bg-degen-500/5 hover:text-degen-400 touch-target"
              style={{ minHeight: 48 }}
            >
              <span
                className="flex h-9 w-9 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: `${platform.color}18` }}
              >
                {isMobile ? platform.short : platform.label.split(' ')[0]}
              </span>
              <span className="flex-1 text-left">{platform.label}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--color-muted)] shrink-0"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          ))}
        </div>

        {/* Copied toast */}
        {copied && (
          <div className="mt-3 sm:mt-4 rounded-lg bg-degen-500/15 px-4 py-2.5 text-center text-xs font-medium text-degen-400 animate-fade-in touch-target">
            ✅ Copied to clipboard!
          </div>
        )}

        {/* Copy error */}
        {copyError && (
          <div className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-center text-xs text-red-400">
            {copyError}
          </div>
        )}

        {/* URL display */}
        <div className="mt-3 sm:mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-muted)]">Coin URL</p>
          <p className="mt-0.5 truncate text-xs font-mono text-[var(--color-fg)]">{url}</p>
        </div>

        {/* Safe area spacer for mobile */}
        {isMobile && <div className="h-2" />}
      </div>
    </div>
  );
}
