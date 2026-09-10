'use client';

import { useCallback, useState } from 'react';
import { getBadgeEmbedHtml, getBadgeUrl, getPoweredByText } from '../../lib/marketing';

// ─── Types ───────────────────────────────────────────────────────────────

interface SocialBadgeProps {
  symbol: string;
  holderCount: number;
  volumeUsd: number;
  bondingProgress: number;
  refCode?: string;
  /** Show embed code controls */
  showEmbed?: boolean;
  /** Compact variant for sidebar/profile */
  compact?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

/**
 * Live-updating SVG badge that creators can embed on any website,
 * blog, Twitter bio, or link-in-bio page.
 *
 * The badge shows:
 * - Coin symbol
 * - Holder count
 * - Total volume
 * - Bonding curve progress
 * - "Powered by DegenFeed" footer
 * - Link back to the coin page on DegenFeed
 */
export function SocialBadge({
  symbol,
  holderCount,
  volumeUsd,
  bondingProgress,
  refCode,
  showEmbed = false,
  compact = false,
}: SocialBadgeProps) {
  const [copied, setCopied] = useState(false);
  const badgeUrl = getBadgeUrl(symbol, refCode);
  const embedHtml = getBadgeEmbedHtml(symbol, refCode);

  const handleCopyEmbed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = embedHtml;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silently fail
      }
    }
  }, [embedHtml]);

  // Compact variant for sidebars
  if (compact) {
    return (
      <a
        href={`https://degenfeed.xyz/launch/${encodeURIComponent(symbol)}${refCode ? `?ref=${refCode}` : ''}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-overlay)] px-3 py-2 text-xs transition-colors hover:border-degen-500/30">
          <span className="text-degen-400 font-bold">🪙 ${symbol}</span>
          <span className="text-[var(--color-muted)]">·</span>
          <span className="text-[var(--color-muted)]">{holderCount} holders</span>
          <span className="text-[var(--color-muted)]">·</span>
          <span className="text-[var(--color-muted)]">${formatCompact(volumeUsd)}</span>
          <span className="ml-auto text-[9px] text-degen-400/60">{getPoweredByText(true)}</span>
        </div>
      </a>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden">
      {/* Badge preview */}
      <div className="p-4">
        <div className="mx-auto w-fit">
          <img
            src={badgeUrl}
            alt={`$${symbol} on DegenFeed`}
            width={280}
            height={80}
            className="rounded-lg"
            onError={(e) => {
              // Fallback: render inline
              const target = e.currentTarget;
              target.style.display = 'none';
              const fallback = target.parentElement?.querySelector('.badge-fallback');
              if (fallback) (fallback as HTMLElement).style.display = 'block';
            }}
          />
          {/* SVG fallback */}
          <div className="badge-fallback hidden">
            <svg
              width="280"
              height="80"
              viewBox="0 0 280 80"
              xmlns="http://www.w3.org/2000/svg"
              className="rounded-lg"
            >
              <defs>
                <linearGradient id="badgeBg" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0a0a0a" />
                  <stop offset="100%" stopColor="#1a1a2e" />
                </linearGradient>
                <linearGradient id="badgeBar" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00ff41" />
                  <stop offset="100%" stopColor="#00cc88" />
                </linearGradient>
              </defs>
              <rect
                width="280"
                height="80"
                rx="8"
                fill="url(#badgeBg)"
                stroke="#00ff41"
                strokeWidth="1.5"
              />
              <text
                x="140"
                y="18"
                textAnchor="middle"
                fill="#00ff41"
                fontFamily="monospace"
                fontSize="11"
                fontWeight="bold"
              >
                🪙 ${symbol}
              </text>
              <text x="16" y="38" fill="#888" fontFamily="monospace" fontSize="9">
                Holders
              </text>
              <text
                x="16"
                y="54"
                fill="#fff"
                fontFamily="monospace"
                fontSize="14"
                fontWeight="bold"
              >
                {holderCount}
              </text>
              <text x="108" y="38" fill="#888" fontFamily="monospace" fontSize="9">
                Volume
              </text>
              <text
                x="108"
                y="54"
                fill="#fff"
                fontFamily="monospace"
                fontSize="14"
                fontWeight="bold"
              >
                ${formatCompact(volumeUsd)}
              </text>
              <text x="200" y="38" fill="#888" fontFamily="monospace" fontSize="9">
                Bonding
              </text>
              <text
                x="200"
                y="54"
                fill="#fff"
                fontFamily="monospace"
                fontSize="14"
                fontWeight="bold"
              >
                {bondingProgress.toFixed(0)}%
              </text>
              <rect x="16" y="64" width="248" height="6" rx="3" fill="#333" />
              <rect
                x="16"
                y="64"
                width={248 * (bondingProgress / 100)}
                height="6"
                rx="3"
                fill="url(#badgeBar)"
              />
              <text
                x="140"
                y="76"
                textAnchor="middle"
                fill="#00ff41"
                fontFamily="monospace"
                fontSize="7"
              >
                {getPoweredByText()}
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 border-t border-[var(--color-border)] px-4 py-2.5 text-center">
        <div>
          <div className="text-xs font-bold text-[var(--color-fg)]">{holderCount}</div>
          <div className="text-[9px] text-[var(--color-muted)]">Holders</div>
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--color-fg)]">
            ${formatCompact(volumeUsd)}
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Volume</div>
        </div>
        <div>
          <div className="text-xs font-bold text-[var(--color-fg)]">
            {bondingProgress.toFixed(0)}%
          </div>
          <div className="text-[9px] text-[var(--color-muted)]">Bonded</div>
        </div>
      </div>

      {/* Embed controls */}
      {showEmbed && (
        <div className="border-t border-[var(--color-border)] p-3">
          <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-[var(--color-muted)]">
            Embed Code
          </label>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-lg bg-[var(--color-overlay)] px-2 py-1.5 text-[9px] font-mono text-[var(--color-muted)]">
              {embedHtml.slice(0, 80)}...
            </code>
            <button
              type="button"
              onClick={handleCopyEmbed}
              className="shrink-0 rounded-lg bg-[var(--color-overlay)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-1.5 text-[9px] text-[var(--color-muted)]">
            Paste this HTML on any website, blog, or link-in-bio page. The badge updates live.
          </p>
        </div>
      )}

      {/* Powered by footer */}
      <div className="border-t border-[var(--color-border)] px-4 py-2 text-center">
        <a
          href={`https://degenfeed.xyz/launch/${encodeURIComponent(symbol)}${refCode ? `?ref=${refCode}` : ''}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-degen-500 hover:text-degen-400 transition-colors"
        >
          {getPoweredByText()}
        </a>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}
