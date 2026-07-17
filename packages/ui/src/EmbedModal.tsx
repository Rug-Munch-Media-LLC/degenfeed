'use client';

import { memo, useCallback, useMemo, useState } from 'react';

export interface EmbedModalProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  postUri?: string;
  authorName: string;
  protocol: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

export const EmbedModal = memo(function EmbedModal({
  open,
  onClose,
  postId,
  postUri,
  authorName,
  protocol,
  text,
}: EmbedModalProps) {
  const [showBadge, setShowBadge] = useState(true);
  const [showEngagement, setShowEngagement] = useState(true);
  const [copied, setCopied] = useState(false);

  const dfUri = postUri || `df://${protocol}:${postId.replace(`${protocol}:`, '')}`;
  const postUrl = `${window.location.origin}/post/${encodeURIComponent(postId)}`;
  const embedUrl = `${window.location.origin}/embed/${encodeURIComponent(dfUri)}`;

  const embedSnippet = useMemo(() => {
    const textPreview = truncate(text, 280);
    const badgeHtml = showBadge
      ? `\n    <span class="degenfeed-protocol">${escapeHtml(protocol.charAt(0).toUpperCase() + protocol.slice(1))}</span>`
      : '';
    const engagementHtml = showEngagement ? '' : '';

    return `<blockquote class="degenfeed-post" data-post-uri="${escapeHtml(dfUri)}">
  <p>${escapeHtml(textPreview)}</p>
  <footer>
    — <cite><a href="${escapeHtml(postUrl)}">@${escapeHtml(authorName)} on DegenFeed</a></cite>${badgeHtml}${engagementHtml}
  </footer>
</blockquote>
<script async src="${window.location.origin}/embed.js"></script>`;
  }, [dfUri, postUrl, authorName, text, showBadge, showEngagement, protocol]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = embedSnippet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [embedSnippet]);

  if (!open) return null;

  return (
    <section
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      aria-modal="true"
      aria-label="Embed post"
      role="dialog"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: dialog panel needs stopPropagation to prevent backdrop close on inner clicks */}
      <div
        role="none"
        className="flex w-full max-w-lg flex-col rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--color-fg)]">Embed Post</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              role="img"
              aria-label="Close icon"
            >
              <title>Close</title>
              <path
                d="M12 4L4 12M4 4l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showBadge}
                onChange={(e) => setShowBadge(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
              />
              <span className="text-xs text-gray-400">Show protocol badge</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showEngagement}
                onChange={(e) => setShowEngagement(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[var(--color-muted)] text-degen-500 focus:ring-degen-500"
              />
              <span className="text-xs text-gray-400">Show engagement stats</span>
            </label>
          </div>

          {/* Embed code */}
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Embed HTML
            </span>
            <div className="relative">
              <pre className="max-h-40 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap break-all">
                {embedSnippet}
              </pre>
              <button
                type="button"
                onClick={handleCopy}
                className="absolute right-2 top-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-[var(--color-fg)] transition-colors"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-500">
              Preview
            </span>
            <div className="rounded-lg border border-[var(--color-border)] p-4">
              <blockquote className="degenfeed-post" style={{ all: 'revert', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxWidth: '100%', margin: 0, padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-card)' }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', lineHeight: 1.5, color: 'var(--color-fg)', wordBreak: 'break-word' }}>
                  {truncate(text, 280)}
                </p>
                <footer style={{ fontSize: '12px', color: 'var(--color-muted-foreground)', borderTop: '1px solid var(--color-border)', paddingTop: '8px' }}>
                  —{' '}
                  <cite style={{ fontStyle: 'normal' }}>
                    <a
                      href={postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--degen-500)', textDecoration: 'none' }}
                    >
                      @{authorName} on DegenFeed
                    </a>
                  </cite>
                  {showBadge && (
                    <span
                      style={{
                        display: 'inline-block',
                        marginLeft: '8px',
                        padding: '1px 8px',
                        borderRadius: '999px',
                        fontSize: '10px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {protocol}
                    </span>
                  )}
                </footer>
              </blockquote>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-xs font-medium text-gray-400 hover:text-[var(--color-fg)] transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-degen-500 px-4 py-2 text-xs font-semibold text-black hover:bg-degen-400 transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy Embed Code'}
          </button>
        </div>
      </div>
    </section>
  );
});
