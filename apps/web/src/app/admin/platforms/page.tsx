'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface PlatformStatus {
  id: string;
  name: string;
  icon: string;
  status: 'online' | 'degraded' | 'offline';
  postsToday: number;
  activeUsers24h: number;
  errorRate: number;
  avgLatency: number;
  lastFetch: number;
  lastError?: string;
  config: Record<string, string | number | boolean>;
  version: string;
}

interface ConfigSetting {
  key: string;
  label: string;
  value: string | number | boolean;
  type: 'toggle' | 'number' | 'text' | 'select';
  options?: string[];
  description: string;
}

// ─── Default data ─────────────────────────────────────────────────────

const DEFAULT_PLATFORMS: PlatformStatus[] = [
  {
    id: 'nostr', name: 'Nostr', icon: '⚡',
    status: 'online', postsToday: 312, activeUsers24h: 187,
    errorRate: 0.8, avgLatency: 180, lastFetch: Date.now() - 12000,
    version: 'v2.4.1', config: { relays: 'wss://relay.damus.io', enabled: true, batchSize: 50 },
  },
  {
    id: 'farcaster', name: 'Farcaster', icon: '🟣',
    status: 'online', postsToday: 204, activeUsers24h: 142,
    errorRate: 0.3, avgLatency: 220, lastFetch: Date.now() - 8000,
    version: 'v1.8.3', config: { hubUrl: 'https://hub.farcaster.xyz', enabled: true },
  },
  {
    id: 'lens', name: 'Lens', icon: '🌿',
    status: 'online', postsToday: 98, activeUsers24h: 65,
    errorRate: 1.2, avgLatency: 350, lastFetch: Date.now() - 30000,
    version: 'v1.3.0', config: { apiEndpoint: 'https://api.lens.dev', enabled: true, pollInterval: 60 },
  },
  {
    id: 'bluesky', name: 'Bluesky', icon: '🦋',
    status: 'online', postsToday: 156, activeUsers24h: 98,
    errorRate: 0.5, avgLatency: 195, lastFetch: Date.now() - 15000,
    version: 'v1.1.2', config: { pdsUrl: 'https://bsky.social', enabled: true },
  },
  {
    id: 'mastodon', name: 'Mastodon', icon: '🐘',
    status: 'degraded', postsToday: 72, activeUsers24h: 41,
    errorRate: 4.7, avgLatency: 2300, lastFetch: Date.now() - 120000,
    lastError: 'Rate limit hit — 429 Too Many Requests',
    version: 'v1.0.5', config: { instances: 'mastodon.social,mas.to', enabled: true, rateLimitDelay: 2000 },
  },
  {
    id: 'threads', name: 'Threads', icon: '🧵',
    status: 'online', postsToday: 44, activeUsers24h: 28,
    errorRate: 2.1, avgLatency: 410, lastFetch: Date.now() - 45000,
    version: 'v0.9.0', config: { enabled: true, scrapeInterval: 120 },
  },
  {
    id: 'reddit', name: 'Reddit', icon: '🔴',
    status: 'online', postsToday: 89, activeUsers24h: 53,
    errorRate: 0.6, avgLatency: 260, lastFetch: Date.now() - 20000,
    version: 'v2.0.1', config: { clientId: '****', userAgent: 'DegenFeed/2.0', enabled: true },
  },
  {
    id: 'rss', name: 'RSS Feeds', icon: '📡',
    status: 'online', postsToday: 210, activeUsers24h: 0,
    errorRate: 3.4, avgLatency: 1500, lastFetch: Date.now() - 60000,
    version: 'v1.5.0', config: { maxFeeds: 500, pollInterval: 900, enabled: true },
  },
];

const DEFAULT_CONFIGS: Record<string, ConfigSetting[]> = {
  general: [
    { key: 'max_post_age_hours', label: 'Max Post Age', value: 72, type: 'number', description: 'Hours before posts expire from the feed' },
    { key: 'posts_per_page', label: 'Posts Per Page', value: 25, type: 'number', description: 'Default pagination size' },
    { key: 'enable_tips', label: 'Tips Enabled', value: true, type: 'toggle', description: 'Allow tipping content creators' },
    { key: 'require_wallet', label: 'Require Wallet', value: false, type: 'toggle', description: 'Force wallet connection to view content' },
    { key: 'default_feed_mode', label: 'Default Feed', value: 'trending', type: 'select', options: ['trending', 'latest', 'top'], description: 'Default feed sorting' },
    { key: 'cache_ttl_seconds', label: 'Cache TTL', value: 300, type: 'number', description: 'Content cache time-to-live in seconds' },
  ],
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString();
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ────────────────────────────────────────────────────────

export default function AdminPlatformsPage() {
  const [platforms, setPlatforms] = useState<PlatformStatus[]>(DEFAULT_PLATFORMS);
  const [configs] = useState<Record<string, ConfigSetting[]>>(DEFAULT_CONFIGS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'config'>('status');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchPlatforms = useCallback(async () => {
    try {
      const res = await fetch('/api/health/protocols', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { protocols: PlatformStatus[] };
        if (data.protocols?.length) setPlatforms(data.protocols);
      }
    } catch {
      // use defaults
    }
  }, []);

  useEffect(() => {
    fetchPlatforms().finally(() => setLoading(false));
  }, [fetchPlatforms]);

  const handleTogglePlatform = useCallback(async (platformId: string, enabled: boolean) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId ? { ...p, config: { ...p.config, enabled } } : p,
      ),
    );
    try {
      const res = await fetch(`/api/admin/platforms/${platformId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        showToast(`${platformId} ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        showToast(`Failed to toggle ${platformId}`, 'error');
        setPlatforms((prev) =>
          prev.map((p) =>
            p.id === platformId ? { ...p, config: { ...p.config, enabled: !enabled } } : p,
          ),
        );
      }
    } catch {
      showToast('Network error', 'error');
    }
  }, [showToast]);

  const handleSaveConfig = useCallback(async (key: string) => {
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value: editValue }),
      });
      if (res.ok) {
        showToast(`Config ${key} updated`);
        setEditingKey(null);
      } else {
        showToast('Failed to update config', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    }
  }, [editValue, showToast]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading platform data…</p>
        </div>
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Platforms</h1>
        <p className="mt-1 text-sm text-gray-500">
          Protocol health, activity metrics, and connector configuration
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(['status', 'config'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-gray-400 hover:bg-[var(--color-muted)]'
            }`}
          >
            {tab === 'status' ? '📊 Status' : '⚙️ Config'}
          </button>
        ))}
      </div>

      {activeTab === 'status' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className={`rounded-xl border bg-[var(--color-card)] p-4 transition-colors hover:border-gray-600 ${
                platform.status === 'offline'
                  ? 'border-red-500/20 opacity-60'
                  : platform.status === 'degraded'
                    ? 'border-yellow-500/20'
                    : 'border-[var(--color-border)]'
              }`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{platform.icon}</span>
                  <span className="text-sm font-semibold text-[var(--color-fg)]">{platform.name}</span>
                </div>
                <div className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  platform.status === 'online'
                    ? 'bg-green-500/15 text-green-400'
                    : platform.status === 'degraded'
                      ? 'bg-yellow-500/15 text-yellow-400'
                      : 'bg-red-500/15 text-red-400'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${
                    platform.status === 'online' ? 'bg-green-500' : platform.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  {platform.status}
                </div>
              </div>

              <div className="mb-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Posts today</span>
                  <span className="font-medium text-[var(--color-fg)]">{formatCount(platform.postsToday)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Active users</span>
                  <span className="font-medium text-[var(--color-fg)]">{formatCount(platform.activeUsers24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Error rate</span>
                  <span className={`font-medium ${platform.errorRate > 3 ? 'text-red-400' : 'text-[var(--color-fg)]'}`}>
                    {platform.errorRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Latency</span>
                  <span className={`font-medium ${platform.avgLatency > 500 ? 'text-yellow-400' : 'text-[var(--color-fg)]'}`}>
                    {platform.avgLatency}ms
                  </span>
                </div>
              </div>

              {platform.lastError && (
                <div className="mb-3 rounded-lg bg-red-500/10 px-3 py-2 text-[10px] text-red-400">
                  {platform.lastError}
                </div>
              )}

              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <span className="text-[10px] text-gray-600">
                  {formatTime(platform.lastFetch)}
                </span>
                <label className="flex cursor-pointer items-center gap-2" aria-label={`Toggle ${platform.name}`}>
                  <span className="text-[10px] text-gray-500">{platform.version}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(platform.config.enabled)}
                    onClick={() => handleTogglePlatform(platform.id, !platform.config.enabled)}
                    className={`toggle-track ${(platform.config.enabled) ? '' : 'opacity-50'}`}
                    data-checked={Boolean(platform.config.enabled)}
                  >
                    <span className="toggle-thumb" />
                  </button>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'config' && (
        <div>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-[var(--color-fg)]">Global Configuration</h2>
            <p className="mt-0.5 text-xs text-gray-500">Platform-wide settings and feature flags</p>
          </div>
          <div className="space-y-3">
            {(configs.general || []).map((setting) => (
              <div
                key={setting.key}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-fg)]">{setting.label}</p>
                  <p className="text-xs text-gray-500">{setting.description}</p>
                </div>
                <div className="ml-4 shrink-0">
                  {setting.type === 'toggle' ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={Boolean(setting.value)}
                      className="toggle-track"
                      data-checked={Boolean(setting.value)}
                      onClick={() => {
                        showToast(`${setting.label} toggled (demo)`);
                      }}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  ) : editingKey === setting.key ? (
                    <div className="flex items-center gap-2">
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] focus:border-degen-500 focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveConfig(setting.key);
                          if (e.key === 'Escape') setEditingKey(null);
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveConfig(setting.key)}
                        className="rounded-lg bg-degen-500/20 px-2.5 py-1.5 text-xs font-medium text-degen-400"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        className="rounded-lg px-2.5 py-1.5 text-xs text-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey(setting.key);
                        setEditValue(String(setting.value));
                      }}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-[var(--color-muted)]"
                    >
                      {String(setting.value)}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
