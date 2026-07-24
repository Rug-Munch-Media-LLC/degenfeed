'use client';

import { PROTOCOL_COLORS, PROTOCOL_LABELS, PROTOCOL_ORDER } from './constants';
import type { ProtocolEngagement } from './types';
import { formatCompact, formatUsd } from './utils';

export function ProtocolBreakdownTable({
  followers,
  engagement,
  tips,
}: {
  followers: Record<string, number>;
  engagement: Record<string, ProtocolEngagement>;
  tips: Record<string, number>;
}) {
  const protocols = PROTOCOL_ORDER.filter(
    (p) => followers[p] !== undefined || engagement[p] !== undefined,
  );
  if (protocols.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            <th className="pb-2 pr-4 text-left">Protocol</th>
            <th className="pb-2 pr-4 text-right">Followers</th>
            <th className="pb-2 pr-4 text-right">Engagement</th>
            <th className="pb-2 pr-4 text-right">Likes</th>
            <th className="pb-2 pr-4 text-right">Reposts</th>
            <th className="pb-2 text-right">Tips (USD)</th>
          </tr>
        </thead>
        <tbody>
          {protocols.map((p) => {
            const color = PROTOCOL_COLORS[p] || '#666';
            const eng = engagement[p];
            const totalEng = eng ? eng.likes + eng.reposts + eng.replies : 0;
            return (
              <tr
                key={p}
                className="border-b border-[var(--color-border)]/50 transition-colors hover:bg-[var(--color-overlay)]"
              >
                <td className="py-2.5 pr-4">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-[var(--color-fg)]">
                      {PROTOCOL_LABELS[p] || p}
                    </span>
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-fg)]">
                  {followers[p] !== undefined ? formatCompact(followers[p]) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-fg)]">
                  {totalEng > 0 ? formatCompact(totalEng) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                  {eng?.likes ? formatCompact(eng.likes) : '—'}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-muted)]">
                  {eng?.reposts ? formatCompact(eng.reposts) : '—'}
                </td>
                <td className="py-2.5 text-right tabular-nums text-degen-400">
                  {tips[p] !== undefined ? formatUsd(tips[p]) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
