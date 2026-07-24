'use client';

import { useCallback, useEffect, useState } from 'react';

// === Types ============================================================

interface ProtocolInstance {
  id: string;
  name: string;
  icon: string;
  status: 'online' | 'degraded' | 'offline';
  version: string;
  health: number; // 0-100
  users24h: number;
  posts24h: number;
  totalUsers: number;
  totalPosts: number;
  federationStatus: 'active' | 'partial' | 'inactive';
  lastSync: number;
  errorRate: number;
  avgLatency: number;
  lastError?: string;
  config: Record<string, string | number | boolean>;
  connectors: string[];
  enabled: boolean;
}

interface ProtocolLog {
  id: string;
  protocolId: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

interface AddProtocolWizard {
  step: number;
  name: string;
  icon: string;
  type: string;
  endpoint: string;
  apiKey: string;
}

// === Helpers ==========================================================

const PROTOCOL_DEFAULTS: ProtocolInstance[] = [
  {
    id: 'nostr', name: 'Nostr', icon: '⚡', status: 'online', version: 'v2.4.1',
    health: 97, users24h: 187, posts24h: 312, totalUsers: 2841, totalPosts: 89200,
    federationStatus: 'active', lastSync: Date.now() - 12000, errorRate: 0.8, avgLatency: 180,
    config: { relays: 'wss://relay.damus.io', enabled: true, batchSize: 50 },
    connectors: ['Relay Pool', 'NIP-05 Verifier'], enabled: true,
  },
  {
    id: 'farcaster', name: 'Farcaster', icon: '🟣', status: 'online', version: 'v1.8.3',
    health: 95, users24h: 142, posts24h: 204, totalUsers: 1850, totalPosts: 65400,
    federationStatus: 'active', lastSync: Date.now() - 8000, errorRate: 0.3, avgLatency: 220,
    config: { hubUrl: 'https://hub.farcaster.xyz', enabled: true },
    connectors: ['Hub Connection', 'Frame Validator'], enabled: true,
  },
  {
    id: 'lens', name: 'Lens', icon: '🌿', status: 'online', version: 'v1.3.0',
    health: 88, users24h: 65, posts24h: 98, totalUsers: 920, totalPosts: 28400,
    federationStatus: 'active', lastSync: Date.now() - 30000, errorRate: 1.2, avgLatency: 350,
    config: { apiEndpoint: 'https://api.lens.dev', enabled: true, pollInterval: 60 },
    connectors: ['GraphQL API', 'Profile Resolver'], enabled: true,
  },
  {
    id: 'bluesky', name: 'Bluesky', icon: '🦋', status: 'online', version: 'v1.1.2',
    health: 93, users24h: 98, posts24h: 156, totalUsers: 1205, totalPosts: 42100,
    federationStatus: 'active', lastSync: Date.now() - 15000, errorRate: 0.5, avgLatency: 195,
    config: { pdsUrl: 'https://bsky.social', enabled: true },
    connectors: ['AT Protocol', 'DID Resolver'], enabled: true,
  },
  {
    id: 'mastodon', name: 'Mastodon', icon: '🐘', status: 'degraded', version: 'v1.0.5',
    health: 62, users24h: 41, posts24h: 72, totalUsers: 680, totalPosts: 19800,
    federationStatus: 'partial', lastSync: Date.now() - 120000, errorRate: 4.7, avgLatency: 2300,
    lastError: 'Rate limit hit — 429 Too Many Requests',
    config: { instances: 'mastodon.social,mas.to', enabled: true, rateLimitDelay: 2000 },
    connectors: ['ActivityPub', 'Instance Poller'], enabled: true,
  },
  {
    id: 'threads', name: 'Threads', icon: '🧵', status: 'degraded', version: 'v0.9.0-exp',
    health: 45, users24h: 28, posts24h: 44, totalUsers: 340, totalPosts: 8900,
    federationStatus: 'partial', lastSync: Date.now() - 45000, errorRate: 2.1, avgLatency: 410,
    config: { enabled: false, scrapeInterval: 120, requiresOptIn: true },
    connectors: ['Web Scraper', 'Rate Limiter'], enabled: false,
  },
  {
    id: 'reddit', name: 'Reddit', icon: '🔴', status: 'online', version: 'v2.0.1',
    health: 91, users24h: 53, posts24h: 89, totalUsers: 720, totalPosts: 31200,
    federationStatus: 'inactive', lastSync: Date.now() - 20000, errorRate: 0.6, avgLatency: 260,
    config: { clientId: '****', userAgent: 'DegenFeed/2.0', enabled: true },
    connectors: ['OAuth Client', 'Subreddit Watcher'], enabled: true,
  },
  {
    id: 'rss', name: 'RSS Feeds', icon: '📡', status: 'online', version: 'v1.5.0',
    health: 78, users24h: 0, posts24h: 210, totalUsers: 0, totalPosts: 58000,
    federationStatus: 'inactive', lastSync: Date.now() - 60000, errorRate: 3.4, avgLatency: 1500,
    config: { maxFeeds: 500, pollInterval: 900, enabled: true },
    connectors: ['Feed Parser', 'OPML Importer'], enabled: true,
  },
];

const PROTOCOL_LOGS: ProtocolLog[] = [
  { id: 'l1', protocolId: 'mastodon', message: 'Rate limit exceeded — backing off 30s', level: 'warn', timestamp: Date.now() - 120000 },
  { id: 'l2', protocolId: 'lens', message: 'GraphQL query timeout after 10s', level: 'warn', timestamp: Date.now() - 300000 },
  { id: 'l3', protocolId: 'nostr', message: 'Connected to relay pool (4/4 relays)', level: 'info', timestamp: Date.now() - 600000 },
  { id: 'l4', protocolId: 'rss', message: 'Feed parse error on https://example.com/rss', level: 'error', timestamp: Date.now() - 900000 },
  { id: 'l5', protocolId: 'farcaster', message: 'Hub sync completed — 204 new posts', level: 'info', timestamp: Date.now() - 1800000 },
];

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// === Component ========================================================

export default function AdminProtocolsPage() {
  const [protocols, setProtocols] = useState<ProtocolInstance[]>(PROTOCOL_DEFAULTS);
  const [logs, setLogs] = useState<ProtocolLog[]>(PROTOCOL_LOGS);
  const [loading, setLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolInstance | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'connectors' | 'logs'>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizard, setWizard] = useState<AddProtocolWizard>({
    step: 1, name: '', icon: '', type: 'nostr', endpoint: '', apiKey: '',
  });
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchProtocols = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/protocols', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { protocols: ProtocolInstance[] };
        if (data.protocols?.length) setProtocols(data.protocols);
      }
    } catch { /* use defaults */ }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/protocols/logs', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as { logs: ProtocolLog[] };
        if (data.logs?.length) setLogs(data.logs);
      }
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchProtocols(), fetchLogs()]).finally(() => setLoading(false));
    const pi = setInterval(() => { fetchProtocols(); fetchLogs(); }, 15000);
    setPollInterval(pi);
    return () => clearInterval(pi);
  }, [fetchProtocols, fetchLogs]);

  const handleProtocolAction = useCallback(async (protocolId: string, action: 'restart' | 'toggle') => {
    setActionLoading(`${protocolId}-${action}`);
    try {
      const method = action === 'restart' ? 'POST' : 'POST';
      const res = await fetch(`/api/admin/protocols/${protocolId}/${action}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: action === 'toggle' ? JSON.stringify({
          enabled: !protocols.find((p) => p.id === protocolId)?.enabled,
        }) : undefined,
      });
      if (res.ok) {
        showToast(`${protocolId} ${action === 'restart' ? 'restarted' : 'toggled'}`);
        fetchProtocols();
      } else {
        showToast(`Failed to ${action} ${protocolId}`, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [protocols, fetchProtocols, showToast]);

  const handleAddProtocol = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: wizard.name,
          type: wizard.type,
          endpoint: wizard.endpoint,
          apiKey: wizard.apiKey,
        }),
      });
      if (res.ok) {
        showToast(`Protocol "${wizard.name}" added`);
        setWizardOpen(false);
        setWizard({ step: 1, name: '', icon: '', type: 'nostr', endpoint: '', apiKey: '' });
        fetchProtocols();
      } else {
        showToast('Failed to add protocol', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }, [wizard, fetchProtocols, showToast]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading protocols…</p>
        </div>
      </div>
    );
  }

  const onlineCount = protocols.filter((p) => p.status === 'online').length;
  const totalPosts24h = protocols.reduce((s, p) => s + p.posts24h, 0);
  const totalUsers24h = protocols.reduce((s, p) => s + p.users24h, 0);

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${
            toast.kind === 'success'
              ? 'border border-green-500/30 bg-green-900/40 text-green-300'
              : 'border border-red-500/30 bg-red-900/40 text-red-300'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-fg)]">Protocol Management</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Monitor and manage all connected social protocols
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-degen-500/20 px-5 py-2.5 text-sm font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
        >
          + Add Protocol
        </button>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{protocols.length}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Total Protocols</p>
        </div>
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">
          <p className="text-lg font-bold text-green-400">{onlineCount}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Online</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{formatCount(totalPosts24h)}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Posts / 24h</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{formatCount(totalUsers24h)}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Active Users / 24h</p>
        </div>
      </div>

      {/* Protocol grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {protocols.map((protocol) => (
          <div
            key={protocol.id}
            className={`rounded-xl border bg-[var(--color-card)] p-4 transition-all cursor-pointer hover:border-degen-500/30 ${
              protocol.status === 'offline'
                ? 'border-red-500/20 opacity-60'
                : protocol.status === 'degraded'
                  ? 'border-yellow-500/20'
                  : 'border-[var(--color-border)]'
            } ${selectedProtocol?.id === protocol.id ? 'ring-2 ring-degen-500' : ''}`}
            onClick={() => setSelectedProtocol(protocol)}
            onKeyDown={(e) => { if (e.key === 'Enter') setSelectedProtocol(protocol); }}
            role="button"
            tabIndex={0}
            aria-label={`View ${protocol.name} details`}
          >
            {/* Header */}
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
                    protocol.status === 'online' ? 'bg-green-500 animate-pulse' : protocol.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                />
                {protocol.status}
              </div>
            </div>

            {/* Health bar */}
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-[var(--color-muted)]">Health</span>
                <span className={`text-[10px] font-medium ${protocol.health > 80 ? 'text-green-400' : protocol.health > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {protocol.health}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-muted)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    protocol.health > 80 ? 'bg-green-500' : protocol.health > 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${protocol.health}%` }}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="mb-3 grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="text-[var(--color-muted)]">Users/24h: </span>
                <span className="font-medium text-[var(--color-fg)]">{formatCount(protocol.users24h)}</span>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Posts/24h: </span>
                <span className="font-medium text-[var(--color-fg)]">{formatCount(protocol.posts24h)}</span>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Latency: </span>
                <span className={`font-medium ${protocol.avgLatency > 500 ? 'text-yellow-400' : 'text-[var(--color-fg)]'}`}>
                  {protocol.avgLatency}ms
                </span>
              </div>
              <div>
                <span className="text-[var(--color-muted)]">Federation: </span>
                <span className={`font-medium ${
                  protocol.federationStatus === 'active' ? 'text-green-400' : protocol.federationStatus === 'partial' ? 'text-yellow-400' : 'text-[var(--color-muted)]'
                }`}>
                  {protocol.federationStatus}
                </span>
              </div>
            </div>

            {/* Error */}
            {protocol.lastError && (
              <div className="mb-3 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-400 leading-relaxed">
                {protocol.lastError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-[10px] text-[var(--color-muted)]">{protocol.version}</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleProtocolAction(protocol.id, 'restart'); }}
                  disabled={actionLoading === `${protocol.id}-restart`}
                  className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
                >
                  {actionLoading === `${protocol.id}-restart` ? '…' : '↻ Restart'}
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={protocol.enabled}
                  onClick={(e) => { e.stopPropagation(); handleProtocolAction(protocol.id, 'toggle'); }}
                  className={`toggle-track ${!protocol.enabled ? 'opacity-50' : ''}`}
                  data-checked={protocol.enabled}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* == Protocol Detail Panel == */}
      {selectedProtocol && (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setSelectedProtocol(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedProtocol(null); }}
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedProtocol.name} details`}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="none"
          >
            {/* Header */}
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-muted)] text-2xl">
                  {selectedProtocol.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-fg)]">{selectedProtocol.name}</h2>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-[var(--color-muted)]">{selectedProtocol.version}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        selectedProtocol.status === 'online'
                          ? 'bg-green-500/15 text-green-400'
                          : selectedProtocol.status === 'degraded'
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${selectedProtocol.status === 'online' ? 'bg-green-500' : selectedProtocol.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                      {selectedProtocol.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProtocol(null)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex gap-2 border-b border-[var(--color-border)] pb-2">
              {(['overview', 'config', 'connectors', 'logs'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-degen-500/15 text-degen-400'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
                  }`}
                >
                  {tab === 'overview' ? '📊 Overview' : tab === 'config' ? '⚙️ Config' : tab === 'connectors' ? '🔗 Connectors' : '📋 Logs'}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Total Users" value={formatCount(selectedProtocol.totalUsers)} />
                <DetailItem label="Total Posts" value={formatCount(selectedProtocol.totalPosts)} />
                <DetailItem label="Users (24h)" value={formatCount(selectedProtocol.users24h)} />
                <DetailItem label="Posts (24h)" value={formatCount(selectedProtocol.posts24h)} />
                <DetailItem label="Avg Latency" value={`${selectedProtocol.avgLatency}ms`} />
                <DetailItem label="Error Rate" value={`${selectedProtocol.errorRate}%`} />
                <DetailItem label="Federation" value={selectedProtocol.federationStatus} />
                <DetailItem label="Last Sync" value={formatTime(selectedProtocol.lastSync)} />
                <DetailItem label="Health Score" value={`${selectedProtocol.health}/100`} />
                <DetailItem label="Enabled" value={selectedProtocol.enabled ? 'Yes' : 'No'} />
              </div>
            )}

            {/* Tab: Config */}
            {activeTab === 'config' && (
              <div className="space-y-3">
                {Object.entries(selectedProtocol.config).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
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

            {/* Tab: Connectors */}
            {activeTab === 'connectors' && (
              <div className="space-y-2">
                {selectedProtocol.connectors.map((connector) => (
                  <div key={connector} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/15 text-[10px] text-green-400">✓</span>
                    <span className="text-sm text-[var(--color-fg)]">{connector}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Tab: Logs */}
            {activeTab === 'logs' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {logs
                  .filter((l) => l.protocolId === selectedProtocol.id)
                  .map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5">
                      <span className={`mt-0.5 text-xs ${
                        log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-degen-400'
                      }`}>
                        {log.level === 'error' ? '✕' : log.level === 'warn' ? '⚠' : 'ℹ'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--color-fg)]">{log.message}</p>
                        <p className="text-[10px] text-[var(--color-muted)]">{formatTime(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                {logs.filter((l) => l.protocolId === selectedProtocol.id).length === 0 && (
                  <p className="text-xs text-[var(--color-muted)] text-center py-8">No logs for this protocol.</p>
                )}
              </div>
            )}

            {/* Actions bar */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-4">
              <button
                type="button"
                onClick={() => handleProtocolAction(selectedProtocol.id, 'restart')}
                disabled={actionLoading === `${selectedProtocol.id}-restart`}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
              >
                {actionLoading === `${selectedProtocol.id}-restart` ? 'Restarting…' : '↻ Restart'}
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
      )}

      {/* == Add Protocol Wizard == */}
      {wizardOpen && (
        <section
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setWizardOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setWizardOpen(false); }}
          role="dialog"
          aria-modal="true"
          aria-label="Add new protocol"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="none"
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[var(--color-fg)]">Add Protocol</h2>
              <button
                type="button"
                onClick={() => setWizardOpen(false)}
                className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)] transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Step indicator */}
            <div className="mb-6 flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2 flex-1">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                    wizard.step >= s ? 'bg-degen-500/20 text-degen-400' : 'bg-[var(--color-muted)] text-[var(--color-muted)]'
                  }`}>
                    {s}
                  </div>
                  {s < 3 && <div className={`flex-1 h-0.5 ${wizard.step > s ? 'bg-degen-500/40' : 'bg-[var(--color-muted)]'}`} />}
                </div>
              ))}
            </div>

            {/* Step 1: Basic info */}
            {wizard.step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Protocol Name</label>
                  <input
                    type="text"
                    value={wizard.name}
                    onChange={(e) => setWizard((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g., Bluesky"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Protocol Type</label>
                  <select
                    value={wizard.type}
                    onChange={(e) => setWizard((p) => ({ ...p, type: e.target.value }))}
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
                  >
                    <option value="nostr">Nostr</option>
                    <option value="farcaster">Farcaster</option>
                    <option value="lens">Lens</option>
                    <option value="bluesky">Bluesky</option>
                    <option value="mastodon">Mastodon</option>
                    <option value="rss">RSS</option>
                    <option value="reddit">Reddit</option>
                    <option value="custom">Custom / Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Icon (emoji)</label>
                  <input
                    type="text"
                    value={wizard.icon}
                    onChange={(e) => setWizard((p) => ({ ...p, icon: e.target.value }))}
                    placeholder="e.g., 🦋"
                    maxLength={2}
                    className="w-20 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] text-center focus:border-degen-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Connection */}
            {wizard.step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">API Endpoint / URL</label>
                  <input
                    type="text"
                    value={wizard.endpoint}
                    onChange={(e) => setWizard((p) => ({ ...p, endpoint: e.target.value }))}
                    placeholder="https://api.example.com"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">API Key (optional)</label>
                  <input
                    type="password"
                    value={wizard.apiKey}
                    onChange={(e) => setWizard((p) => ({ ...p, apiKey: e.target.value }))}
                    placeholder="Leave blank if not required"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {wizard.step === 3 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-2xl">{wizard.icon || '🔌'}</span>
                    <div>
                      <p className="text-sm font-bold text-[var(--color-fg)]">{wizard.name || '(unnamed)'}</p>
                      <p className="text-[10px] text-[var(--color-muted)]">{wizard.type}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs text-[var(--color-muted)]">
                    <p>Endpoint: {wizard.endpoint || '(not set)'}</p>
                    <p>API Key: {wizard.apiKey ? '••••••••' : '(not set)'}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  The protocol will be added in disabled mode. You can enable it from the dashboard after confirming configuration.
                </p>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setWizard((p) => ({ ...p, step: Math.max(1, p.step - 1) }))}
                disabled={wizard.step === 1}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
              >
                ← Back
              </button>
              {wizard.step < 3 ? (
                <button
                  type="button"
                  onClick={() => setWizard((p) => ({ ...p, step: p.step + 1 }))}
                  className="rounded-xl bg-degen-500/20 px-4 py-2.5 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
                >
                  Next →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddProtocol}
                  className="rounded-xl bg-degen-500/20 px-4 py-2.5 text-xs font-semibold text-degen-400 transition-colors hover:bg-degen-500/30"
                >
                  ✓ Add Protocol
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// === Sub-components ===================================================

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className="text-sm font-medium text-[var(--color-fg)]">{value}</p>
    </div>
  );
}
