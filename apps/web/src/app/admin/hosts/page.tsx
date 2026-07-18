'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  provider: string;
  location: string;
  cpu: { model: string; cores: number; usage: number; temperature?: number };
  memory: { total: number; used: number; usagePercent: number };
  disk: { total: number; used: number; usagePercent: number };
  network: { rxBytes: number; txBytes: number; uptime: number };
  services: {
    name: string;
    status: 'running' | 'stopped' | 'error';
    port?: number;
    cpu?: number;
    memory?: number;
  }[];
  containers: {
    name: string;
    image: string;
    status: 'running' | 'stopped' | 'restarting';
    ports?: string;
    uptime?: number;
    cpu?: number;
    memory?: number;
  }[];
  lastSeen: number;
  os: string;
  kernel: string;
}

interface HostsResponse {
  servers: ServerInfo[];
}

// ─── Default data ─────────────────────────────────────────────────────

const DEFAULT_SERVERS: ServerInfo[] = [
  {
    id: 'talos',
    name: 'Talos',
    hostname: 'talos.netcup.de',
    ip: '185.10.68.42',
    provider: 'Netcup',
    location: 'Nuremberg, DE',
    cpu: { model: 'AMD EPYC 7443P', cores: 8, usage: 34.2, temperature: 52 },
    memory: { total: 32768, used: 18432, usagePercent: 56.2 },
    disk: { total: 512, used: 283, usagePercent: 55.3 },
    network: { rxBytes: 1_450_000_000_000, txBytes: 820_000_000_000, uptime: 342720 },
    services: [
      { name: 'Ollama', status: 'running', port: 11434, cpu: 8.2, memory: 4096 },
      { name: 'FlareSolverr', status: 'running', port: 8191, cpu: 2.1, memory: 512 },
      { name: 'Mastodon Fetcher', status: 'running', port: 3003, cpu: 12.4, memory: 1024 },
      { name: 'Redis', status: 'running', port: 6379, cpu: 0.8, memory: 64 },
      { name: 'PostgreSQL', status: 'running', port: 5432, cpu: 3.5, memory: 2048 },
    ],
    containers: [
      {
        name: 'degenfeed-api',
        image: 'degenfeed/api:latest',
        status: 'running',
        ports: '3000',
        cpu: 5.2,
        memory: 256,
      },
      {
        name: 'feed-worker',
        image: 'degenfeed/worker:latest',
        status: 'running',
        cpu: 18.3,
        memory: 512,
      },
      {
        name: 'tip-indexer',
        image: 'degenfeed/tip-indexer:latest',
        status: 'running',
        cpu: 1.4,
        memory: 128,
      },
      {
        name: 'postgres-15',
        image: 'postgres:15-alpine',
        status: 'running',
        cpu: 2.8,
        memory: 1024,
      },
      {
        name: 'redis-stack',
        image: 'redis/redis-stack:latest',
        status: 'running',
        cpu: 0.6,
        memory: 64,
      },
    ],
    lastSeen: Date.now(),
    os: 'Ubuntu 24.04 LTS',
    kernel: '6.8.0-31-generic',
  },
  {
    id: 'hydra',
    name: 'Hydra',
    hostname: 'hydra.contabo.de',
    ip: '185.10.68.84',
    provider: 'Contabo',
    location: 'Munich, DE',
    cpu: { model: 'Intel Xeon Platinum 8358P', cores: 6, usage: 28.7, temperature: 48 },
    memory: { total: 24576, used: 15872, usagePercent: 64.6 },
    disk: { total: 400, used: 247, usagePercent: 61.8 },
    network: { rxBytes: 890_000_000_000, txBytes: 540_000_000_000, uptime: 421380 },
    services: [
      { name: 'SearXNG', status: 'running', port: 8089, cpu: 3.8, memory: 256 },
      { name: 'n8n', status: 'running', port: 5678, cpu: 6.2, memory: 768 },
      { name: 'Ollama', status: 'running', port: 11434, cpu: 4.5, memory: 2048 },
      { name: 'Nginx', status: 'running', port: 80, cpu: 0.5, memory: 32 },
      { name: 'Prometheus', status: 'running', port: 9090, cpu: 1.8, memory: 384 },
    ],
    containers: [
      {
        name: 'searxng',
        image: 'searxng/searxng:latest',
        status: 'running',
        ports: '8089',
        cpu: 3.1,
        memory: 192,
      },
      {
        name: 'n8n-workflow',
        image: 'n8nio/n8n:latest',
        status: 'running',
        ports: '5678',
        cpu: 5.4,
        memory: 512,
      },
      {
        name: 'grafana',
        image: 'grafana/grafana:latest',
        status: 'running',
        ports: '3000',
        cpu: 2.2,
        memory: 256,
      },
      {
        name: 'prometheus',
        image: 'prom/prometheus:latest',
        status: 'running',
        ports: '9090',
        cpu: 1.5,
        memory: 384,
      },
      {
        name: 'node-exporter',
        image: 'prom/node-exporter:latest',
        status: 'running',
        cpu: 0.3,
        memory: 16,
      },
    ],
    lastSeen: Date.now(),
    os: 'Ubuntu 24.04 LTS',
    kernel: '6.8.0-31-generic',
  },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000_000) return `${(bytes / 1_000_000_000_000).toFixed(1)} TB`;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1000).toFixed(0)} KB`;
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatGB(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

// ─── Component ────────────────────────────────────────────────────────

export default function AdminHostsPage() {
  const [servers, setServers] = useState<ServerInfo[]>(DEFAULT_SERVERS);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchHosts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/hosts', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as HostsResponse;
        if (data.servers?.length) setServers(data.servers);
      }
    } catch {
      // use defaults
    }
  }, []);

  useEffect(() => {
    fetchHosts().finally(() => setLoading(false));
  }, [fetchHosts]);

  const handleRestartService = useCallback(
    async (serverId: string, serviceName: string) => {
      try {
        const res = await fetch(`/api/admin/hosts/${serverId}/services/${serviceName}/restart`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          showToast(`Restarting ${serviceName} on ${serverId}…`);
        } else {
          showToast(`Failed to restart ${serviceName}`, 'error');
        }
      } catch {
        showToast('Network error restarting service', 'error');
      }
    },
    [showToast],
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--color-muted)]">Loading host information…</p>
        </div>
      </div>
    );
  }

  const defaultServer = servers[0];
  const activeServer = servers.find((s) => s.id === selectedServer) || defaultServer;
  if (!activeServer) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 text-center">
        <p className="text-sm text-[var(--color-muted)]">No server data available.</p>
      </div>
    );
  }

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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Hosts & Infrastructure</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Server health, resource usage, and service management
        </p>
      </div>

      {/* Server tabs */}
      <div className="mb-6 flex gap-3">
        {servers.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedServer(s.id)}
            className={`rounded-xl px-5 py-3 text-left transition-colors ${
              activeServer.id === s.id
                ? 'border border-degen-500/30 bg-degen-500/10'
                : 'border border-[var(--color-border)] bg-[var(--color-card)] hover:border-[var(--color-border)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)] ${s.containers.every((c) => c.status === 'running') ? 'bg-green-500' : 'bg-yellow-500'}`}
              />
              <span className="text-sm font-semibold text-[var(--color-fg)]">{s.name}</span>
            </div>
            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">{s.hostname}</p>
          </button>
        ))}
      </div>

      {/* Server detail */}
      {activeServer && (
        <div className="space-y-6">
          {/* CPU, RAM, Disk cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <ResourceCard
              label="CPU"
              usage={activeServer.cpu.usage}
              detail={`${activeServer.cpu.cores} cores · ${activeServer.cpu.model}`}
              color={
                activeServer.cpu.usage > 80
                  ? 'red'
                  : activeServer.cpu.usage > 60
                    ? 'yellow'
                    : 'green'
              }
            />
            <ResourceCard
              label="RAM"
              usage={activeServer.memory.usagePercent}
              detail={`${formatGB(activeServer.memory.used)} / ${formatGB(activeServer.memory.total)}`}
              color={
                activeServer.memory.usagePercent > 80
                  ? 'red'
                  : activeServer.memory.usagePercent > 60
                    ? 'yellow'
                    : 'green'
              }
            />
            <ResourceCard
              label="Disk"
              usage={activeServer.disk.usagePercent}
              detail={`${activeServer.disk.used} GB / ${activeServer.disk.total} GB`}
              color={
                activeServer.disk.usagePercent > 80
                  ? 'red'
                  : activeServer.disk.usagePercent > 60
                    ? 'yellow'
                    : 'green'
              }
            />
          </div>

          {/* System info */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBadge label="OS" value={activeServer.os} />
            <InfoBadge label="Kernel" value={activeServer.kernel} />
            <InfoBadge label="Location" value={activeServer.location} />
            <InfoBadge label="Uptime" value={formatDuration(activeServer.network.uptime)} />
            <InfoBadge label="Network RX" value={formatBytes(activeServer.network.rxBytes)} />
            <InfoBadge label="Network TX" value={formatBytes(activeServer.network.txBytes)} />
            <InfoBadge
              label="Temperature"
              value={activeServer.cpu.temperature ? `${activeServer.cpu.temperature}°C` : 'N/A'}
            />
            <InfoBadge label="IP" value={activeServer.ip} />
          </div>

          {/* Services */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Services</h2>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Service
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Port
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      CPU
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Memory
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {activeServer.services.map((svc) => (
                    <tr key={svc.name} className="bg-[var(--color-card)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{svc.name}</td>
                      <td className="px-4 py-3 text-[var(--color-muted)] font-mono text-xs">
                        {svc.port || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {svc.cpu != null ? `${svc.cpu}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {svc.memory ? formatGB(svc.memory) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            svc.status === 'running'
                              ? 'bg-green-500/15 text-green-400'
                              : svc.status === 'error'
                                ? 'bg-red-500/15 text-red-400'
                                : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              svc.status === 'running'
                                ? 'bg-green-500'
                                : svc.status === 'error'
                                  ? 'bg-red-500'
                                  : 'bg-[var(--color-muted)]'
                            }`}
                          />
                          {svc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleRestartService(activeServer.id, svc.name)}
                          className="rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-muted)]"
                        >
                          ↻ Restart
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Containers */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-[var(--color-fg)]">Containers</h2>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <tr>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Name
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Image
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Ports
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      CPU
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Memory
                    </th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {activeServer.containers.map((ct) => (
                    <tr key={ct.name} className="bg-[var(--color-card)]">
                      <td className="px-4 py-3 font-medium text-[var(--color-fg)]">{ct.name}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[var(--color-muted)]">
                        {ct.image}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)] font-mono text-xs">
                        {ct.ports || '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {ct.cpu != null ? `${ct.cpu}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">
                        {ct.memory ? `${ct.memory} MB` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            ct.status === 'running'
                              ? 'bg-green-500/15 text-green-400'
                              : ct.status === 'restarting'
                                ? 'bg-yellow-500/15 text-yellow-400'
                                : 'bg-[var(--color-overlay)] text-[var(--color-muted)]'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              ct.status === 'running'
                                ? 'bg-green-500'
                                : ct.status === 'restarting'
                                  ? 'bg-yellow-500'
                                  : 'bg-[var(--color-muted)]'
                            }`}
                          />
                          {ct.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-900/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function ResourceCard({
  label,
  usage,
  detail,
  color,
}: {
  label: string;
  usage: number;
  detail: string;
  color: 'green' | 'yellow' | 'red';
}) {
  const colorMap = {
    green: { bar: 'bg-degen-500', text: 'text-degen-400' },
    yellow: { bar: 'bg-yellow-500', text: 'text-yellow-400' },
    red: { bar: 'bg-red-500', text: 'text-red-400' },
  };
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-fg)]">{label}</h3>
        <span className={`text-lg font-bold ${colorMap[color].text}`}>{usage.toFixed(1)}%</span>
      </div>
      <div className="mb-2 h-3 overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorMap[color].bar}`}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-muted)]">{detail}</p>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </p>
      <p className="text-xs font-medium text-[var(--color-fg)] truncate">{value}</p>
    </div>
  );
}
