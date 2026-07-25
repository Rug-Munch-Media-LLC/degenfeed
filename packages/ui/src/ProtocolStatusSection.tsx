'use client';

/**
 * @degenfeed/ui — ProtocolStatusSection
 *
 * Shows status for each protocol the user has connected.
 * Displays connection state, health, and quick actions.
 *
 * Used in unified profile view to give a per-protocol health overview.
 */

import { memo } from 'react';
import { getProtocolColor, getProtocolIcon, getProtocolLabel } from './ProtocolBadge';

export type ProtocolStatus = 'connected' | 'disconnected' | 'degraded' | 'error';

export interface ProtocolStatusItem {
  protocol: string;
  handle: string;
  status: ProtocolStatus;
  followerCount?: number;
  errorMessage?: string;
  lastActive?: number;
}

export interface ProtocolStatusSectionProps {
  /** List of protocol statuses to display */
  protocols: ProtocolStatusItem[];
  /** Called when user wants to disconnect a protocol */
  onDisconnect?: (protocol: string) => void;
  /** Called when user wants to reconnect/reauthorize */
  onReconnect?: (protocol: string) => void;
  /** CSS class for the container */
  className?: string;
}

const STATUS_INDICATOR: Record<ProtocolStatus, { label: string; dotClass: string }> = {
  connected: {
    label: 'Connected',
    dotClass: 'bg-emerald-400',
  },
  disconnected: {
    label: 'Disconnected',
    dotClass: 'bg-zinc-500',
  },
  degraded: {
    label: 'Degraded',
    dotClass: 'bg-amber-400',
  },
  error: {
    label: 'Error',
    dotClass: 'bg-red-400',
  },
};

function formatLastActive(ts: number): string {
  const delta = Date.now() - ts;
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

export const ProtocolStatusSection = memo(function ProtocolStatusSection({
  protocols,
  onDisconnect,
  onReconnect,
  className = '',
}: ProtocolStatusSectionProps) {
  if (protocols.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 ${className}`}
    >
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)] uppercase tracking-wider">
        Protocol Status
      </h3>
      <div className="space-y-3">
        {protocols.map((item) => {
          const color = getProtocolColor(item.protocol);
          const icon = getProtocolIcon(item.protocol);
          const label = getProtocolLabel(item.protocol);
          const indicator = STATUS_INDICATOR[item.status];

          return (
            <div
              key={item.protocol}
              className="flex items-center justify-between rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-overlay)] px-4 py-3 transition-colors hover:border-degen-500/20"
            >
              {/* Protocol identity */}
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0" aria-hidden="true">
                  {icon}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color }}>
                      {label}
                    </span>
                    <span
                      className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${indicator.dotClass}`}
                      title={indicator.label}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                    <span className="truncate max-w-[160px]">{item.handle}</span>
                    {item.followerCount != null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.followerCount} followers</span>
                      </>
                    )}
                    {item.lastActive != null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatLastActive(item.lastActive)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & actions */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {item.status === 'connected' && (
                  <span className="text-[11px] text-emerald-400 font-medium">Active</span>
                )}
                {item.status === 'degraded' && (
                  <span className="text-[11px] text-amber-400 font-medium">Slow</span>
                )}
                {(item.status === 'disconnected' || item.status === 'error') && onReconnect && (
                  <button
                    type="button"
                    onClick={() => onReconnect(item.protocol)}
                    className="rounded-md bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 px-3 py-1 text-[11px] font-medium transition-colors border border-degen-500/30"
                  >
                    Reconnect
                  </button>
                )}
                {onDisconnect && (
                  <button
                    type="button"
                    onClick={() => onDisconnect(item.protocol)}
                    className="rounded-md border border-[var(--color-glass-border)] hover:border-red-400/30 px-2 py-1 text-[11px] text-[var(--color-muted)] hover:text-red-400 transition-colors"
                    aria-label={`Disconnect ${label}`}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
