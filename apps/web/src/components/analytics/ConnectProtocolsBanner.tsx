'use client';

import { PROTOCOL_COLORS, PROTOCOL_LABELS, PROTOCOL_ORDER } from './constants';

export function ConnectProtocolsBanner({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-lg">✦</span>
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 text-sm font-semibold text-yellow-400">
            Connect more protocols for richer analytics
          </h3>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            Your dashboard currently shows data from {PROTOCOL_ORDER.length - missing.length} of{' '}
            {PROTOCOL_ORDER.length} supported protocols.
          </p>
          <div className="flex flex-wrap gap-2">
            {missing.map((p) => (
              <a
                key={p}
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-medium transition-colors hover:opacity-80"
                style={{
                  backgroundColor: `${PROTOCOL_COLORS[p] || '#666'}20`,
                  color: PROTOCOL_COLORS[p] || '#666',
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: PROTOCOL_COLORS[p] }}
                />
                Connect {PROTOCOL_LABELS[p] || p}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
