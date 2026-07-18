'use client';

/**
 * @degenfeed/ui — CrossProtocolThreadIndicator
 *
 * Shows a compact indicator of cross-protocol reply activity on a thread.
 * "This thread has replies on Nostr (3), Farcaster (1), Mastodon (2)"
 *
 * Color-coded protocol bars and counts. Fetches from /v1/cross-reply/status.
 */

import { memo, useCallback, useEffect, useState } from 'react';
import { getProtocolLabel, PROTOCOL_COLORS } from './ProtocolBadge';

export interface CrossProtocolReplyCount {
  total: number;
  byProtocol: Record<string, number>;
}

export interface CrossProtocolThreadIndicatorProps {
  parentPostUri: string;
  className?: string;
  onExpand?: () => void;
}

export const CrossProtocolThreadIndicator = memo(function CrossProtocolThreadIndicator({
  parentPostUri,
  className = '',
  onExpand,
}: CrossProtocolThreadIndicatorProps) {
  const [counts, setCounts] = useState<CrossProtocolReplyCount | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch(
        `/v1/cross-reply/status?parentPostUri=${encodeURIComponent(parentPostUri)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as CrossProtocolReplyCount & {
        total: number;
        byProtocol: Record<string, number>;
      };
      if (data && typeof data.total === 'number') {
        setCounts(data);
      }
    } catch {
      // Silently fail — indicator is best-effort
    } finally {
      setLoading(false);
    }
  }, [parentPostUri]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  if (loading || !counts || counts.total === 0) return null;

  const entries = Object.entries(counts.byProtocol).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onExpand}
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-1.5 text-xs transition-colors hover:border-degen-500/20 ${className}`}
    >
      <div className="flex items-center">
        {entries.map(([protocol, count], i) => (
          <div
            key={protocol}
            className="h-1.5 rounded-full"
            style={{
              width: `${Math.max(8, count * 8)}px`,
              backgroundColor: PROTOCOL_COLORS[protocol] ?? '#666',
              marginLeft: i > 0 ? '2px' : '0',
            }}
            title={`${getProtocolLabel(protocol)}: ${count} repl${count === 1 ? 'y' : 'ies'}`}
          />
        ))}
      </div>
      <span className="text-[var(--color-muted)] tabular-nums">
        {counts.total} cross-protocol repl{counts.total === 1 ? 'y' : 'ies'}
      </span>
    </button>
  );
});
