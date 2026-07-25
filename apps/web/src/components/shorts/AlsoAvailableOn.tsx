'use client';

/**
 * AlsoAvailableOn — Cross-platform availability indicator.
 *
 * Shows which other platforms/protocols a short video is available on.
 * Renders color-coded protocol pills with direct links.
 * Example: "Also available on: Loops, PeerTube, AT Protocol"
 */

import { sourceBadgeData } from './ShortsSourceBadge';

// ─── Types ───────────────────────────────────────────────────────────────

export interface ProtocolLink {
  protocol: string;
  label: string;
  url: string;
}

interface AlsoAvailableOnProps {
  /** Primary source (the one this short was discovered from) */
  primarySource: string;
  /** All platforms this short is available on (includes primary) */
  protocols: ProtocolLink[];
  /** Max protocols to show before "+N more" */
  maxVisible?: number;
  /** Compact mode for overlay */
  compact?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────

export function AlsoAvailableOn({
  primarySource,
  protocols,
  maxVisible = 4,
  compact = false,
}: AlsoAvailableOnProps) {
  // Filter out the primary source from "also available" list
  const otherProtocols = protocols.filter((p) => p.protocol !== primarySource);

  if (otherProtocols.length === 0) return null;

  const visible = otherProtocols.slice(0, maxVisible);
  const extraCount = otherProtocols.length - maxVisible;

  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'flex-wrap' : ''}`}>
      {/* Label */}
      <span
        className={`shrink-0 font-medium tracking-wide ${
          compact ? 'text-[8px] text-white/40' : 'text-[9px] text-white/50'
        }`}
      >
        Also on
      </span>

      {/* Protocol pills */}
      <div className="flex flex-wrap items-center gap-1">
        {visible.map((p) => {
          const badge = sourceBadgeData(p.protocol);
          return (
            <a
              key={p.protocol}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-medium transition-all hover:opacity-80 ${
                compact
                  ? 'text-[8px] leading-none'
                  : 'text-[9px] leading-tight'
              }`}
              style={{
                backgroundColor: `${badge.color}15`,
                borderColor: `${badge.color}25`,
                color: badge.color,
              }}
              title={`View on ${badge.label}`}
            >
              {/* Mini dot */}
              <span
                className="inline-block rounded-full"
                style={{
                  width: compact ? 4 : 5,
                  height: compact ? 4 : 5,
                  backgroundColor: badge.color,
                }}
                aria-hidden="true"
              />
              <span>{badge.label}</span>
            </a>
          );
        })}

        {/* "+N more" overflow */}
        {extraCount > 0 && (
          <span
            className={`rounded-full border border-dashed border-white/15 px-1.5 py-0.5 font-medium text-white/40 ${
              compact ? 'text-[8px]' : 'text-[9px]'
            }`}
          >
            +{extraCount} more
          </span>
        )}
      </div>
    </div>
  );
}
