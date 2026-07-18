'use client';

import type { UnifiedPost } from '@degenfeed/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface ShareTarget {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** URL template — {url} and {text} are replaced */
  urlTemplate: string;
}

const SHARE_TARGETS: ShareTarget[] = [
  {
    id: 'twitter',
    label: 'X / Twitter',
    icon: '𝕏',
    color: '#ffffff',
    urlTemplate: 'https://twitter.com/intent/tweet?text={text}&url={url}',
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    urlTemplate: 'https://warpcast.com/~/compose?text={text}&embeds[]={url}',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '🦋',
    color: '#1185fe',
    urlTemplate: 'https://bsky.app/intent/compose?text={text}%20{url}',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    icon: '✈',
    color: '#26a5e4',
    urlTemplate: 'https://t.me/share/url?url={url}&text={text}',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: '💬',
    color: '#25d366',
    urlTemplate: 'https://wa.me/?text={text}%20{url}',
  },
  {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8b5cf6',
    urlTemplate: '',
  },
  {
    id: 'copy',
    label: 'Copy Link',
    icon: '🔗',
    color: 'var(--color-muted)',
    urlTemplate: '',
  },
];

function buildShareUrl(target: ShareTarget, post: UnifiedPost): string {
  const postUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/post/${encodeURIComponent(post.dfUri || post.id)}`;
  const text = post.text.slice(0, 200);

  if (target.id === 'copy') return postUrl;
  if (target.id === 'nostr') return postUrl; // Nostr sharing may use the DegenFeed bridge

  return target.urlTemplate
    .replace('{url}', encodeURIComponent(postUrl))
    .replace('{text}', encodeURIComponent(text));
}

interface ShareSheetProps {
  post: UnifiedPost;
  open: boolean;
  onClose: () => void;
  onToast?: (message: string) => void;
}

/**
 * Modern share sheet overlay for sharing posts to multiple platforms.
 * Supports X/Twitter, Farcaster, Bluesky, Telegram, WhatsApp, Nostr, and Copy Link.
 * Falls back to the native Web Share API on mobile when available.
 */
export function ShareSheet({ post, open, onClose, onToast }: ShareSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 200);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleClose]);

  // Close on backdrop click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    // Delay to prevent immediate close on open
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, handleClose]);

  // Try native share API first on mobile
  const handleNativeShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}/post/${encodeURIComponent(post.dfUri || post.id)}`;
    try {
      if (navigator.share && window.matchMedia('(max-width: 768px)').matches) {
        await navigator.share({
          title: `Post by ${post.author.displayName}`,
          text: post.text.slice(0, 200),
          url: shareUrl,
        });
        handleClose();
        return true;
      }
    } catch {
      // User cancelled
    }
    return false;
  }, [post, handleClose]);

  const handleShare = useCallback(
    async (target: ShareTarget) => {
      if (target.id === 'copy') {
        const postUrl = buildShareUrl(target, post);
        try {
          await navigator.clipboard.writeText(postUrl);
          setCopiedId('copy');
          onToast?.('Link copied to clipboard');
          setTimeout(() => setCopiedId(null), 2000);
        } catch {
          // Fallback
          const textArea = document.createElement('textarea');
          textArea.value = postUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          onToast?.('Link copied to clipboard');
        }
        handleClose();
        return;
      }

      if (target.id === 'nostr') {
        // Nostr share — copy the URI and show a message
        const postUrl = buildShareUrl(target, post);
        try {
          await navigator.clipboard.writeText(postUrl);
          onToast?.('Post URI copied — share on any Nostr client');
        } catch {
          onToast?.('Copy the post URL to share on Nostr');
        }
        handleClose();
        return;
      }

      const url = buildShareUrl(target, post);
      window.open(url, '_blank', 'noopener,noreferrer');
      handleClose();
    },
    [post, handleClose, onToast],
  );

  if (!open) return null;

  // On mobile, try native share
  const [showSheet, setShowSheet] = useState(false);
  useEffect(() => {
    if (!open) return;
    // Only try native share on first open
    const checkNative = async () => {
      const shared = await handleNativeShare();
      if (!shared) setShowSheet(true);
    };
    checkNative();
  }, [open, handleNativeShare]);

  if (!showSheet) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={handleClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Share post"
    >
      <div
        ref={sheetRef}
        className={`w-full max-w-sm rounded-t-2xl bg-[var(--color-card)] p-5 shadow-2xl sm:rounded-2xl ${
          closing ? 'animate-slide-down' : 'animate-slide-up'
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-muted)]/30 sm:hidden"
          aria-hidden="true"
        />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--color-fg)]">Share to…</h2>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Share targets grid */}
        <div className="grid grid-cols-4 gap-3">
          {SHARE_TARGETS.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => void handleShare(target)}
              className="group flex flex-col items-center gap-1.5 rounded-xl p-3 transition-all hover:scale-105 active:scale-95"
              style={copiedId === target.id ? { backgroundColor: `${target.color}18` } : undefined}
              aria-label={`Share to ${target.label}`}
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-base transition-transform group-hover:scale-110"
                style={{
                  backgroundColor: `${target.color}15`,
                  color: target.id === 'copy' ? 'var(--color-accent)' : target.color,
                }}
              >
                {copiedId === target.id ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  target.icon
                )}
              </span>
              <span className="text-[10px] font-medium text-[var(--color-muted)] truncate max-w-full">
                {target.label}
              </span>
            </button>
          ))}
        </div>

        {/* Post preview */}
        <div className="mt-4 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-overlay)] p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="h-5 w-5 rounded-full bg-cover bg-center"
              style={
                post.author.avatarUrl
                  ? { backgroundImage: `url(${post.author.avatarUrl})` }
                  : { backgroundColor: 'var(--color-muted)' }
              }
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-[var(--color-fg)] truncate">
              {post.author.displayName}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)] line-clamp-2">
            {post.text.slice(0, 150)}
          </p>
        </div>
      </div>
    </div>
  );
}
