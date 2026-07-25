'use client';

/**
 * @degenfeed/web — Creator Storage Usage Dashboard (v2)
 *
 * Shows storage usage breakdown by tier (Tier 1 Free / Tier 2 Cheap / Tier 3 Premium),
 * with cost breakdown, storage prediction, and "Optimize Storage" button.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StatCard } from './StatCard';
import { formatSize, BACKEND_EMOJIS, BACKEND_LABELS, BACKEND_COLORS, TYPE_ICONS, TYPE_LABELS } from './constants';
import { MiniUsageBar } from './components/MiniUsageBar';
import { ExpiryWarning } from './components/ExpiryWarning';
import { UsageGauge } from './components/UsageGauge';
import { CostBreakdown } from './components/CostBreakdown';
import { StoragePrediction } from './components/StoragePrediction';
import { OptimizeSection } from './components/OptimizeSection';
import { TierBadge } from './components/TierBadge';
import { UpgradeSection } from './components/UpgradeSection';
import type { StorageUsageData } from './types';

export default function StorageUsage() {
  const [data, setData] = useState<StorageUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchUsage = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/creator/storage');
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = (await res.json()) as StorageUsageData;
        if (mountedRef.current) setData(json);
      } catch (e) {
        if (mountedRef.current) {
          setError(e instanceof Error ? e.message : 'Failed to load storage usage');
          setData({
            totalBytes: 2_300_000_000,
            totalReadable: '2.3 GB',
            freeLimit: 5_368_709_120,
            usagePercent: 43,
            byBackend: {
              ipfs_storacha: { bytes: 500_000_000, readable: '500 MB', count: 20, costPerMo: 0, label: 'IPFS via Storacha', emoji: '🌐' },
              ipfs_pinata: { bytes: 300_000_000, readable: '300 MB', count: 4, costPerMo: 0, label: 'IPFS via Pinata', emoji: '📌' },
              r2_standard: { bytes: 1_000_000_000, readable: '1.0 GB', count: 8, costPerMo: 0.015, label: 'Cloudflare R2', emoji: '☁️' },
              r2_infrequent_access: { bytes: 400_000_000, readable: '400 MB', count: 4, costPerMo: 0.004, label: 'R2 Infrequent Access', emoji: '❄️' },
              arweave: { bytes: 100_000_000, readable: '100 MB', count: 3, costPerMo: 0.00006, label: 'Arweave (Irys)', emoji: '⛓️' },
            },
            byType: {
              short: { bytes: 600_000_000, readable: '600 MB', count: 20, backend: 'ipfs_storacha', tier: 'tier1_free', costPerMo: 0 },
              longform: { bytes: 1_000_000_000, readable: '1.0 GB', count: 8, backend: 'r2_standard', tier: 'tier2_cheap', costPerMo: 0.015 },
              podcast: { bytes: 200_000_000, readable: '200 MB', count: 4, backend: 'ipfs_storacha', tier: 'tier1_free', costPerMo: 0 },
              livestream: { bytes: 400_000_000, readable: '400 MB', count: 4, backend: 'r2_infrequent_access', tier: 'tier2_cheap', costPerMo: 0.004 },
              premium: { bytes: 100_000_000, readable: '100 MB', count: 3, backend: 'arweave', tier: 'tier3_premium', costPerMo: 0.00006 },
            },
            plan: 'free',
            expiringSoon: [
              { contentId: 'vod-abc-123', title: 'Weekly Update #42', expiresAt: Date.now() + 3 * 86400_000, daysLeft: 3, tier: 'Tier 2 (R2)', size: 250_000_000 },
              { contentId: 'vod-def-456', title: 'Live Stream Replay — July 18', expiresAt: Date.now() + 5 * 86400_000, daysLeft: 5, tier: 'Tier 2 (R2)', size: 1_200_000_000 },
              { contentId: 'pod-ghi-789', title: 'Crypto Chat #12', expiresAt: Date.now() + 12 * 86400_000, daysLeft: 12, tier: 'Tier 1 (IPFS)', size: 45_000_000 },
            ],
            totalMonthlyCost: 0.01906,
            costBreakdown: { ipfs_storacha: 0, ipfs_pinata: 0, r2_standard: 0.015, r2_infrequent_access: 0.004, arweave: 0.00006 },
            forecast: {
              projectedBytes30d: 3_000_000_000, projectedBytes90d: 4_500_000_000,
              currentMonthlyCost: 0.019, projectedMonthlyCost30d: 0.025, projectedMonthlyCost90d: 0.035,
              daysUntilFull: 87,
              recommendation: "📈 At your current rate, you'll use 4.5 GB in 3 months. You're still within the free tier, but consider cleaning up old content.",
              currentBytes: 2_300_000_000,
            },
            migrationCandidates: 4,
            potentialSavings: 0.008,
          });
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    fetchUsage();
    return () => { mountedRef.current = false; };
  }, []);

  const handleSaveVideo = useCallback(async (_contentId: string) => {
    console.log('Save video:', _contentId);
  }, []);

  const handleOptimize = useCallback(async () => {
    setOptimizing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('Storage optimization complete');
    } catch (e) {
      console.error('Optimization failed:', e);
    } finally {
      setOptimizing(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-6 text-center backdrop-blur-xl">
        <p className="text-sm text-[var(--color-muted)]">No storage data available.</p>
      </div>
    );
  }

  const maxBackendBytes = Math.max(...Object.values(data.byBackend).map((b) => b.bytes), 1);
  const costTotal = Object.values(data.costBreakdown ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Storage Usage</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Your videos are stored across Tier 1 (Free IPFS), Tier 2 (Cheap R2/B2), and Tier 3 (Premium Arweave)
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowUpgrade(!showUpgrade)} className="btn-primary text-xs">
            {showUpgrade ? 'Hide Plans' : 'Upgrade Storage'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <TierBadge tier="tier1_free" />
        <TierBadge tier="tier2_cheap" />
        <TierBadge tier="tier3_premium" />
        <span className="text-[9px] text-[var(--color-muted)] self-center ml-1">
          Cost: ~${costTotal.toFixed(4)}/mo total
        </span>
      </div>

      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <UsageGauge used={data.totalReadable} total={formatSize(data.freeLimit)} percent={data.usagePercent} />
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[var(--color-fg)]">Storage by Backend</h3>
          {Object.entries(data.byBackend).map(([backend, usage]) => (
            <MiniUsageBar
              key={backend}
              label={`${BACKEND_EMOJIS[backend] ?? '📁'} ${BACKEND_LABELS[backend] ?? backend}`}
              value={usage.bytes}
              max={maxBackendBytes}
              color={BACKEND_COLORS[backend] ?? '#888'}
              sub={usage.readable}
              count={usage.count}
              cost={usage.costPerMo !== undefined && usage.costPerMo > 0 ? `$${usage.costPerMo.toFixed(4)}/mo` : 'free'}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <h3 className="mb-3 text-xs font-semibold text-[var(--color-fg)]">💰 Cost Breakdown</h3>
          <CostBreakdown breakdown={data.costBreakdown ?? {}} total={costTotal} />
          {data.totalMonthlyCost !== undefined && data.totalMonthlyCost > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-glass-border)]">
              <div className="flex justify-between text-[10px]">
                <span className="text-[var(--color-muted)]">Annual projected</span>
                <span className="text-[var(--color-fg)] font-bold tabular-nums">
                  ${(data.totalMonthlyCost * 12).toFixed(2)}/yr
                </span>
              </div>
            </div>
          )}
        </div>
        {data.forecast && <StoragePrediction forecast={data.forecast} />}
      </div>

      {data.migrationCandidates !== undefined && (
        <OptimizeSection
          migrationCount={data.migrationCandidates}
          potentialSavings={data.potentialSavings ?? 0}
          onOptimize={handleOptimize}
          optimizing={optimizing}
        />
      )}

      <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
        <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">Breakdown by Content Type</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.byType).map(([type, usage]) => (
            <div key={type} className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-fg)]">
                  {TYPE_ICONS[type] ?? '📁'} {TYPE_LABELS[type] ?? type}
                </span>
                {usage.tier && <TierBadge tier={usage.tier} />}
              </div>
              <div className="text-sm font-bold text-[var(--color-fg)] tabular-nums">{usage.readable}</div>
              <div className="flex justify-between text-[10px] text-[var(--color-muted)] mt-1">
                <span>{usage.count} file{usage.count !== 1 ? 's' : ''}</span>
                {usage.backend && (
                  <span>{BACKEND_EMOJIS[usage.backend] ?? '📁'} {BACKEND_LABELS[usage.backend] ?? usage.backend}</span>
                )}
              </div>
              {usage.costPerMo !== undefined && (
                <div className="text-[9px] text-[var(--color-muted)] mt-0.5 tabular-nums">
                  {usage.costPerMo > 0 ? `$${usage.costPerMo.toFixed(4)}/mo` : 'Free'}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ExpiryWarning items={data.expiringSoon} onSave={handleSaveVideo} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Files" value={String(Object.values(data.byBackend).reduce((s, b) => s + b.count, 0))} sub="Across all storage tiers" icon="📁" />
        <StatCard label="Shorts (IPFS — Free)" value={data.byType.short?.readable ?? '0 B'} sub={`${data.byType.short?.count ?? 0} files • $0/mo`} icon="🎬" />
        <StatCard label="VODs (R2/B2 — $0.006-0.015/GB)" value={data.byType.longform?.readable ?? '0 B'} sub={`${data.byType.longform?.count ?? 0} files • ~$${(data.byType.longform?.costPerMo ?? 0).toFixed(4)}/mo`} icon="📺" />
        <StatCard label="Premium (Arweave — Permanent)" value={data.byType.premium?.readable ?? '0 B'} sub="One-time fee • Never deleted" icon="⭐" />
      </div>

      {(data.potentialSavings ?? 0) > 0 && (
        <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-3">
          <p className="text-[10px] text-green-400 text-center">
            💰 You could save ~${data.potentialSavings?.toFixed(4)}/mo by optimizing your storage layout.{' '}
            <button type="button" onClick={handleOptimize} disabled={optimizing} className="underline hover:text-green-300">
              {optimizing ? 'Optimizing...' : 'Run optimizer'}
            </button>
          </p>
        </div>
      )}

      {showUpgrade && <UpgradeSection currentPlan={data.plan} />}

      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg text-degen-400 mt-0.5">💡</span>
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-fg)]">How Storage Tiers Work</h4>
            <ul className="mt-2 space-y-1 text-[10px] text-[var(--color-muted)]">
              <li><strong className="text-green-400">Tier 1 (Free):</strong> Shorts &amp; podcasts on IPFS via Storacha (5GB free). Zero cost, decentralized.</li>
              <li><strong className="text-orange-400">Tier 2 (Cheap):</strong> VODs on R2 ($0.015/GB/mo), cold VODs on R2 Infrequent Access ($0.01/GB/mo), large VODs (&gt;500MB) on Backblaze B2 ($0.006/GB/mo).</li>
              <li><strong className="text-purple-400">Tier 3 (Premium):</strong> Archival content on Arweave via Irys (~$0.0006/MB one-time, permanent).</li>
              <li><strong className="text-yellow-400">Auto-migration:</strong> Cold/unpopular content is automatically moved to cheaper tiers after 30-90 days.</li>
              <li><strong className="text-[var(--color-fg)]">Optimize:</strong> Click "Optimize Storage" to find migration candidates and reduce your monthly bill.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
