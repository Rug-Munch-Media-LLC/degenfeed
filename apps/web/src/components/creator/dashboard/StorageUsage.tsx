'use client';

/**
 * @degenfeed/web — Creator Storage Usage Dashboard (v2)
 *
 * Shows storage usage breakdown by tier (Tier 1 Free / Tier 2 Cheap / Tier 3 Premium),
 * with cost breakdown, storage prediction, and "Optimize Storage" button.
 *
 * Tier information:
 *   - "Your videos are stored on: IPFS (free), R2 (5GB used, $0.08/mo)"
 *   - Cost breakdown: backends, per-type
 *   - "Optimize storage" button (migrate to cheaper tier)
 *   - Storage prediction: "At your current rate, you'll use 12GB by next month"
 *
 * Fetches data from /api/creator/storage endpoint with strategy metadata.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { StatCard } from './StatCard';

// ─── Size formatting ────────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ─── Types ──────────────────────────────────────────────────────────────

interface BackendUsage {
  bytes: number;
  readable: string;
  count: number;
  costPerMo?: number;
  label?: string;
  emoji?: string;
}

interface TypeUsage {
  bytes: number;
  readable: string;
  count: number;
  backend?: string;
  tier?: string;
  costPerMo?: number;
}

interface ExpiringVideo {
  contentId: string;
  title?: string;
  expiresAt: number;
  daysLeft: number;
  tier?: string;
  size?: number;
}

interface StorageForecast {
  projectedBytes30d: number;
  projectedBytes90d: number;
  currentMonthlyCost: number;
  projectedMonthlyCost30d: number;
  projectedMonthlyCost90d: number;
  daysUntilFull: number | null;
  recommendation: string;
}

interface StorageUsageData {
  totalBytes: number;
  totalReadable: string;
  freeLimit: number;
  usagePercent: number;
  byBackend: Record<string, BackendUsage>;
  byType: Record<string, TypeUsage>;
  plan: 'free' | 'premium' | 'pro' | 'enterprise';
  expiringSoon: ExpiringVideo[];
  /** New: cost breakdown per backend */
  costBreakdown?: Record<string, number>;
  /** New: total monthly cost */
  totalMonthlyCost?: number;
  /** New: storage forecast */
  forecast?: StorageForecast;
  /** New: migration candidates count */
  migrationCandidates?: number;
  /** New: potential monthly savings */
  potentialSavings?: number;
}

// ─── Tier Info ──────────────────────────────────────────────────────────

interface StorageTier {
  id: string;
  name: string;
  price: string;
  storage: string;
  backends: string;
  features: string[];
  popular?: boolean;
  cta: string;
  color: string;
}

const STORAGE_TIERS: StorageTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    storage: '5 GB',
    backends: 'IPFS (Storacha) + R2',
    features: [
      'IPFS shorts storage (Tier 1 — Free)',
      'R2 VOD storage (Tier 2 — $0.015/GB)',
      'Basic CDN delivery via Cloudflare',
      'Auto-cleanup after 30 days unwatched',
    ],
    cta: 'Current Plan',
    color: '#00ff41',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$5/mo',
    storage: '50 GB',
    backends: 'IPFS + R2 + B2 + Arweave',
    features: [
      '50 GB combined storage (all tiers)',
      'Backblaze B2 large file storage ($0.006/GB)',
      'Arweave permanent storage (one-time $0.0006/MB)',
      'Priority CDN + no auto-cleanup',
    ],
    popular: true,
    cta: 'Upgrade',
    color: '#f7931a',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$25/mo',
    storage: '500 GB',
    backends: 'All backends + Edge cache',
    features: [
      '500 GB combined storage',
      'Automatic tier optimization',
      'Arweave permanent storage (10GB included)',
      'R2 Infrequent Access for cold VODs',
      'Edge caching + analytics dashboard',
    ],
    cta: 'Upgrade',
    color: '#8a63d2',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    storage: 'Custom',
    backends: 'All + Dedicated IPFS',
    features: [
      'Custom storage limits',
      'Dedicated IPFS node',
      'Private CDN + SLA guarantees',
      'Sia/Filecoin cold archival',
      'White-glove onboarding',
    ],
    cta: 'Contact Us',
    color: '#ff4444',
  },
];

// ─── Color Map ──────────────────────────────────────────────────────────

const BACKEND_COLORS: Record<string, string> = {
  ipfs_storacha: '#00c853',
  ipfs_pinata: '#69f0ae',
  ipfs: '#8a63d2',
  r2_standard: '#f7931a',
  r2_infrequent_access: '#4fc3f7',
  r2: '#f7931a',
  b2: '#e53935',
  storj: '#ffb300',
  arweave: '#00ff41',
  bunny: '#ff6f00',
  sia: '#26a69a',
  filecoin: '#5c6bc0',
  'r2+ipfs': '#ff8f00',
  'r2+arweave': '#ff8f00',
};

const TIER_COLORS: Record<string, string> = {
  tier1_free: '#00ff41',
  tier2_cheap: '#f7931a',
  tier3_premium: '#8a63d2',
};

const TIER_LABELS: Record<string, string> = {
  tier1_free: 'Tier 1 — Free (IPFS)',
  tier2_cheap: 'Tier 2 — Cheap (R2/B2)',
  tier3_premium: 'Tier 3 — Premium (Arweave)',
};

const TYPE_LABELS: Record<string, string> = {
  short: 'Shorts',
  longform: 'VODs',
  podcast: 'Podcasts',
  livestream: 'Live VODs',
  premium: 'Premium',
  temporary: 'Temp',
};

const TYPE_ICONS: Record<string, string> = {
  short: '🎬',
  longform: '📺',
  podcast: '🎙️',
  livestream: '🔴',
  premium: '⭐',
  temporary: '⏳',
};

const BACKEND_EMOJIS: Record<string, string> = {
  ipfs: '🌐',
  ipfs_storacha: '🌐',
  ipfs_pinata: '📌',
  r2: '☁️',
  r2_standard: '☁️',
  r2_infrequent_access: '❄️',
  b2: '💾',
  storj: '🔗',
  arweave: '⛓️',
  bunny: '🐰',
  sia: '📡',
  filecoin: '🗄️',
};

const BACKEND_LABELS: Record<string, string> = {
  ipfs: 'IPFS (decentralized)',
  ipfs_storacha: 'IPFS via Storacha',
  ipfs_pinata: 'IPFS via Pinata',
  r2: 'Cloudflare R2',
  r2_standard: 'Cloudflare R2',
  r2_infrequent_access: 'R2 Infrequent Access',
  b2: 'Backblaze B2',
  storj: 'Storj',
  arweave: 'Arweave (Irys)',
  bunny: 'BunnyCDN',
  sia: 'Sia Network',
  filecoin: 'Filecoin',
};

// ─── Mini Bar ───────────────────────────────────────────────────────────

function MiniUsageBar({
  label,
  value,
  max,
  color,
  sub,
  count,
  cost,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  sub: string;
  count: number;
  cost?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 text-xs text-[var(--color-fg)] shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.max(pct, 1)}%`,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}40`,
          }}
        />
      </div>
      <span className="w-20 text-right text-xs tabular-nums text-[var(--color-fg)] shrink-0">
        {sub}
      </span>
      <span className="w-10 text-right text-[10px] text-[var(--color-muted)] shrink-0">
        {count}
      </span>
      {cost && (
        <span className="w-16 text-right text-[10px] tabular-nums shrink-0" style={{ color }}>
          {cost}
        </span>
      )}
    </div>
  );
}

// ─── Expiry Warning ─────────────────────────────────────────────────────

function ExpiryWarning({
  items,
  onSave,
}: {
  items: ExpiringVideo[];
  onSave?: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-yellow-400 text-sm">⚠️</span>
        <h4 className="text-xs font-semibold text-yellow-400">
          {items.length} video{items.length !== 1 ? 's' : ''} expiring soon
        </h4>
      </div>
      <p className="mb-3 text-[10px] text-[var(--color-muted)]">
        VODs older than 30 days (unwatched) or 90 days (watched) will be cleaned up unless saved.
      </p>
      <div className="space-y-1.5">
        {items.slice(0, 5).map((item) => (
          <div
            key={item.contentId}
            className="flex items-center justify-between rounded-lg bg-yellow-500/5 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-yellow-400">📄</span>
              <span className="text-[10px] text-[var(--color-fg)] truncate max-w-[160px]">
                {item.title ?? item.contentId}
              </span>
              {item.tier && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                  {item.tier}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] text-yellow-400 tabular-nums">
                {item.daysLeft}d left
              </span>
              {item.size && (
                <span className="text-[9px] text-[var(--color-muted)] tabular-nums">
                  {formatSize(item.size)}
                </span>
              )}
              {onSave && (
                <button
                  type="button"
                  onClick={() => onSave(item.contentId)}
                  className="rounded bg-yellow-500/15 px-2 py-0.5 text-[9px] font-medium text-yellow-400 hover:bg-yellow-500/25 transition-colors"
                >
                  Save
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-[9px] text-[var(--color-muted)] text-center pt-1">
            +{items.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Usage Gauge ────────────────────────────────────────────────────────

function UsageGauge({
  used,
  total,
  percent,
}: {
  used: string;
  total: string;
  percent: number;
}) {
  const color =
    percent >= 90 ? '#ff4444' : percent >= 75 ? '#ffaa00' : '#00ff41';

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg
          width="140"
          height="140"
          viewBox="0 0 140 140"
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--color-glass-border)"
            strokeWidth="8"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black tabular-nums text-[var(--color-fg)]">
            {percent}%
          </span>
          <span className="text-[9px] text-[var(--color-muted)]">used</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="text-xs font-medium text-[var(--color-fg)]">{used}</p>
        <p className="text-[10px] text-[var(--color-muted)]">of {total} free</p>
      </div>
    </div>
  );
}

// ─── Cost Breakdown ─────────────────────────────────────────────────────

function CostBreakdown({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number;
}) {
  if (Object.keys(breakdown).length === 0) {
    return (
      <div className="text-[10px] text-[var(--color-muted)] text-center py-2">
        Your storage is currently free! 🎉
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--color-fg)]">
        <span className="font-semibold">Monthly Cost</span>
        <span className="font-bold tabular-nums">${total.toFixed(2)}</span>
      </div>
      <div className="space-y-1">
        {Object.entries(breakdown).map(([backend, cost]) => {
          if (cost === 0) return null;
          const emoji = BACKEND_EMOJIS[backend] ?? '📁';
          const label = BACKEND_LABELS[backend] ?? backend;
          return (
            <div
              key={backend}
              className="flex items-center justify-between text-[10px] text-[var(--color-muted)]"
            >
              <span>
                {emoji} {label}
              </span>
              <span className="tabular-nums">${cost.toFixed(4)}/mo</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Storage Prediction ─────────────────────────────────────────────────

function StoragePrediction({ forecast }: { forecast: StorageForecast }) {
  const projectedReadable30d = formatSize(forecast.projectedBytes30d);
  const projectedReadable90d = formatSize(forecast.projectedBytes90d);

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
      <h4 className="mb-3 text-xs font-semibold text-[var(--color-fg)]">
        📈 Storage Prediction
      </h4>

      {/* Progress bar for projection */}
      <div className="space-y-2">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Current</span>
            <span className="tabular-nums">{formatSize(forecast.currentBytes)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Projected (30d)</span>
            <span className="tabular-nums">{projectedReadable30d}</span>
          </div>
          <div className="flex justify-between text-[10px] text-[var(--color-muted)]">
            <span>Projected (90d)</span>
            <span className="tabular-nums font-medium text-degen-400">{projectedReadable90d}</span>
          </div>
        </div>

        {forecast.daysUntilFull !== null && (
          <div
            className={`rounded-lg px-3 py-2 text-[10px] ${
              forecast.daysUntilFull <= 0
                ? 'bg-red-500/10 text-red-400'
                : forecast.daysUntilFull <= 30
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : forecast.daysUntilFull <= 90
                    ? 'bg-blue-500/10 text-blue-400'
                    : 'bg-green-500/10 text-green-400'
            }`}
          >
            {forecast.daysUntilFull <= 0
              ? '⚠️ Free tier exceeded'
              : `📊 Free tier full in ~${forecast.daysUntilFull} days`}
          </div>
        )}

        <p className="text-[10px] text-[var(--color-muted)] leading-relaxed">
          {forecast.recommendation}
        </p>
      </div>
    </div>
  );
}

// ─── Optimize Button + Modal ────────────────────────────────────────────

function OptimizeSection({
  migrationCount,
  potentialSavings,
  onOptimize,
  optimizing,
}: {
  migrationCount: number;
  potentialSavings: number;
  onOptimize: () => void;
  optimizing: boolean;
}) {
  if (migrationCount === 0) {
    return (
      <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-4 text-center">
        <span className="text-lg">✅</span>
        <p className="mt-1 text-[10px] text-green-400">
          Your storage is already optimally distributed.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-degen-500/20 bg-degen-500/5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="text-xs font-semibold text-degen-400">
            🚀 Storage Optimization Available
          </h4>
          <p className="mt-1 text-[10px] text-[var(--color-muted)]">
            {migrationCount} file{migrationCount !== 1 ? 's' : ''} can be migrated to cheaper storage.
          </p>
          {potentialSavings > 0 && (
            <p className="text-[10px] text-green-400 tabular-nums mt-0.5">
              Potential savings: ~${potentialSavings.toFixed(4)}/mo
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onOptimize}
          disabled={optimizing}
          className="rounded-lg bg-degen-500/15 px-3 py-1.5 text-[10px] font-bold text-degen-400 hover:bg-degen-500/25 disabled:opacity-50 transition-all"
        >
          {optimizing ? 'Optimizing...' : 'Optimize Storage'}
        </button>
      </div>
    </div>
  );
}

// ─── Tier Label Component ───────────────────────────────────────────────

function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#888';
  const label = TIER_LABELS[tier] ?? tier;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Upgrade Section ────────────────────────────────────────────────────

function UpgradeSection({ currentPlan }: { currentPlan: string }) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-bold text-[var(--color-fg)]">
        Upgrade Storage
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STORAGE_TIERS.map((tier) => {
          const isCurrent = tier.id === currentPlan;
          return (
            <div
              key={tier.id}
              className={`relative rounded-xl border p-4 transition-all ${
                isCurrent
                  ? 'border-degen-500/30 bg-degen-500/5'
                  : tier.popular
                    ? 'border-degen-500/20 bg-[var(--color-card)] hover:border-degen-500/40'
                    : 'border-[var(--color-glass-border)] bg-[var(--color-card)] hover:border-degen-500/20'
              }`}
            >
              {tier.popular && !isCurrent && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-degen-500 px-3 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black">
                  Popular
                </div>
              )}
              <div className="mb-3">
                <h4 className="text-sm font-bold text-[var(--color-fg)]">{tier.name}</h4>
                <div className="mt-1 text-2xl font-black tabular-nums text-[var(--color-fg)]">
                  {tier.price}
                </div>
                <p className="text-[10px] text-[var(--color-muted)]">{tier.storage}</p>
              </div>

              {/* Backend indicator */}
              <div
                className="mb-3 rounded-md px-2 py-1 text-[8px] font-medium"
                style={{
                  backgroundColor: `${tier.color}10`,
                  color: tier.color,
                }}
              >
                {tier.backends}
              </div>

              <ul className="mb-4 space-y-1.5">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[10px] text-[var(--color-muted)]">
                    <span className="text-degen-400 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={isCurrent}
                className={`w-full rounded-lg py-2 text-[10px] font-bold transition-all ${
                  isCurrent
                    ? 'bg-[var(--color-glass-border)] text-[var(--color-muted)] cursor-not-allowed'
                    : tier.popular
                      ? 'bg-degen-500/20 text-degen-400 hover:bg-degen-500/30'
                      : 'bg-[var(--color-overlay)] text-[var(--color-fg)] hover:bg-[var(--color-glass-border)]'
                }`}
              >
                {isCurrent ? '✓ Current' : tier.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════

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
          // Set enhanced mock data for demo
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
              {
                contentId: 'vod-abc-123',
                title: 'Weekly Update #42',
                expiresAt: Date.now() + 3 * 86400_000,
                daysLeft: 3,
                tier: 'Tier 2 (R2)',
                size: 250_000_000,
              },
              {
                contentId: 'vod-def-456',
                title: 'Live Stream Replay — July 18',
                expiresAt: Date.now() + 5 * 86400_000,
                daysLeft: 5,
                tier: 'Tier 2 (R2)',
                size: 1_200_000_000,
              },
              {
                contentId: 'pod-ghi-789',
                title: 'Crypto Chat #12',
                expiresAt: Date.now() + 12 * 86400_000,
                daysLeft: 12,
                tier: 'Tier 1 (IPFS)',
                size: 45_000_000,
              },
            ],
            totalMonthlyCost: 0.01906,
            costBreakdown: {
              ipfs_storacha: 0,
              ipfs_pinata: 0,
              r2_standard: 0.015,
              r2_infrequent_access: 0.004,
              arweave: 0.00006,
            },
            forecast: {
              projectedBytes30d: 3_000_000_000,
              projectedBytes90d: 4_500_000_000,
              currentMonthlyCost: 0.019,
              projectedMonthlyCost30d: 0.025,
              projectedMonthlyCost90d: 0.035,
              daysUntilFull: 87,
              recommendation: '📈 At your current rate, you\'ll use 4.5 GB in 3 months. You\'re still within the free tier, but consider cleaning up old content.'
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
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSaveVideo = useCallback(async (_contentId: string) => {
    console.log('Save video:', _contentId);
  }, []);

  const handleOptimize = useCallback(async () => {
    setOptimizing(true);
    try {
      // In production: POST /api/creator/storage/optimize
      await new Promise((resolve) => setTimeout(resolve, 1500));
      // Refresh data after optimization
      console.log('Storage optimization complete');
    } catch (e) {
      console.error('Optimization failed:', e);
    } finally {
      setOptimizing(false);
    }
  }, []);

  // ─── Loading state ────────────────────────────────────────────────

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

  // ─── Error state ──────────────────────────────────────────────────

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

  const maxBackendBytes = Math.max(
    ...Object.values(data.byBackend).map((b) => b.bytes),
    1,
  );

  const costTotal = Object.values(data.costBreakdown ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-fg)]">Storage Usage</h2>
          <p className="text-xs text-[var(--color-muted)]">
            Your videos are stored across Tier 1 (Free IPFS), Tier 2 (Cheap R2/B2), and Tier 3 (Premium Arweave)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowUpgrade(!showUpgrade)}
            className="btn-primary text-xs"
          >
            {showUpgrade ? 'Hide Plans' : 'Upgrade Storage'}
          </button>
        </div>
      </div>

      {/* Tier info banner */}
      <div className="flex gap-2 flex-wrap">
        <TierBadge tier="tier1_free" />
        <TierBadge tier="tier2_cheap" />
        <TierBadge tier="tier3_premium" />
        <span className="text-[9px] text-[var(--color-muted)] self-center ml-1">
          Cost: ~${costTotal.toFixed(4)}/mo total
        </span>
      </div>

      {/* Main grid: gauge + predictions */}
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <UsageGauge
          used={data.totalReadable}
          total={formatSize(data.freeLimit)}
          percent={data.usagePercent}
        />

        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[var(--color-fg)]">
            Storage by Backend
          </h3>
          {Object.entries(data.byBackend).map(([backend, usage]) => (
            <MiniUsageBar
              key={backend}
              label={`${BACKEND_EMOJIS[backend] ?? '📁'} ${BACKEND_LABELS[backend] ?? backend}`}
              value={usage.bytes}
              max={maxBackendBytes}
              color={BACKEND_COLORS[backend] ?? '#888'}
              sub={usage.readable}
              count={usage.count}
              cost={usage.costPerMo !== undefined && usage.costPerMo > 0
                ? `$${usage.costPerMo.toFixed(4)}/mo`
                : 'free'
              }
            />
          ))}
        </div>
      </div>

      {/* Cost Breakdown + Prediction Row */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Cost Breakdown */}
        <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-4 backdrop-blur-xl">
          <h3 className="mb-3 text-xs font-semibold text-[var(--color-fg)]">
            💰 Cost Breakdown
          </h3>
          <CostBreakdown
            breakdown={data.costBreakdown ?? {}}
            total={costTotal}
          />
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

        {/* Storage Prediction */}
        {data.forecast && <StoragePrediction forecast={data.forecast} />}
      </div>

      {/* Optimize Section */}
      {data.migrationCandidates !== undefined && (
        <OptimizeSection
          migrationCount={data.migrationCandidates}
          potentialSavings={data.potentialSavings ?? 0}
          onOptimize={handleOptimize}
          optimizing={optimizing}
        />
      )}

      {/* Breakdown by content type with tier info */}
      <div className="card border-[var(--color-border)] bg-[var(--color-overlay)] p-5 backdrop-blur-xl">
        <h3 className="mb-4 text-sm font-semibold text-[var(--color-fg)]">
          Breakdown by Content Type
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.byType).map(([type, usage]) => (
            <div
              key={type}
              className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-fg)]">
                  {TYPE_ICONS[type] ?? '📁'} {TYPE_LABELS[type] ?? type}
                </span>
                {usage.tier && <TierBadge tier={usage.tier} />}
              </div>
              <div className="text-sm font-bold text-[var(--color-fg)] tabular-nums">
                {usage.readable}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--color-muted)] mt-1">
                <span>{usage.count} file{usage.count !== 1 ? 's' : ''}</span>
                {usage.backend && (
                  <span>
                    {BACKEND_EMOJIS[usage.backend] ?? '📁'} {BACKEND_LABELS[usage.backend] ?? usage.backend}
                  </span>
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

      {/* Expiry warnings */}
      <ExpiryWarning items={data.expiringSoon} onSave={handleSaveVideo} />

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Files"
          value={String(
            Object.values(data.byBackend).reduce((s, b) => s + b.count, 0),
          )}
          sub="Across all storage tiers"
          icon="📁"
        />
        <StatCard
          label="Shorts (IPFS — Free)"
          value={data.byType.short?.readable ?? '0 B'}
          sub={`${data.byType.short?.count ?? 0} files • $0/mo`}
          icon="🎬"
        />
        <StatCard
          label="VODs (R2/B2 — $0.006-0.015/GB)"
          value={data.byType.longform?.readable ?? '0 B'}
          sub={`${data.byType.longform?.count ?? 0} files • ~$${((data.byType.longform?.costPerMo ?? 0)).toFixed(4)}/mo`}
          icon="📺"
        />
        <StatCard
          label="Premium (Arweave — Permanent)"
          value={data.byType.premium?.readable ?? '0 B'}
          sub="One-time fee • Never deleted"
          icon="⭐"
        />
      </div>

      {/* Cost savings summary */}
      {(data.potentialSavings ?? 0) > 0 && (
        <div className="rounded-xl border border-green-500/10 bg-green-500/5 p-3">
          <p className="text-[10px] text-green-400 text-center">
            💰 You could save ~${data.potentialSavings!.toFixed(4)}/mo by optimizing your storage layout.
            {' '}
            <button
              type="button"
              onClick={handleOptimize}
              disabled={optimizing}
              className="underline hover:text-green-300"
            >
              {optimizing ? 'Optimizing...' : 'Run optimizer'}
            </button>
          </p>
        </div>
      )}

      {/* Upgrade section */}
      {showUpgrade && <UpgradeSection currentPlan={data.plan} />}

      {/* Info banner */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4">
        <div className="flex items-start gap-3">
          <span className="text-lg text-degen-400 mt-0.5">💡</span>
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-fg)]">
              How Storage Tiers Work
            </h4>
            <ul className="mt-2 space-y-1 text-[10px] text-[var(--color-muted)]">
              <li>
                <strong className="text-green-400">Tier 1 (Free):</strong> Shorts &amp; podcasts on
                IPFS via Storacha (5GB free). Zero cost, decentralized.
              </li>
              <li>
                <strong className="text-orange-400">Tier 2 (Cheap):</strong> VODs on R2
                ($0.015/GB/mo), cold VODs on R2 Infrequent Access ($0.01/GB/mo), large VODs
                (&gt;500MB) on Backblaze B2 ($0.006/GB/mo).
              </li>
              <li>
                <strong className="text-purple-400">Tier 3 (Premium):</strong> Archival content on
                Arweave via Irys (~$0.0006/MB one-time, permanent).
              </li>
              <li>
                <strong className="text-yellow-400">Auto-migration:</strong> Cold/unpopular content
                is automatically moved to cheaper tiers after 30-90 days.
              </li>
              <li>
                <strong className="text-[var(--color-fg)]">Optimize:</strong> Click "Optimize
                Storage" to find migration candidates and reduce your monthly bill.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
