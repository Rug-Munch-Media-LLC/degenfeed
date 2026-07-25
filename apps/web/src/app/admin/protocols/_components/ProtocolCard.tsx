'use client';

import { formatCount } from '../helpers';
import type { ProtocolInstance } from '../types';

export function ProtocolCard({
  protocol,
  selected,
  actionLoading,
  onSelect,
  onRestart,
  onToggle,
}: {
  protocol: ProtocolInstance;
  selected: boolean;
  actionLoading: string | null;
  onSelect: () => void;
  onRestart: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={`rounded-xl border bg-[var(--color-card)] p-4 transition-all cursor-pointer hover:border-degen-500/30 ${
        protocol.status === 'offline'
          ? 'border-red-500/20 opacity-60'
          : protocol.status === 'degraded'
            ? 'border-yellow-500/20'
            : 'border-[var(--color-border)]'
      } ${selected ? 'ring-2 ring-degen-500' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSelect();
      }}
      role="button"
      tabIndex={0}
      aria-label={`View ${protocol.name} details`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{protocol.icon}</span>
          <span className="text-sm font-semibold text-[var(--color-fg)]">{protocol.name}</span>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            protocol.status === 'online'
              ? 'bg-green-500/15 text-green-400'
              : protocol.status === 'degraded'
                ? 'bg-yellow-500/15 text-yellow-400'
                : 'bg-red-500/15 text-red-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              protocol.status === 'online'
                ? 'bg-green-500 animate-pulse'
                : protocol.status === 'degraded'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
          />
          {protocol.status}
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] text-[var(--color-muted)]">Health</span>
          <span
            className={`text-[10px] font-medium ${protocol.health > 80 ? 'text-green-400' : protocol.health > 50 ? 'text-yellow-400' : 'text-red-400'}`}
          >
            {protocol.health}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
          <div
            className={`h-full rounded-full transition-all ${protocol.health > 80 ? 'bg-green-500' : protocol.health > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${protocol.health}%` }}
          />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <span className="text-[var(--color-muted)]">Users/24h: </span>
          <span className="font-medium text-[var(--color-fg)]">
            {formatCount(protocol.users24h)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Posts/24h: </span>
          <span className="font-medium text-[var(--color-fg)]">
            {formatCount(protocol.posts24h)}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Latency: </span>
          <span
            className={`font-medium ${protocol.avgLatency > 500 ? 'text-yellow-400' : 'text-[var(--color-fg)]'}`}
          >
            {protocol.avgLatency}ms
          </span>
        </div>
        <div>
          <span className="text-[var(--color-muted)]">Federation: </span>
          <span
            className={`font-medium ${protocol.federationStatus === 'active' ? 'text-green-400' : protocol.federationStatus === 'partial' ? 'text-yellow-400' : 'text-[var(--color-muted)]'}`}
          >
            {protocol.federationStatus}
          </span>
        </div>
      </div>

      {protocol.lastError && (
        <div className="mb-3 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-400 leading-relaxed">
          {protocol.lastError}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-[10px] text-[var(--color-muted)]">{protocol.version}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            disabled={actionLoading === `${protocol.id}-restart`}
            className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            {actionLoading === `${protocol.id}-restart` ? '…' : '↻ Restart'}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={protocol.enabled}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`toggle-track ${!protocol.enabled ? 'opacity-50' : ''}`}
            data-checked={protocol.enabled}
          >
            <span className="toggle-thumb" />
          </button>
        </div>
      </div>
    </div>
  );
}
