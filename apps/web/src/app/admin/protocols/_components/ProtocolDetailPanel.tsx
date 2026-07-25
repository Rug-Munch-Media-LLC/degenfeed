'use client';

import { formatCount, formatTime } from '../helpers';
import type { ProtocolInstance, ProtocolLog } from '../types';
import { DetailItem } from './DetailItem';

export function ProtocolDetailPanel({
  protocol,
  logs,
  activeTab,
  actionLoading,
  onClose,
  onRestart,
  onTabChange,
}: {
  protocol: ProtocolInstance;
  logs: ProtocolLog[];
  activeTab: string;
  actionLoading: string | null;
  onClose: () => void;
  onRestart: () => void;
  onTabChange: (tab: 'overview' | 'config' | 'connectors' | 'logs') => void;
}) {
  return (
    <section
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${protocol.name} details`}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="none"
      >
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-muted)] text-2xl">
              {protocol.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-fg)]">{protocol.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted)]">{protocol.version}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    protocol.status === 'online'
                      ? 'bg-green-500/15 text-green-400'
                      : protocol.status === 'degraded'
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${protocol.status === 'online' ? 'bg-green-500' : protocol.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  />
                  {protocol.status}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-6 flex gap-2 border-b border-[var(--color-border)] pb-2">
          {(['overview', 'config', 'connectors', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === tab ? 'bg-degen-500/15 text-degen-400' : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'}`}
            >
              {tab === 'overview'
                ? '📊 Overview'
                : tab === 'config'
                  ? '⚙️ Config'
                  : tab === 'connectors'
                    ? '🔗 Connectors'
                    : '📋 Logs'}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-4">
            <DetailItem label="Total Users" value={formatCount(protocol.totalUsers)} />
            <DetailItem label="Total Posts" value={formatCount(protocol.totalPosts)} />
            <DetailItem label="Users (24h)" value={formatCount(protocol.users24h)} />
            <DetailItem label="Posts (24h)" value={formatCount(protocol.posts24h)} />
            <DetailItem label="Avg Latency" value={`${protocol.avgLatency}ms`} />
            <DetailItem label="Error Rate" value={`${protocol.errorRate}%`} />
            <DetailItem label="Federation" value={protocol.federationStatus} />
            <DetailItem label="Last Sync" value={formatTime(protocol.lastSync)} />
            <DetailItem label="Health Score" value={`${protocol.health}/100`} />
            <DetailItem label="Enabled" value={protocol.enabled ? 'Yes' : 'No'} />
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-3">
            {Object.entries(protocol.config).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3"
              >
                <span className="text-xs font-mono text-[var(--color-muted)]">{key}</span>
                <span className="text-xs text-[var(--color-fg)]">{String(value)}</span>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
            >
              Edit Settings →
            </button>
          </div>
        )}

        {activeTab === 'connectors' && (
          <div className="space-y-2">
            {protocol.connectors.map((connector) => (
              <div
                key={connector}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/15 text-[10px] text-green-400">
                  ✓
                </span>
                <span className="text-sm text-[var(--color-fg)]">{connector}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {logs.filter((l) => l.protocolId === protocol.id).length === 0 && (
              <p className="text-xs text-[var(--color-muted)] text-center py-8">
                No logs for this protocol.
              </p>
            )}
            {logs
              .filter((l) => l.protocolId === protocol.id)
              .map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5"
                >
                  <span
                    className={`mt-0.5 text-xs ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-degen-400'}`}
                  >
                    {log.level === 'error' ? '✕' : log.level === 'warn' ? '⚠' : 'ℹ'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[var(--color-fg)]">{log.message}</p>
                    <p className="text-[10px] text-[var(--color-muted)]">
                      {formatTime(log.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
          <button
            type="button"
            onClick={onRestart}
            disabled={actionLoading === `${protocol.id}-restart`}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
          >
            {actionLoading === `${protocol.id}-restart` ? 'Restarting…' : '↻ Restart'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
          >
            📄 View Full Logs
          </button>
          <button
            type="button"
            className="rounded-xl border border-degen-500/30 px-4 py-2 text-xs text-degen-400 transition-colors hover:bg-degen-500/10"
          >
            ⚙️ Edit Config
          </button>
        </div>
      </div>
    </section>
  );
}
