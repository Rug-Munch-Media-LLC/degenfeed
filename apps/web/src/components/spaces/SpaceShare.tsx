'use client';

import { useCallback, useRef, useState } from 'react';

// === Types ========================================================

interface SpaceShareProps {
  spaceId: string;
  title: string;
  hostName: string;
  platforms?: string[];
  protocols?: string[];
  isLive: boolean;
  scheduledAt?: string;
}

// === Constants ====================================================

const SHARE_PLATFORMS = [
  { id: 'nostr', label: 'Nostr', color: '#8b5cf6', icon: '⚡' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2', icon: '🏎️' },
  { id: 'lens', label: 'Lens', color: '#abfe2c', icon: '🔮' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe', icon: '🦋' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff', icon: '🐘' },
  { id: 'discord', label: 'Discord', color: '#5865f2', icon: '💬' },
  { id: 'telegram', label: 'Telegram', color: '#26a5e4', icon: '✈️' },
  { id: 'twitter', label: 'X / Twitter', color: '#1da1f2', icon: '𝕏' },
];

// === Main Component ===============================================

export function SpaceShare({ spaceId, title, hostName, isLive, scheduledAt }: SpaceShareProps) {
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Merge platforms and protocols into a unique list

  const spaceUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/spaces/${spaceId}` : '';

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(spaceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = spaceUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [spaceUrl]);

  const shareText = isLive
    ? `🔊 LIVE: ${title} — hosted by ${hostName} on DegenFeed Spaces`
    : scheduledAt
      ? `📅 Upcoming Space: ${title} — hosted by ${hostName} on DegenFeed Spaces`
      : `🎙️ ${title} — hosted by ${hostName} on DegenFeed Spaces`;

  const toggleMenu = useCallback(() => {
    setShowShareMenu((prev) => !prev);
  }, []);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: spaceUrl,
        });
      } catch {
        // User cancelled
      }
    }
    setShowShareMenu(false);
  }, [title, shareText, spaceUrl]);

  const handleCrossPost = useCallback(
    (protocol: string) => {
      const postText = encodeURIComponent(`${shareText}\n\n${spaceUrl}`);
      let url = '';

      switch (protocol) {
        case 'nostr':
          url = `https://snort.social/new?message=${postText}`;
          break;
        case 'farcaster':
          url = `https://warpcast.com/~/compose?text=${postText}`;
          break;
        case 'lens':
          url = `https://hey.xyz/?text=${postText}`;
          break;
        case 'bluesky':
          url = `https://bsky.app/intent/compose?text=${postText}`;
          break;
        case 'mastodon':
          url = `https://social.degenfeed.xyz/share?text=${postText}`;
          break;
        case 'discord':
          handleCopyLink();
          return;
        case 'telegram':
          url = `https://t.me/share/url?url=${encodeURIComponent(spaceUrl)}&text=${encodeURIComponent(shareText)}`;
          break;
        case 'twitter':
          url = `https://twitter.com/intent/tweet?text=${postText}`;
          break;
        default:
          handleCopyLink();
          return;
      }

      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      setShowShareMenu(false);
    },
    [shareText, spaceUrl, handleCopyLink],
  );

  return (
    <div className="relative" ref={menuRef}>
      {/* Share button */}
      <button
        type="button"
        onClick={toggleMenu}
        className="flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3.5 py-2 text-xs font-medium text-[var(--color-fg)] transition-all hover:border-degen-500/30 hover:text-degen-400"
        aria-label="Share this space"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        Share
      </button>

      {/* Share menu */}
      {showShareMenu && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setShowShareMenu(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-2 shadow-2xl">
            {/* Copy link */}
            <button
              type="button"
              onClick={() => {
                handleCopyLink();
                setShowShareMenu(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--color-fg)] transition-all hover:bg-[var(--color-muted)]/10"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-muted)]/10">
                {copied ? '✓' : '🔗'}
              </span>
              {copied ? 'Link copied!' : 'Copy link'}
            </button>

            {/* Native share */}
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--color-fg)] transition-all hover:bg-[var(--color-muted)]/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-muted)]/10">
                  📤
                </span>
                Share via...
              </button>
            )}

            <div className="my-1.5 border-t border-[var(--color-glass-border)]" />
            <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Post to
            </p>

            {SHARE_PLATFORMS.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => handleCrossPost(platform.id)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--color-fg)] transition-all hover:bg-[var(--color-muted)]/10"
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px]"
                  style={{
                    backgroundColor: `${platform.color}18`,
                    color: platform.color,
                  }}
                >
                  {platform.icon}
                </span>
                {platform.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
