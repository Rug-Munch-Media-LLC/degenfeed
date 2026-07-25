'use client';

/**
 * @degenfeed/ui — ShareSheet
 *
 * Native share sheet integration with fallback copy.
 * Uses the Web Share API when available, falls back to clipboard.
 * Web3-native: also supports sharing as cross-protocol post.
 */

import { memo, useCallback, useState } from 'react';

export interface ShareSheetProps {
  /** URL to share */
  url: string;
  /** Share title */
  title?: string;
  /** Share text / description */
  text?: string;
  /** Optional post ID for cross-protocol share */
  postId?: string;
  /** Called when share is complete */
  onClose?: () => void;
  /** Optional: cross-post the shared content */
  onCrossPost?: (content: string) => void;
}

export const ShareSheet = memo(function ShareSheet({
  url,
  title,
  text,
  onClose,
  onCrossPost,
}: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: title ?? 'DegenFeed',
          text: text ?? '',
          url,
        });
        onClose?.();
      } catch (err) {
        // User cancelled or share failed
        if (err instanceof Error && err.name !== 'AbortError') {
          setError('Share cancelled');
        }
      }
    } else {
      // Fallback: copy to clipboard
      await handleCopy();
    }
  }, [url, title, text, onClose, handleCopy]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setError(null);
      setTimeout(() => {
        setCopied(false);
        onClose?.();
      }, 1500);
    } catch {
      setError('Failed to copy');
    }
  }, [url, onClose]);

  const handleCrossPost = useCallback(() => {
    const content = `${text ?? ''} ${url}`.trim();
    onCrossPost?.(content);
    onClose?.();
  }, [text, url, onCrossPost, onClose]);

  return (
    <div className="share-sheet-overlay" onClick={onClose} role="dialog" aria-label="Share">
      <div className="share-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="share-sheet-header">
          <h3 className="share-sheet-title">Share</h3>
          <button type="button" onClick={onClose} className="share-sheet-close" aria-label="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="share-sheet-preview">
          <p className="share-sheet-preview-text">{text?.slice(0, 120) ?? url}</p>
        </div>

        <div className="share-sheet-actions">
          <button
            type="button"
            className="share-sheet-btn share-sheet-btn-primary"
            onClick={handleNativeShare}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
            {navigator.share ? 'Share' : 'Copy Link'}
          </button>

          <button type="button" className="share-sheet-btn" onClick={handleCopy}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          {onCrossPost && (
            <button type="button" className="share-sheet-btn" onClick={handleCrossPost}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Cross-Post
            </button>
          )}
        </div>

        {error && <p className="share-sheet-error">{error}</p>}
      </div>
    </div>
  );
});
