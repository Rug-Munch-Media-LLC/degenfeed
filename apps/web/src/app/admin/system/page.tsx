'use client';

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  category: 'content' | 'social' | 'performance' | 'experimental' | 'infrastructure';
}

interface RateLimit {
  endpoint: string;
  limit: number;
  window: string;
  current: number;
  status: 'ok' | 'near_limit' | 'exceeded';
}

interface SystemConfig {
  maintenanceMode: boolean;
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  defaultFeedType: string;
  cacheEnabled: boolean;
  logLevel: string;
  maxUploadSize: number;
  apiVersion: string;
  buildVersion: string;
  environment: string;
}

// ─── Default data ─────────────────────────────────────────────────────

const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: 'cross_protocol_posting', label: 'Cross-Protocol Posting', description: 'Allow posting to multiple protocols simultaneously', enabled: true, category: 'content' },
  { key: 'tip_system', label: 'Tip System', description: 'Enable crypto tipping on content', enabled: true, category: 'social' },
  { key: 'community_creation', label: 'Community Creation', description: 'Allow users to create communities', enabled: true, category: 'social' },
  { key: 'short_videos', label: 'Short Videos', description: 'Enable the shorts/tik-tok style video feed', enabled: true, category: 'content' },
  { key: 'spaces_live_audio', label: 'Spaces Live Audio', description: 'Live audio rooms feature', enabled: true, category: 'social' },
  { key: 'trending_algorithms_v2', label: 'Trending Algorithms V2', description: 'New ML-based trending algorithm', enabled: false, category: 'experimental' },
  { key: 'content_moderation_ai', label: 'AI Content Moderation', description: 'Auto-flag content using AI classifiers', enabled: true, category: 'content' },
  { key: 'feed_caching', label: 'Feed Caching', description: 'Cache aggregated feeds for faster loading', enabled: true, category: 'performance' },
  { key: 'real_time_updates', label: 'Real-Time Updates', description: 'WebSocket-based real-time feed updates', enabled: true, category: 'performance' },
  { key: 'analytics_tracking', label: 'Analytics Tracking', description: 'Collect usage analytics (privacy-first)', enabled: true, category: 'infrastructure' },
  { key: 'recommendation_engine', label: 'Recommendation Engine', description: 'Personalized content recommendations', enabled: false, category: 'experimental' },
  { key: 'nft_integration', label: 'NFT Integration', description: 'NFT display and verification on profiles', enabled: false, category: 'experimental' },
  { key: 'pwa_offline_mode', label: 'PWA Offline Mode', description: 'Offline reading with service worker cache', enabled: true, category: 'performance' },
  { key: 'email_notifications', label: 'Email Notifications', description: 'Send email digests and alerts', enabled: false, category: 'infrastructure' },
  { key: 'federation_outgoing', label: 'Outgoing Federation', description: 'Push content to external protocols', enabled: true, category: 'content' },
];

const DEFAULT_RATE_LIMITS: RateLimit[] = [
  { endpoint: '/api/feed/*', limit: 100, window: '1 min', current: 42, status: 'ok' },
  { endpoint: '/api/publish', limit: 10, window: '1 min', current: 3, status: 'ok' },
  { endpoint: '/api/auth/*', limit: 20, window: '1 min', current: 18, status: 'near_limit' },
  { endpoint: '/api/search', limit: 30, window: '1 min', current: 5, status: 'ok' },
  { endpoint: '/api/moderation/*', limit: 50, window: '1 min', current: 2, status: 'ok' },
  { endpoint: '/api/tips', limit: 15, window: '1 min', current: 7, status: 'ok' },
];

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  maintenanceMode: false,
  allowNewRegistrations: true,
  requireEmailVerification: false,
  defaultFeedType: 'trending',
  cacheEnabled: true,
  logLevel: 'info',
  maxUploadSize: 10,
  apiVersion: 'v2.1.0',
  buildVersion: '2026.07.18-0842',
  environment: process.env.NODE_ENV || 'production',
};

// ─── Component ────────────────────────────────────────────────────────

export default function AdminSystemPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>(DEFAULT_RATE_LIMITS);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_SYSTEM_CONFIG);
  const [activeTab, setActiveTab] = useState<'flags' | 'limits' | 'config'>('flags');
  const [loading, setLoading] = useState(true);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchSystem = useCallback(async () => {
    try {
      const [flagsRes, limitsRes, configRes] = await Promise.all([
        fetch('/api/admin/flags', { credentials: 'include' }),
        fetch('/api/admin/rate-limits', { credentials: 'include' }),
        fetch('/api/admin/config', { credentials: 'include' }),
      ]);
      if (flagsRes.ok) {
        const d = await flagsRes.json() as { flags: FeatureFlag[] };
        if (d.flags) setFlags(d.flags);
      }
      if (limitsRes.ok) {
        const d = await limitsRes.json() as { limits: RateLimit[] };
        if (d.limits) setRateLimits(d.limits);
      }
      if (configRes.ok) {
        const d = await configRes.json() as SystemConfig;
        if (d.apiVersion) setConfig(d);
      }
    } catch {
      // use defaults
    }
  }, []);

  useEffect(() => {
    fetchSystem().finally(() => setLoading(false));
  }, [fetchSystem]);

  const handleToggleFlag = useCallback(async (key: string, newValue: boolean) => {
    setTogglingFlag(key);
    // Optimistic update
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: newValue } : f)));
    try {
      const res = await fetch(`/api/admin/flags/${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: newValue }),
      });
      if (res.ok) {
        showToast(`Flag "${key}" ${newValue ? 'enabled' : 'disabled'}`);
      } else {
        // Rollback
        setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !newValue } : f)));
        showToast(`Failed to toggle "${key}"`, 'error');
      }
    } catch {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !newValue } : f)));
      showToast('Network error', 'error');
    } finally {
      setTogglingFlag(null);
    }
  }, [showToast]);

  const handleMaintenanceToggle = useCallback(async () => {
    const newVal = !config.maintenanceMode;
    setConfig((prev) => ({ ...prev, maintenanceMode: newVal }));
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: 'maintenanceMode', value: newVal }),
      });
      if (res.ok) {
        showToast(`Maintenance mode ${newVal ? 'enabled' : 'disabled'}`);
      } else {
        setConfig((prev) => ({ ...prev, maintenanceMode: !newVal }));
        showToast('Failed to toggle maintenance mode', 'error');
      }
    } catch {
      setConfig((prev) => ({ ...prev, maintenanceMode: !newVal }));
      showToast('Network error', 'error');
    }
  }, [config.maintenanceMode, showToast]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-500">Loading system settings…</p>
        </div>
      </div>
    );
  }

  const categories = [...new Set(flags.map((f) => f.category))] as FeatureFlag['category'][];

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
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">System Settings</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
          <span>v{config.apiVersion}</span>
          <span>·</span>
          <span>build {config.buildVersion}</span>
          <span>·</span>
          <span className={config.environment === 'production' ? 'text-degen-400' : 'text-yellow-400'}>
            {config.environment}
          </span>
        </div>
      </div>

      {/* Maintenance mode banner */}
      <div className={`mb-6 rounded-xl border px-5 py-4 ${
        config.maintenanceMode
          ? 'border-yellow-500/30 bg-yellow-900/20'
          : 'border-[var(--color-border)] bg-[var(--color-card)]'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--color-fg)]">
              {config.maintenanceMode ? '⚠️ Maintenance Mode Active' : 'System Operating Normally'}
            </p>
            <p className="text-xs text-gray-500">
              {config.maintenanceMode
                ? 'Users will see a maintenance page. API requests are restricted.'
                : 'All systems operational. Maintenance mode is disabled.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleMaintenanceToggle}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              config.maintenanceMode
                ? 'bg-green-600 text-white hover:bg-green-500'
                : 'bg-yellow-600 text-white hover:bg-yellow-500'
            }`}
          >
            {config.maintenanceMode ? '✓ Disable Maintenance' : '⚠️ Enable Maintenance'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {([
          { key: 'flags', label: '🚩 Feature Flags' },
          { key: 'limits', label: '⏱ Rate Limits' },
          { key: 'config', label: '⚙️ Global Config' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-gray-400 hover:bg-[var(--color-muted)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Feature Flags Tab ── */}
      {activeTab === 'flags' && (
        <div className="space-y-6">
          {categories.map((cat) => (
            <div key={cat}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 capitalize">
                {cat}
              </h3>
              <div className="space-y-2">
                {flags.filter((f) => f.category === cat).map((flag) => (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--color-fg)]">{flag.label}</p>
                        <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-gray-500">
                          {flag.key}
                        </code>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">{flag.description}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flag.enabled}
                      disabled={togglingFlag === flag.key}
                      className={`toggle-track shrink-0 ml-4 ${togglingFlag === flag.key ? 'opacity-50' : ''}`}
                      data-checked={flag.enabled}
                      onClick={() => handleToggleFlag(flag.key, !flag.enabled)}
                    >
                      <span className="toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Rate Limits Tab ── */}
      {activeTab === 'limits' && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm text-gray-500">API rate limits and current utilization</p>
            <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] text-gray-500">
              {rateLimits.filter((r) => r.status === 'near_limit').length} near limit
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Endpoint</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Limit</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Window</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Current</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Usage</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {rateLimits.map((rl) => {
                  const usagePct = (rl.current / rl.limit) * 100;
                  return (
                    <tr key={rl.endpoint} className="bg-[var(--color-card)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg)]">{rl.endpoint}</td>
                      <td className="px-4 py-3 text-gray-400">{rl.limit}</td>
                      <td className="px-4 py-3 text-gray-400">{rl.window}</td>
                      <td className="px-4 py-3 text-gray-400">{rl.current}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-muted)]">
                            <div
                              className={`h-full rounded-full ${
                                usagePct > 80 ? 'bg-red-500' : usagePct > 60 ? 'bg-yellow-500' : 'bg-degen-500'
                              }`}
                              style={{ width: `${Math.min(usagePct, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500">{usagePct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          rl.status === 'ok'
                            ? 'bg-green-500/15 text-green-400'
                            : rl.status === 'near_limit'
                              ? 'bg-yellow-500/15 text-yellow-400'
                              : 'bg-red-500/15 text-red-400'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            rl.status === 'ok' ? 'bg-green-500' : rl.status === 'near_limit' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          {rl.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Global Config Tab ── */}
      {activeTab === 'config' && (
        <div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ConfigCard label="API Version" value={config.apiVersion} />
            <ConfigCard label="Build" value={config.buildVersion} />
            <ConfigCard label="Environment" value={config.environment} />
            <ConfigCard
              label="Default Feed"
              value={config.defaultFeedType}
              accent={config.defaultFeedType === 'trending' ? 'green' : undefined}
            />
            <ConfigCard label="Log Level" value={config.logLevel} />
            <ConfigCard label="Max Upload" value={`${config.maxUploadSize} MB`} />
          </div>

          <div className="space-y-3">
            <ConfigToggleRow
              label="Allow New Registrations"
              description="Enable sign-ups for new users"
              enabled={config.allowNewRegistrations}
              onToggle={() => setConfig((p) => ({ ...p, allowNewRegistrations: !p.allowNewRegistrations }))}
            />
            <ConfigToggleRow
              label="Require Email Verification"
              description="New users must verify email before posting"
              enabled={config.requireEmailVerification}
              onToggle={() => setConfig((p) => ({ ...p, requireEmailVerification: !p.requireEmailVerification }))}
            />
            <ConfigToggleRow
              label="Cache Enabled"
              description="Content and feed caching for performance"
              enabled={config.cacheEnabled}
              onToggle={() => setConfig((p) => ({ ...p, cacheEnabled: !p.cacheEnabled }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function ConfigCard({ label, value, accent }: { label: string; value: string; accent?: 'green' }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`text-sm font-medium ${accent === 'green' ? 'text-degen-400' : 'text-[var(--color-fg)]'}`}>{value}</p>
    </div>
  );
}

function ConfigToggleRow({
  label, description, enabled, onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-4">
      <div>
        <p className="text-sm font-medium text-[var(--color-fg)]">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className="toggle-track shrink-0 ml-4"
        data-checked={enabled}
        onClick={onToggle}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
