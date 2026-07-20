'use client';

/**
 * @components/join/JoinActions — Tip, share, and signup action bar.
 *
 * Renders a persistent bottom bar (on mobile) or inline toolbar (on desktop)
 * with the primary actions: tip the creator, share to social platforms,
 * and sign up for a full account.
 */

import { useCallback, useState } from 'react';
import { TipModal } from '../../components/TipModal';
import { PLATFORM_CONFIG, type SourcePlatform } from './types';

/* ─── Props ────────────────────────────────────────────────────── */

interface JoinActionsProps {
  /** The creator's display name (for tip modal). */
  creatorName: string;
  /** The creator's protocol identifier. */
  creatorProtocol: string;
  /** The creator's author ID. */
  creatorAuthorId: string;
  /** The detected source platform. */
  sourcePlatform: SourcePlatform;
  /** The current entity ID (stream or space). */
  entityId: string;
  /** The entity type label ("stream" or "space"). */
  entityType: 'stream' | 'space';
  /** Optional tipping context. */
  tipEnabled?: boolean;
}

/* ─── Component ────────────────────────────────────────────────── */

export function JoinActions({
  creatorName,
  creatorProtocol,
  creatorAuthorId,
  sourcePlatform,
  entityId: _entityId,
  entityType,
  tipEnabled = true,
}: JoinActionsProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const platformCfg = PLATFORM_CONFIG[sourcePlatform];
  const isDegenFeed = sourcePlatform === 'degenfeed';

  const handleTip = useCallback(() => {
    setTipOpen(true);
  }, []);

  const handleShare = useCallback(async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join this ${entityType} on DegenFeed`,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      } catch {
        // Clipboard write failed
      }
    }
  }, [entityType]);

  const handleSignUp = useCallback(() => {
    const params = new URLSearchParams();
    if (sourcePlatform !== 'direct' && sourcePlatform !== 'degenfeed') {
      params.set('ref', sourcePlatform);
    }
    params.set('redirect', typeof window !== 'undefined' ? window.location.pathname : '/');
    window.location.href = `/register?${params.toString()}`;
  }, [sourcePlatform]);

  return (
    <>
      {/* Desktop: inline toolbar */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        {/* Tip button */}
        {tipEnabled && (
          <button
            type="button"
            onClick={handleTip}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20 active:scale-[0.97]"
            aria-label={`Tip ${creatorName}`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
            Tip
          </button>
        )}

        {/* Share button */}
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-muted)] transition-all hover:border-[var(--color-border)] hover:text-[var(--color-fg)] active:scale-[0.97]"
          aria-label="Share this stream"
        >
          {shareCopied ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share
            </>
          )}
        </button>

        {/* Sign up CTA (not shown for signed-in users) */}
        {!isDegenFeed && (
          <button
            type="button"
            onClick={handleSignUp}
            className="inline-flex items-center gap-1.5 rounded-xl bg-degen-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-degen-400 active:scale-[0.97]"
          >
            {platformCfg ? `Join with ${platformCfg.label}` : 'Create Account'}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )}
      </div>

      {/* Mobile: sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-xl sm:hidden safe-area-bottom">
        <div className="flex items-center gap-1 px-3 py-2">
          {/* Tip */}
          {tipEnabled && (
            <button
              type="button"
              onClick={handleTip}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2.5 text-xs font-semibold text-amber-400 transition-colors active:bg-amber-500/20"
              aria-label={`Tip ${creatorName}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              Tip
            </button>
          )}

          {/* Share */}
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] py-2.5 text-xs font-medium text-[var(--color-muted)] transition-colors active:bg-[var(--color-card)]/80"
            aria-label="Share"
          >
            {shareCopied ? (
              'Copied!'
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </>
            )}
          </button>

          {/* Sign up */}
          {!isDegenFeed && (
            <button
              type="button"
              onClick={handleSignUp}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-degen-500 py-2.5 text-xs font-bold text-black transition-colors active:bg-degen-400"
            >
              {platformCfg ? platformCfg.label : 'Join'}
            </button>
          )}
        </div>
      </div>

      {/* Tip Modal */}
      {tipOpen && (
        <TipModal
          open={tipOpen}
          onClose={() => setTipOpen(false)}
          recipientProtocol={creatorProtocol}
          recipientAuthorId={creatorAuthorId}
          recipientDisplayName={creatorName}
        />
      )}
    </>
  );
}
