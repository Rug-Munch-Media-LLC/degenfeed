'use client';

import { useCallback, useRef, useState } from 'react';
import {
  getBadgeUrl,
  getPoweredByText,
  type ShareConfig,
  type SharePlatform,
} from '../../lib/marketing';

// ─── Types ───────────────────────────────────────────────────────────────

interface ShareCardProps {
  shareConfig: ShareConfig;
  bondingProgress: number;
  onClose: () => void;
  open: boolean;
}

interface PlatformDef {
  id: SharePlatform;
  label: string;
  color: string;
  icon: string;
}

const PLATFORMS: PlatformDef[] = [
  { id: 'twitter', label: '𝕏 / Twitter', color: '#1DA1F2', icon: '𝕏' },
  { id: 'farcaster', label: '◈ Farcaster', color: '#8a63d2', icon: '◈' },
  { id: 'bluesky', label: '☁ Bluesky', color: '#1185fe', icon: '☁' },
  { id: 'mastodon', label: '🐘 Mastodon', color: '#6364ff', icon: '🐘' },
  { id: 'nostr', label: '☰ Nostr', color: '#8b5cf6', icon: '☰' },
  { id: 'copy', label: '📋 Copy Link', color: 'var(--color-muted)', icon: '📋' },
];

// ─── Component ───────────────────────────────────────────────────────────

export default function ShareCard({ shareConfig, bondingProgress, onClose, open }: ShareCardProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const badgeUrl = getBadgeUrl(shareConfig.symbol, shareConfig.refCode);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(
    (platformId: SharePlatform) => {
      const { generateShareText } = require('../../lib/marketing');
      const text = generateShareText(shareConfig, platformId);
      const url = shareConfig.refCode
        ? `https://degenfeed.xyz/launch/${shareConfig.symbol}?ref=${shareConfig.refCode}`
        : shareConfig.coinUrl;

      if (platformId === 'copy') {
        const fullText = `${text}\n\n${url}`;
        navigator.clipboard
          .writeText(fullText)
          .then(() => {
            setCopied(true);
            setCopyError(null);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {
            try {
              const ta = document.createElement('textarea');
              ta.value = fullText;
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

      // Native share (mobile)
      if (platformId === 'native') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          navigator.share({ title: `$${shareConfig.symbol}`, text, url }).catch(() => {});
        }
        return;
      }

      // Social platform share URLs
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
    [shareConfig],
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
      aria-label={`Share $${shareConfig.symbol}`}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={cardRef}
        className="relative w-full max-w-md animate-slide-up rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
      >
        {/* Close button */}
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

        {/* Card preview */}
        <div className="mb-6 mt-2 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-purple-500/20">
            <span className="text-3xl">🚀</span>
          </div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Share ${shareConfig.symbol}</h2>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Spread the word and earn referral rewards
          </p>
        </div>

        {/* Live badge preview */}
        <div className="mb-4 flex justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] p-3">
          {/* Use img tag pointing to our badge API */}
          {/* In production, this would be a canvas-rendered preview */}
          <div className="text-center">
            <div className="mb-2 text-xs font-mono text-[var(--color-muted)]">Badge Preview</div>
            {/* Live badge can be embedded as an image */}
            <img
              src={badgeUrl}
              alt={`$${shareConfig.symbol} on DegenFeed`}
              width={280}
              height={80}
              className="mx-auto rounded-lg"
              onError={(e) => {
                // Fallback: show text preview when image isn't available
                const target = e.currentTarget;
                target.style.display = 'none';
                const fallback = target.parentElement?.querySelector('.badge-fallback');
                if (fallback) (fallback as HTMLElement).style.display = 'block';
              }}
            />
            {/* Fallback text preview */}
            <div className="badge-fallback hidden mx-auto w-[280px] rounded-lg border border-[var(--color-border)] bg-black/80 p-3 text-left font-mono text-xs">
              <div className="text-degen-400 font-bold mb-1">🪙 ${shareConfig.symbol}</div>
              <div className="flex justify-between text-[var(--color-muted)]">
                <span>Holders: {shareConfig.holderCount ?? 0}</span>
                <span>
                  Vol: ${shareConfig.volumeUsd ? formatCompact(shareConfig.volumeUsd) : '0'}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-[#333]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-degen-500 to-emerald-500"
                  style={{ width: `${bondingProgress}%` }}
                />
              </div>
              <div className="mt-1 text-[var(--color-muted)] text-[9px] text-center">
                {getPoweredByText()}
              </div>
            </div>
          </div>
        </div>

        {/* Viral prompts */}
        {shareConfig.refCode && (
          <div className="mb-4 rounded-lg border border-degen-500/20 bg-degen-500/5 p-3">
            <p className="text-[10px] font-medium text-degen-400 mb-1">🎯 Referral Bonus Active</p>
            <p className="text-[10px] text-[var(--color-muted)]">
              Share your link and earn 1% bonus on every buy referred by you. Top 10 referrers get
              featured on the homepage!
            </p>
          </div>
        )}

        {/* Platform buttons */}
        <div className="space-y-2.5">
          {PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              type="button"
              onClick={() => handleShare(platform.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-overlay)] px-4 py-3 text-sm font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:bg-degen-500/5 hover:text-degen-400"
              style={{ minHeight: 44 }}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base"
                style={{ backgroundColor: `${platform.color}18` }}
              >
                {platform.icon}
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
          <div className="mt-3 rounded-lg bg-degen-500/15 px-4 py-2.5 text-center text-xs font-medium text-degen-400 animate-fade-in">
            ✅ Copied to clipboard!
          </div>
        )}

        {copyError && (
          <div className="mt-3 rounded-lg bg-red-500/10 px-4 py-2 text-center text-xs text-red-400">
            {copyError}
          </div>
        )}

        {/* Powered by footer */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-center">
          <p className="text-[10px] text-[var(--color-muted)]">
            {getPoweredByText()} • Cross-platform creator monetization
          </p>
        </div>
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
