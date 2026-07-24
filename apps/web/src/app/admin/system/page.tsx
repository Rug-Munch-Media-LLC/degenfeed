'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// === Types ============================================================

interface ServerResources {
  cpu: { model: string; cores: number; usage: number; temperature?: number };
  memory: { total: number; used: number; usagePercent: number };
  disk: { total: number; used: number; usagePercent: number; mount: string };
  network: { rxBytes: number; txBytes: number; uptime: number; connections: number };
  loadAverage: number[];
}

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'restarting' | 'paused';
  ports: string;
  cpu: number;
  memory: number;
  uptime: number;
  restartCount: number;
}

interface BackupItem {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'database' | 'config';
  size: string;
  status: 'completed' | 'running' | 'failed' | 'pending';
  target: string;
  startedAt: number;
  completedAt?: number;
  location: string;
}

interface DnsSslEntry {
  domain: string;
  dnsStatus: 'resolved' | 'unresolved' | 'checking';
  sslStatus: 'valid' | 'expiring' | 'expired' | 'missing' | 'checking';
  sslExpiry?: number;
  issuer?: string;
  ip?: string;
}

interface ServiceVersion {
  name: string;
  version: string;
  latestVersion?: string;
  status: 'up_to_date' | 'outdated' | 'unknown';
  category: 'core' | 'infrastructure' | 'protocol' | 'monitoring';
}

interface SystemLog {
  id: string;
  service: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: number;
}

// === Default Data =====================================================

const DEFAULT_RESOURCES: ServerResources = {
  cpu: { model: 'AMD EPYC 7443P', cores: 8, usage: 34.2, temperature: 52 },
  memory: { total: 32768, used: 18432, usagePercent: 56.2 },
  disk: { total: 512, used: 283, usagePercent: 55.3, mount: '/' },
  network: { rxBytes: 1_450_000_000_000, txBytes: 820_000_000_000, uptime: 342720, connections: 247 },
  loadAverage: [1.24, 1.08, 0.95],
};

const DEFAULT_CONTAINERS: DockerContainer[] = [
  { id: 'c1', name: 'degenfeed-api', image: 'degenfeed/api:latest', status: 'running', ports: '3000', cpu: 5.2, memory: 256, uptime: 342720, restartCount: 1 },
  { id: 'c2', name: 'feed-worker', image: 'degenfeed/worker:latest', status: 'running', ports: '', cpu: 18.3, memory: 512, uptime: 342720, restartCount: 0 },
  { id: 'c3', name: 'tip-indexer', image: 'degenfeed/tip-indexer:latest', status: 'running', ports: '', cpu: 1.4, memory: 128, uptime: 342720, restartCount: 2 },
  { id: 'c4', name: 'postgres-15', image: 'postgres:15-alpine', status: 'running', ports: '5432', cpu: 2.8, memory: 1024, uptime: 342720, restartCount: 0 },
  { id: 'c5', name: 'redis-stack', image: 'redis/redis-stack:latest', status: 'running', ports: '6379', cpu: 0.6, memory: 64, uptime: 342720, restartCount: 0 },
  { id: 'c6', name: 'nginx-proxy', image: 'nginx:alpine', status: 'running', ports: '80,443', cpu: 0.3, memory: 16, uptime: 342720, restartCount: 0 },
  { id: 'c7', name: 'celery-worker', image: 'degenfeed/celery:latest', status: 'restarting', ports: '', cpu: 0, memory: 0, uptime: 0, restartCount: 5 },
];

const DEFAULT_BACKUPS: BackupItem[] = [
  { id: 'b1', name: 'full-daily-2026-07-24', type: 'full', size: '4.2 GB', status: 'completed', target: 'R2 + B2', startedAt: Date.now() - 43200000, completedAt: Date.now() - 41400000, location: 'R2: /backups/daily/' },
  { id: 'b2', name: 'db-hourly-2026-07-24-14', type: 'database', size: '1.1 GB', status: 'completed', target: 'R2', startedAt: Date.now() - 3600000, completedAt: Date.now() - 3480000, location: 'R2: /backups/db/' },
  { id: 'b3', name: 'incremental-2026-07-24', type: 'incremental', size: '320 MB', status: 'running', target: 'B2', startedAt: Date.now() - 600000, location: 'B2: /backups/incremental/' },
  { id: 'b4', name: 'config-backup', type: 'config', size: '12 MB', status: 'completed', target: 'Git + R2', startedAt: Date.now() - 86400000, completedAt: Date.now() - 85800000, location: 'Git: infra/backups/' },
  { id: 'b5', name: 'weekly-full-2026-07-20', type: 'full', size: '24.8 GB', status: 'completed', target: 'R2 + B2 + HF', startedAt: Date.now() - 345600000, completedAt: Date.now() - 342000000, location: 'HF: degenfeed-backups/' },
];

const DEFAULT_DNS: DnsSslEntry[] = [
  { domain: 'app.degenfeed.xyz', dnsStatus: 'resolved', sslStatus: 'valid', sslExpiry: Date.now() + 7776000000, issuer: 'Cloudflare', ip: '185.10.68.42' },
  { domain: 'api.degenfeed.xyz', dnsStatus: 'resolved', sslStatus: 'valid', sslExpiry: Date.now() + 7776000000, issuer: 'Cloudflare', ip: '185.10.68.42' },
  { domain: 'degenfeed.xyz', dnsStatus: 'resolved', sslStatus: 'valid', sslExpiry: Date.now() + 7776000000, issuer: 'Cloudflare', ip: '185.10.68.42' },
  { domain: 'cdn.degenfeed.xyz', dnsStatus: 'resolved', sslStatus: 'valid', sslExpiry: Date.now() + 5184000000, issuer: 'Cloudflare', ip: '185.10.68.42' },
  { domain: 'relay.degenfeed.xyz', dnsStatus: 'resolved', sslStatus: 'expiring', sslExpiry: Date.now() + 864000000, issuer: 'Let\'s Encrypt', ip: '185.10.68.84' },
  { domain: 'metrics.degenfeed.xyz', dnsStatus: 'unresolved', sslStatus: 'missing', ip: '—' },
];

const DEFAULT_VERSIONS: ServiceVersion[] = [
  { name: 'degenfeed-api', version: '2.1.0', latestVersion: '2.1.0', status: 'up_to_date', category: 'core' },
  { name: 'degenfeed-web', version: '0.1.0', latestVersion: '0.1.0', status: 'up_to_date', category: 'core' },
  { name: 'feed-worker', version: '1.4.2', latestVersion: '1.5.0', status: 'outdated', category: 'core' },
  { name: 'tip-indexer', version: '0.8.1', latestVersion: '0.8.1', status: 'up_to_date', category: 'core' },
  { name: 'celery-worker', version: '1.0.0', latestVersion: '1.0.3', status: 'outdated', category: 'core' },
  { name: 'PostgreSQL', version: '15.8', latestVersion: '16.3', status: 'outdated', category: 'infrastructure' },
  { name: 'Redis', version: '7.2.5', latestVersion: '7.4.0', status: 'outdated', category: 'infrastructure' },
  { name: 'Nginx', version: '1.26.0', latestVersion: '1.26.2', status: 'outdated', category: 'infrastructure' },
  { name: 'Node.js', version: '22.4.0', latestVersion: '22.5.0', status: 'outdated', category: 'infrastructure' },
  { name: 'Nostr Relay', version: '0.9.6', latestVersion: '0.9.6', status: 'up_to_date', category: 'protocol' },
  { name: 'Ollama', version: '0.3.8', latestVersion: '0.3.10', status: 'outdated', category: 'infrastructure' },
  { name: 'Prometheus', version: '2.53.0', latestVersion: '2.53.0', status: 'up_to_date', category: 'monitoring' },
  { name: 'Grafana', version: '11.1.0', latestVersion: '11.1.0', status: 'up_to_date', category: 'monitoring' },
];

const SYSTEM_LOGS: SystemLog[] = [
  { id: 'sl1', service: 'api', message: 'Scheduled health check passed — all endpoints OK', level: 'info', timestamp: Date.now() - 60000 },
  { id: 'sl2', service: 'feed-worker', message: 'Fetched 204 new posts from Farcaster hub', level: 'info', timestamp: Date.now() - 120000 },
  { id: 'sl3', service: 'celery-worker', message: 'Task queue depth: 12 pending jobs', level: 'info', timestamp: Date.now() - 300000 },
  { id: 'sl4', service: 'mastodon-fetcher', message: 'Rate limit hit — backing off 30s', level: 'warn', timestamp: Date.now() - 600000 },
  { id: 'sl5', service: 'postgres', message: 'Long query detected (12s): SELECT from posts table', level: 'warn', timestamp: Date.now() - 1800000 },
  { id: 'sl6', service: 'redis', message: 'Memory usage at 72% — eviction policy active', level: 'info', timestamp: Date.now() - 3600000 },
];

// === Helpers ==========================================================

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

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000_000) return `${(bytes / 1_000_000_000_000).toFixed(1)} TB`;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1000).toFixed(0)} KB`;
}

function formatGB(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// === Component ========================================================

export default function AdminSystemPage() {
  const [resources, setResources] = useState<ServerResources>(DEFAULT_RESOURCES);
  const [containers, setContainers] = useState<DockerContainer[]>(DEFAULT_CONTAINERS);
  const [backups, setBackups] = useState<BackupItem[]>(DEFAULT_BACKUPS);
  const [dnsEntries, setDnsEntries] = useState<DnsSslEntry[]>(DEFAULT_DNS);
  const [versions, setVersions] = useState<ServiceVersion[]>(DEFAULT_VERSIONS);
  const [logs, setLogs] = useState<SystemLog[]>(SYSTEM_LOGS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resources' | 'docker' | 'backups' | 'dns' | 'versions' | 'logs'>('resources');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [resResources, resContainers, resBackups, resDns, resVersions, resLogs] = await Promise.all([
        fetch('/api/admin/system/servers', { credentials: 'include' }),
        fetch('/api/admin/system/containers', { credentials: 'include' }),
        fetch('/api/admin/system/backups', { credentials: 'include' }),
        fetch('/api/admin/system/dns', { credentials: 'include' }),
        fetch('/api/admin/system/versions', { credentials: 'include' }),
        fetch('/api/admin/system/logs', { credentials: 'include' }),
      ]);
      if (resResources.ok) { const d = await resResources.json() as { resources: ServerResources }; if (d.resources) setResources(d.resources); }
      if (resContainers.ok) { const d = await resContainers.json() as { containers: DockerContainer[] }; if (d.containers) setContainers(d.containers); }
      if (resBackups.ok) { const d = await resBackups.json() as { backups: BackupItem[] }; if (d.backups) setBackups(d.backups); }
      if (resDns.ok) { const d = await resDns.json() as { dns: DnsSslEntry[] }; if (d.dns) setDnsEntries(d.dns); }
      if (resVersions.ok) { const d = await resVersions.json() as { versions: ServiceVersion[] }; if (d.versions) setVersions(d.versions); }
      if (resLogs.ok) { const d = await resLogs.json() as { logs: SystemLog[] }; if (d.logs) setLogs(d.logs); }
    } catch { /* use defaults */ }
  }, []);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    const pi = setInterval(fetchAll, 30000);
    return () => clearInterval(pi);
  }, [fetchAll]);

  const handleContainerAction = useCallback(async (containerId: string, action: 'restart' | 'logs') => {
    setActionLoading(`${containerId}-${action}`);
    try {
      const res = await fetch(`/api/admin/system/containers/${containerId}/${action}`, {
        method: 'POST', credentials: 'include',
      });
      if (res.ok) {
        showToast(`Container ${action} initiated`);
        fetchAll();
      } else {
        showToast(`Failed to ${action} container`, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [fetchAll, showToast]);

  const handleBackupTrigger = useCallback(async (type: string) => {
    setActionLoading(`backup-${type}`);
    try {
      const res = await fetch('/api/admin/system/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        showToast(`${type} backup started`);
        fetchAll();
      } else {
        showToast(`Failed to start ${type} backup`, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [fetchAll, showToast]);

  const handleCheckDns = useCallback(async () => {
    setActionLoading('dns-check');
    try {
      const res = await fetch('/api/admin/system/dns', {
        method: 'POST', credentials: 'include',
      });
      if (res.ok) {
        showToast('DNS/SSL check initiated');
        setTimeout(fetchAll, 3000);
      }
    } catch {
      showToast('DNS check failed', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [fetchAll, showToast]);

  const outdatedCount = useMemo(() => versions.filter((v) => v.status === 'outdated').length, [versions]);
  const runningContainers = useMemo(() => containers.filter((c) => c.status === 'running').length, [containers]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading system data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-2xl transition-all ${toast.kind === 'success' ? 'border border-green-500/30 bg-green-900/40 text-green-300' : 'border border-red-500/30 bg-red-900/40 text-red-300'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">System Management</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Servers, containers, backups, DNS/SSL, and version tracking
        </p>
      </div>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{resources.cpu.usage.toFixed(0)}%</p>
          <p className="text-[10px] text-[var(--color-muted)]">CPU Usage</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${resources.memory.usagePercent > 80 ? 'border-red-500/20 bg-red-500/5' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}>
          <p className="text-lg font-bold text-[var(--color-fg)]">{resources.memory.usagePercent.toFixed(0)}%</p>
          <p className="text-[10px] text-[var(--color-muted)]">RAM Usage</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${resources.disk.usagePercent > 80 ? 'border-yellow-500/20 bg-yellow-500/5' : 'border-[var(--color-border)] bg-[var(--color-card)]'}`}>
          <p className="text-lg font-bold text-[var(--color-fg)]">{resources.disk.usagePercent.toFixed(0)}%</p>
          <p className="text-[10px] text-[var(--color-muted)]">Disk Usage</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <p className="text-lg font-bold text-[var(--color-fg)]">{runningContainers}/{containers.length}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Containers</p>
        </div>
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
          <p className="text-lg font-bold text-yellow-400">{outdatedCount}</p>
          <p className="text-[10px] text-[var(--color-muted)]">Outdated Services</p>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-2">
        {([
          { key: 'resources', label: '🖥️ Resources', count: null },
          { key: 'docker', label: '🐳 Docker', count: null },
          { key: 'backups', label: '💾 Backups', count: null },
          { key: 'dns', label: '🌐 DNS/SSL', count: null },
          { key: 'versions', label: '📦 Versions', count: outdatedCount },
          { key: 'logs', label: '📋 Logs', count: null },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-degen-500/15 text-degen-400 border-b-2 border-degen-500'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] text-yellow-400">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════ RESOURCES TAB ═══════════════════ */}
      {activeTab === 'resources' && (
        <div>
          {/* CPU, RAM, Disk cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <ResourceCard label="CPU" usage={resources.cpu.usage} detail={`${resources.cpu.cores} cores · ${resources.cpu.model}`} color={resources.cpu.usage > 80 ? 'red' : resources.cpu.usage > 60 ? 'yellow' : 'green'} />
            <ResourceCard label="RAM" usage={resources.memory.usagePercent} detail={`${formatGB(resources.memory.used)} / ${formatGB(resources.memory.total)}`} color={resources.memory.usagePercent > 80 ? 'red' : resources.memory.usagePercent > 60 ? 'yellow' : 'green'} />
            <ResourceCard label="Disk" usage={resources.disk.usagePercent} detail={`${resources.disk.used} GB / ${resources.disk.total} GB (${resources.disk.mount})`} color={resources.disk.usagePercent > 80 ? 'red' : resources.disk.usagePercent > 60 ? 'yellow' : 'green'} />
          </div>
          {/* Network & System Info */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBadge label="Network RX" value={formatBytes(resources.network.rxBytes)} />
            <InfoBadge label="Network TX" value={formatBytes(resources.network.txBytes)} />
            <InfoBadge label="Connections" value={String(resources.network.connections)} />
            <InfoBadge label="Uptime" value={formatDuration(resources.network.uptime)} />
            <InfoBadge label="Load (1m)" value={String(resources.loadAverage[0])} />
            <InfoBadge label="Load (5m)" value={String(resources.loadAverage[1])} />
            <InfoBadge label="Load (15m)" value={String(resources.loadAverage[2])} />
            <InfoBadge label="Temperature" value={resources.cpu.temperature ? `${resources.cpu.temperature}°C` : 'N/A'} />
          </div>
        </div>
      )}

      {/* ═══════════════════ DOCKER TAB ═══════════════════ */}
      {activeTab === 'docker' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-[var(--color-muted)]">{containers.length} containers · {runningContainers} running</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Name</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Image</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Ports</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">CPU</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Memory</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Uptime</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Status</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {containers.map((ct) => (
                  <tr key={ct.id} className="bg-[var(--color-card)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{ct.name}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted)]">{ct.image}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">{ct.ports || '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{ct.cpu ? `${ct.cpu}%` : '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{ct.memory ? `${ct.memory} MB` : '—'}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{ct.uptime ? formatDuration(ct.uptime) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        ct.status === 'running' ? 'bg-green-500/15 text-green-400'
                          : ct.status === 'restarting' ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-red-500/15 text-red-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ct.status === 'running' ? 'bg-green-500' : ct.status === 'restarting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                        {ct.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleContainerAction(ct.id, 'restart')}
                          disabled={actionLoading === `${ct.id}-restart`}
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
                        >
                          {actionLoading === `${ct.id}-restart` ? '…' : '↻'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedContainer(ct); }}
                          className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
                        >
                          📋
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Container Logs Modal */}
          {selectedContainer && (
            <section
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={() => setSelectedContainer(null)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSelectedContainer(null); }}
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="none">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[var(--color-fg)]">📋 {selectedContainer.name}</h2>
                  <button type="button" onClick={() => setSelectedContainer(null)} className="rounded-lg p-1.5 text-[var(--color-muted)] hover:bg-[var(--color-muted)]">✕</button>
                </div>
                <div className="mb-4 rounded-xl bg-black/80 p-4 font-mono text-[10px] text-green-400 max-h-60 overflow-y-auto">
                  <p>[2026-07-24 14:23:01] INFO: Container started</p>
                  <p>[2026-07-24 14:23:02] INFO: Health check passed</p>
                  <p>[2026-07-24 14:23:05] WARN: Memory usage at 72%</p>
                  <p>[2026-07-24 14:23:10] INFO: Connection pool established (12/12)</p>
                  <p>[2026-07-24 14:24:01] INFO: Processing 5 queued jobs…</p>
                  <p className="text-yellow-400">[2026-07-24 14:25:00] WARN: Retry attempt 2/3 for task #4821</p>
                  <p>[2026-07-24 14:26:00] INFO: Task #4821 completed successfully</p>
                  <p className="animate-pulse">_</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleContainerAction(selectedContainer.id, 'restart')}
                    className="flex-1 rounded-xl border border-yellow-500/30 px-4 py-2 text-xs text-yellow-400 transition-colors hover:bg-yellow-500/10"
                  >
                    ↻ Restart
                  </button>
                  <button
                    type="button"
                    onClick={() => showToast('Downloading logs…')}
                    className="flex-1 rounded-xl border border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
                  >
                    Download
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ═══════════════════ BACKUPS TAB ═══════════════════ */}
      {activeTab === 'backups' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-muted)]">Last full backup: {formatDate(DEFAULT_BACKUPS[0]?.startedAt ?? Date.now())}</p>
            <div className="flex gap-2">
              {(['full', 'database', 'config'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleBackupTrigger(type)}
                  disabled={actionLoading === `backup-${type}`}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
                >
                  {actionLoading === `backup-${type}` ? '…' : `+ ${type} backup`}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {backups.map((b) => (
              <div key={b.id} className={`flex items-center justify-between rounded-xl border bg-[var(--color-card)] px-5 py-4 ${b.status === 'running' ? 'border-degen-500/30' : 'border-[var(--color-border)]'}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${b.status === 'running' ? 'animate-pulse text-degen-400' : b.status === 'failed' ? 'text-red-400' : 'text-[var(--color-fg)]'}`}>
                      {b.type === 'full' ? '📦' : b.type === 'database' ? '🗄️' : b.type === 'config' ? '⚙️' : '📁'}
                    </span>
                    <p className="text-sm font-medium text-[var(--color-fg)]">{b.name}</p>
                    <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)]">{b.type}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      b.status === 'completed' ? 'bg-green-500/15 text-green-400'
                        : b.status === 'running' ? 'bg-degen-500/15 text-degen-400'
                          : b.status === 'failed' ? 'bg-red-500/15 text-red-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                      {b.status === 'running' ? '⏳' : b.status === 'completed' ? '✓' : b.status === 'failed' ? '✕' : '⏸'} {b.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-[10px] text-[var(--color-muted)]">
                    <span>{b.size}</span>
                    <span>→ {b.target}</span>
                    <span>{b.location}</span>
                    <span>{formatDate(b.startedAt)}</span>
                  </div>
                </div>
                {b.status === 'failed' && (
                  <button type="button" onClick={() => handleBackupTrigger(b.type)} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)]">Retry</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════ DNS/SSL TAB ═══════════════════ */}
      {activeTab === 'dns' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-[var(--color-muted)]">Check DNS resolution and SSL certificate validity</p>
            <button
              type="button"
              onClick={handleCheckDns}
              disabled={actionLoading === 'dns-check'}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-40"
            >
              {actionLoading === 'dns-check' ? 'Checking…' : '↻ Check All'}
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Domain</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">DNS</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">SSL</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Expiry</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Issuer</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {dnsEntries.map((entry) => (
                  <tr key={entry.domain} className="bg-[var(--color-card)]">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-[var(--color-fg)]">{entry.domain}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        entry.dnsStatus === 'resolved' ? 'bg-green-500/15 text-green-400'
                          : entry.dnsStatus === 'unresolved' ? 'bg-red-500/15 text-red-400'
                            : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {entry.dnsStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        entry.sslStatus === 'valid' ? 'bg-green-500/15 text-green-400'
                          : entry.sslStatus === 'expiring' ? 'bg-yellow-500/15 text-yellow-400'
                            : entry.sslStatus === 'expired' ? 'bg-red-500/15 text-red-400'
                              : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                      }`}>
                        {entry.sslStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">
                      {entry.sslExpiry ? `${Math.floor((entry.sslExpiry - Date.now()) / 86400000)}d` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)]">{entry.issuer || '—'}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted)]">{entry.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════ VERSIONS TAB ═══════════════════ */}
      {activeTab === 'versions' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs text-[var(--color-muted)]">{versions.length} tracked services</p>
            <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] text-yellow-400">{outdatedCount} outdated</span>
            <button
              type="button"
              onClick={() => showToast('Version check initiated')}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
            >
              ↻ Check Updates
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Service</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Category</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Version</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Latest</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {versions.map((svc) => (
                  <tr key={svc.name} className="bg-[var(--color-card)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{svc.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-[var(--color-muted)] capitalize">{svc.category}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg)]">{svc.version}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted)]">{svc.latestVersion || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        svc.status === 'up_to_date' ? 'bg-green-500/15 text-green-400'
                          : svc.status === 'outdated' ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                      }`}>
                        {svc.status === 'up_to_date' ? '✓' : '⚠'} {svc.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════ LOGS TAB ═══════════════════ */}
      {activeTab === 'logs' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-[var(--color-muted)]">Recent system logs</p>
            <button
              type="button"
              onClick={() => showToast('Logs refreshed')}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
            >
              ↻ Refresh
            </button>
          </div>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
                <span className={`mt-0.5 text-xs ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-degen-400'}`}>
                  {log.level === 'error' ? '✕' : log.level === 'warn' ? '⚠' : 'ℹ'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] font-mono text-[var(--color-muted)]">{log.service}</span>
                    <span className="text-[10px] text-[var(--color-muted)]">{formatTime(log.timestamp)}</span>
                  </div>
                  <p className="text-xs text-[var(--color-fg)] mt-1">{log.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// === Sub-components ===================================================

function ResourceCard({ label, usage, detail, color }: { label: string; usage: number; detail: string; color: 'green' | 'yellow' | 'red' }) {
  const colorMap = { green: { bar: 'bg-degen-500', text: 'text-degen-400' }, yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400' }, red: { bar: 'bg-red-500', text: 'text-red-400' } };
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{label}</h3>
        <span className={`text-lg font-bold ${colorMap[color].text}`}>{usage.toFixed(1)}%</span>
      </div>
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div className={`h-full rounded-full transition-all duration-700 ${colorMap[color].bar}`} style={{ width: `${Math.min(usage, 100)}%` }} />
      </div>
      <p className="text-xs text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">{label}</p>
      <p className="text-xs font-medium text-[var(--color-fg)] truncate">{value}</p>
    </div>
  );
}
