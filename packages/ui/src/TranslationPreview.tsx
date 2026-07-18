'use client';

/**
 * @degenfeed/ui — TranslationPreview
 *
 * Side-by-side or stacked preview of original vs translated content
 * for cross-protocol posts. Shows protocol badges, truncation warnings,
 * and a "Post this" button to use the translated content.
 *
 * Usage:
 *   <TranslationPreview
 *     originalContent="Hello from Farcaster!"
 *     fromProtocol="farcaster"
 *     translated={result}
 *     toProtocol="mastodon"
 *     onPost={(content) => openComposeModal(content, 'mastodon')}
 *   />
 */

import { useState } from 'react';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

interface TranslationData {
  translated: string;
  truncated: boolean;
  originalLength: number;
  translatedLength: number;
  maxLength: number;
  strippedMarkdown: boolean;
  removedProtocolElements: string[];
  warning?: string;
}

export interface TranslationPreviewProps {
  /** The original post content before translation */
  originalContent: string;
  /** Source protocol key (e.g. 'farcaster') */
  fromProtocol: string;
  /** Translation result from translateContent() or API response */
  translated: TranslationData;
  /** Target protocol key (e.g. 'mastodon') */
  toProtocol: string;
  /** Called when user wants to post the translated content */
  onPost?: (translatedContent: string, targetProtocol: string) => void;
  /** Layout: side-by-side (default on desktop) or stacked */
  layout?: 'auto' | 'side-by-side' | 'stacked';
}

export function TranslationPreview({
  originalContent,
  fromProtocol,
  translated,
  toProtocol,
  onPost,
  layout = 'auto',
}: TranslationPreviewProps) {
  const [compact, setCompact] = useState(false);

  const fromColor = getProtocolColor(fromProtocol);
  const toColor = getProtocolColor(toProtocol);
  const fromIcon = getProtocolIcon(fromProtocol);
  const toIcon = getProtocolIcon(toProtocol);
  const fromLabel = getProtocolLabel(fromProtocol);
  const toLabel = getProtocolLabel(toProtocol);

  const lossPercent =
    translated.originalLength > 0
      ? Math.round(
          ((translated.originalLength - translated.translatedLength) / translated.originalLength) *
            100,
        )
      : 0;

  const isSideBySide = layout === 'side-by-side' || (layout === 'auto' && !compact);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
        <h3 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider">
          Translation Preview
        </h3>
        <button
          type="button"
          onClick={() => setCompact((v) => !v)}
          className="rounded px-2 py-0.5 text-[10px] text-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors"
        >
          {isSideBySide ? 'Stacked view' : 'Side-by-side'}
        </button>
      </div>

      <div className={`${isSideBySide ? 'grid grid-cols-1 md:grid-cols-2' : 'flex flex-col'}`}>
        {/* ── Original panel ── */}
        <div className="border-r-0 md:border-r border-[var(--color-border)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${fromColor}22`,
                color: fromColor,
              }}
            >
              <span className="text-[0.7em]">{fromIcon}</span>
              {fromLabel}
            </span>
            <span className="text-[10px] text-gray-600">{translated.originalLength} chars</span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-muted)]">
            {originalContent}
          </p>
        </div>

        {/* ── Translated panel ── */}
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `${toColor}22`,
                color: toColor,
              }}
            >
              <span className="text-[0.7em]">{toIcon}</span>
              {toLabel}
            </span>
            <span className="text-[10px] text-gray-600">
              {translated.translatedLength}/{translated.maxLength}
              {translated.maxLength < Infinity ? ' chars' : ''}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-gray-100">
            {translated.translated}
          </p>

          {/* ── Truncation indicator ── */}
          {translated.truncated && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-900/40 bg-amber-950/20 px-2.5 py-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-amber-400"
              >
                <path d="M8 1L1 15h14L8 1z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                <circle cx="8" cy="11" r="1" fill="currentColor" />
                <rect x="7.5" y="5" width="1" height="4" rx="0.5" fill="currentColor" />
              </svg>
              <span className="text-[11px] text-amber-300">
                Truncated for {toLabel}&apos;s {translated.maxLength} character limit ({lossPercent}
                % shorter)
              </span>
            </div>
          )}

          {/* ── Stripped markdown notice ── */}
          {translated.strippedMarkdown && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-blue-900/40 bg-blue-950/20 px-2.5 py-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="shrink-0 text-blue-400"
              >
                <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                <path
                  d="M8 5v4M8 11v.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[11px] text-blue-300">
                Markdown formatting removed ({toLabel} doesn&apos;t support it)
              </span>
            </div>
          )}

          {/* ── Removed elements notice ── */}
          {translated.removedProtocolElements.length > 0 && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-purple-900/40 bg-purple-950/20 px-2.5 py-1.5">
              <span className="mt-px shrink-0 text-[10px] text-purple-400" aria-hidden="true">
                &#x26A0;
              </span>
              <span className="text-[11px] text-purple-300">
                Removed: {translated.removedProtocolElements.join(', ')}
              </span>
            </div>
          )}

          {/* ── Warning ── */}
          {translated.warning && (
            <div className="mt-2 rounded-lg border border-red-900/40 bg-red-950/20 px-2.5 py-1.5">
              <span className="text-[11px] text-red-300">{translated.warning}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer / action bar ── */}
      {onPost && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-2.5">
          <button
            type="button"
            onClick={() => onPost(translated.translated, toProtocol)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors"
            style={{ backgroundColor: toColor }}
          >
            <span className="text-[0.7em]">{toIcon}</span>
            Post this to {toLabel}
          </button>
        </div>
      )}
    </div>
  );
}
