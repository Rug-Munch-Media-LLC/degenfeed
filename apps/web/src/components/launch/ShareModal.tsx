'use client';

import { useCallback, useState } from 'react';

interface ShareModalProps {
  /** Coin symbol */
  symbol: string;
  /** Coin name */
  name: string;
  /** Coin page URL */
  url: string;
  /** Creator address */
  creatorAddress?: string;
  /** Whether the modal is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
}

function getShareText(symbol: string, name: string, url: string, platform: string): string {
  const base = `🚀 Just launched $${symbol} (${name}) on DegenFeed! Fair prebonding curve — get in early before graduation!`;

  switch (platform) {
    case 'twitter':
      return `${base}\n\n${url}\n\n#DegenFeed #CreatorCoins #Web3`;
    case 'farcaster':
      return `${base}\n\n${url}`;
    case 'bluesky':
      return `${base}\n\n${url}`;
    case 'mastodon':
      return `${base}\n\n${url} #DegenFeed #CreatorCoins`;
    case 'nostr':
      return `${base}\n\n${url}`;
    case 'copy':
      return `${base}\n\n${url}`;
    default:
      return `${base}\n\n${url}`;
  }
}

const PLATFORMS = [
  { id: 'twitter', label: '𝕏 / Twitter', color: '#1DA1F2' },
  { id: 'farcaster', label: '◈ Farcaster', color: '#8a63d2' },
  { id: 'bluesky', label: '☁ Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: '🐘 Mastodon', color: '#6364ff' },
  { id: 'nostr', label: '☰ Nostr', color: '#8b5cf6' },
  { id: 'copy', label: '📋 Copy Link', color: 'var(--color-muted)' },
];

export default function ShareModal({
  symbol,
  name,
  url,
  creatorAddress,
  open,
  onClose,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(
    (platformId: string) => {
      const text = getShareText(symbol, name, url, platformId);

      if (platformId === 'copy') {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        return;
      }

      // Platform-specific share URLs
      const encodedUrl = encodeURIComponent(url);
      const encodedText = encodeURIComponent(text);
      let shareUrl: string;

      switch (platformId) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
          break;
        case 'bluesky':
          shareUrl = `https://bsky.app/intent/compose?text=${encodedText}`;
          break;
        case 'farcaster':
          // Use the share API if available
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal-backdrop)] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Share $${symbol}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-in" />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-slide-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] transition-colors hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)]"
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
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-purple-500/20">
            <span className="text-2xl">🚀</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Share ${symbol}</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Spread the word about {name} across the fediverse
          </p>
          {creatorAddress && (
            <p className="mt-1 font-mono text-[10px] text-[var(--color-muted)]">
              {creatorAddress.slice(0, 8)}...{creatorAddress.slice(-6)}
            </p>
          )}
        </div>

        {/* Platform buttons */}
        <div className="space-y-2.5">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => handleShare(platform.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:bg-degen-500/5 hover:text-degen-400"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: `${platform.color}18` }}
              >
                {platform.label.split(' ')[0]}
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
                className="text-[var(--color-muted)]"
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
          <div className="mt-4 rounded-lg bg-degen-500/15 px-4 py-2.5 text-center text-xs font-medium text-degen-400 animate-fade-in">
            ✅ Copied to clipboard! Share it anywhere.
          </div>
        )}

        {/* URL display */}
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted-bg)] px-3 py-2">
          <p className="text-[10px] text-[var(--color-muted)]">Coin URL</p>
          <p className="mt-0.5 truncate text-xs font-mono text-[var(--color-fg)]">{url}</p>
        </div>
      </div>
    </div>
  );
}
