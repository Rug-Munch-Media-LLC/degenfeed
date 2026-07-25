'use client';

/**
 * @degenfeed/ui — UnifiedProfileHeader
 *
 * Shows a user's identity across all protocols they've linked.
 * "This person is @alice on Nostr, alice.eth on Farcaster, @alice.lens on Lens"
 * Cross-protocol follower counts, one-click follow-all, df:// URI sharing.
 */

import { memo, useCallback, useState } from 'react';
import type { ProtocolStatusItem } from './ProtocolStatusSection';
import { ProtocolStatusSection } from './ProtocolStatusSection';

export interface ProfileHandle {
  protocol: string;
  handle: string;
  icon: string;
  color: string;
  verified: boolean;
  followerCount?: number;
}

export interface UnifiedProfileHeaderProps {
  walletAddress: string;
  displayName: string;
  handles: ProfileHandle[];
  totalFollowerCount: number;
  networkCount: number;
  primaryProtocol: string;
  dfUri: string;
  /** Per-protocol status items for the ProtocolStatusSection */
  protocolStatuses?: ProtocolStatusItem[];
  /** Called when user wants to disconnect a protocol */
  onDisconnectProtocol?: (protocol: string) => void;
  /** Called when user wants to reconnect/reauthorize */
  onReconnectProtocol?: (protocol: string) => void;
  onFollowAll?: (handles: ProfileHandle[]) => void;
  onShareProfile?: (dfUri: string) => void;
  onCopyDfUri?: (dfUri: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const UnifiedProfileHeader = memo(function UnifiedProfileHeader({
  displayName,
  handles,
  totalFollowerCount,
  networkCount,
  dfUri,
  protocolStatuses,
  onDisconnectProtocol,
  onReconnectProtocol,
  onFollowAll,
  onShareProfile,
  onCopyDfUri,
}: UnifiedProfileHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(dfUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopyDfUri?.(dfUri);
  }, [dfUri, onCopyDfUri]);

  const handleFollowAll = useCallback(() => {
    onFollowAll?.(handles);
  }, [handles, onFollowAll]);

  const handleShare = useCallback(() => {
    onShareProfile?.(dfUri);
  }, [dfUri, onShareProfile]);

  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-fg)]">{displayName}</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            <span className="tabular-nums font-medium text-[var(--color-fg)]">
              {formatCount(totalFollowerCount)}
            </span>
            {networkCount > 1 ? ` followers across ${networkCount} networks` : ' followers'}
          </p>
        </div>
        {/* df:// URI badge */}
        <button
          type="button"
          onClick={handleCopy}
          className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-1.5 text-[11px] font-mono text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-degen-500/30 transition-colors"
          aria-label={`Copy profile URI: ${dfUri}`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="text-degen-400"
          >
            <rect
              x="8"
              y="2"
              width="14"
              height="18"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M16 2H6a2 2 0 0 0-2 2v14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {copied ? 'Copied!' : dfUri}
        </button>
      </div>

      {/* ── Cross-protocol identity badges ── */}
      <div className="mb-4">
        <p className="text-xs text-[var(--color-muted)] uppercase tracking-wider mb-2">
          Identities across protocols
        </p>
        <div className="flex flex-wrap gap-2">
          {handles.map((h) => (
            <div
              key={h.protocol}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-3 py-2 transition-colors hover:border-degen-500/20"
            >
              <span className="text-sm" aria-hidden="true">
                {h.icon}
              </span>
              <span className="text-xs font-medium" style={{ color: h.color }}>
                {h.protocol}
              </span>
              <span className="text-xs text-[var(--color-fg)]">{h.handle}</span>
              {h.verified && (
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-degen-400"
                  aria-label="Verified"
                >
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                </svg>
              )}
              {h.followerCount != null && (
                <span className="text-[10px] text-[var(--color-muted)] tabular-nums">
                  {formatCount(h.followerCount)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol Status ── */}
      {protocolStatuses && protocolStatuses.length > 0 && (
        <div className="mb-4">
          <ProtocolStatusSection
            protocols={protocolStatuses}
            onDisconnect={onDisconnectProtocol}
            onReconnect={onReconnectProtocol}
          />
        </div>
      )}

      {/* ── Actions ── */}
      {handles.length > 0 && (
        <div className="flex items-center gap-2 border-t border-[var(--color-glass-border)] pt-4">
          <button
            type="button"
            onClick={handleFollowAll}
            disabled={!onFollowAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium transition-colors border border-degen-500/30"
          >
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Follow on all networks
          </button>
          <button
            type="button"
            onClick={handleShare}
            disabled={!onShareProfile}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-glass-border)] hover:border-degen-500/30 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
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
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share profile
          </button>
        </div>
      )}
    </div>
  );
});
