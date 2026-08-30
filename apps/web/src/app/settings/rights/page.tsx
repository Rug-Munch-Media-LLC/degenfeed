'use client';

/**
 * Digital Rights Dashboard
 *
 * Sovereign identity dashboard showing:
 *   - Sovereignty Score (0-100)
 *   - Per-network membership tracking with immutable timestamps
 *   - W3C Verifiable Credentials and attestations
 *   - Network rights and achievements
 *   - Identity portability (DID Document, portable bundle)
 *   - Verification tools
 *   - Export and exit preparation
 *
 * Follows the same layout conventions as settings/security/page.tsx and
 * settings/connected-accounts/page.tsx.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import { useToast } from '../../../components/Toast';
import PageHeader from '../../../components/ui/PageHeader';

// ─── Types ─────────────────────────────────────────────────────────────

interface SovereigntyScore {
  score: number;
  maxScore: number;
  breakdown: {
    networkCount: number;
    rightCount: number;
    membershipDepth: number;
    verificationLevel: number;
    longevity: number;
  };
}

interface NetworkMembership {
  protocol: string;
  identifier: string;
  label: string;
  status: 'active' | 'inactive' | 'suspended' | 'exited';
  joinedAt: number;
  rightCount: number;
  verified: boolean;
}

interface RightsManifest {
  wallet: string;
  networks: NetworkMembership[];
  totalRights: number;
  totalNetworks: number;
  activeMemberships: number;
  generatedAt: number;
  manifestHash: string;
}

interface NetworkRight {
  id: string;
  type: string;
  name: string;
  description: string;
  protocol: string;
  grantedAt: number;
  reason: string;
  active: boolean;
}

interface AttestationRecord {
  id: string;
  protocol: string;
  createdAt: number;
  active: boolean;
  credential?: {
    type: string[];
    issuer: { id: string };
    issuanceDate: string;
  };
}

interface DidDocument {
  id: string;
  alsoKnownAs: string[];
  verificationMethod: Array<{
    id: string;
    type: string;
    blockchainAccountId?: string;
  }>;
}

interface PortableBundle {
  did: string;
  protocols: Array<{
    protocol: string;
    identifier: string;
    serviceEndpoint: string;
  }>;
  walletAddress: string;
  exportedAt: number;
}

// ─── Loading state component ──────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-32 animate-pulse rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)]"
        />
      ))}
    </div>
  );
}

// ─── Score Gauge ──────────────────────────────────────────────────────

function ScoreGauge({ score, maxScore, breakdown }: SovereigntyScore) {
  const percentage = (score / maxScore) * 100;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on score
  const strokeColor =
    score >= 80
      ? '#00ff41'
      : score >= 60
        ? '#22c55e'
        : score >= 40
          ? '#eab308'
          : score >= 20
            ? '#f97316'
            : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
      {/* Score Ring */}
      <div className="relative h-28 w-28 shrink-0">
        <svg aria-hidden="true" className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="var(--color-overlay)"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-bold text-[var(--color-fg)]"
            style={{ color: strokeColor }}
          >
            {score}
          </span>
          <span className="text-[10px] text-[var(--color-muted)]">/ {maxScore}</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted)]">Network diversity</span>
          <span className="font-medium text-[var(--color-fg)]">
            {((breakdown.networkCount / 15) * 25).toFixed(0)} / 25
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted)]">Rights &amp; achievements</span>
          <span className="font-medium text-[var(--color-fg)]">
            {((breakdown.rightCount / 30) * 25).toFixed(0)} / 25
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted)]">Membership depth</span>
          <span className="font-medium text-[var(--color-fg)]">
            {breakdown.membershipDepth.toFixed(1)} / 20
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted)]">Verification level</span>
          <span className="font-medium text-[var(--color-fg)]">
            {breakdown.verificationLevel.toFixed(1)} / 15
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--color-muted)]">Right longevity</span>
          <span className="font-medium text-[var(--color-fg)]">
            {breakdown.longevity.toFixed(1)} / 15
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Network Badge ────────────────────────────────────────────────────

function NetworkBadge({ network }: { network: NetworkMembership }) {
  const statusColors: Record<string, string> = {
    active: 'bg-degen-500/15 text-degen-400',
    inactive: 'bg-[var(--color-overlay)] text-[var(--color-muted)]',
    suspended: 'bg-red-500/15 text-red-400',
    exited: 'bg-amber-500/15 text-amber-400',
  };

  const protocolColors: Record<string, string> = {
    nostr: '#8e30eb',
    farcaster: '#8a63d2',
    lens: '#abfe2c',
    bluesky: '#1185fe',
    mastodon: '#6364ff',
    reddit: '#ff4500',
    threads: '#888',
    lemmy: '#00b868',
    peertube: '#f1680d',
    atproto: '#0085ff',
    zora: '#0052FF',
    telegram: '#0088cc',
    rss: '#ffa500',
    ethereum: '#627eea',
    solana: '#9945ff',
  };

  const daysAgo = Math.floor((Date.now() - network.joinedAt) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-glass-border)] px-4 py-3">
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
        style={{
          backgroundColor: `${protocolColors[network.protocol] || '#666'}20`,
          color: protocolColors[network.protocol] || '#666',
        }}
      >
        {network.protocol.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-fg)] capitalize">
            {network.protocol}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[network.status] || 'bg-[var(--color-overlay)] text-[var(--color-muted)]'}`}
          >
            {network.status}
          </span>
          {network.verified && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00ff41"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Verified"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4L12 14.01l-3-3" />
            </svg>
          )}
        </div>
        <p className="truncate text-xs text-[var(--color-muted)]">{network.identifier}</p>
        <p className="text-[10px] text-[var(--color-muted)]">
          Joined {daysAgo > 0 ? `${daysAgo} days ago` : 'today'} · {network.rightCount} right
          {network.rightCount !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// ─── Right Card ───────────────────────────────────────────────────────

function RightCard({ right }: { right: NetworkRight }) {
  const typeIcons: Record<string, string> = {
    membership: '🪪',
    contribution: '✍️',
    achievement: '🏆',
    governance: '🗳️',
    content: '📄',
    reputation: '⭐',
  };

  const daysAgo = Math.floor((Date.now() - right.grantedAt) / (1000 * 60 * 60 * 24));

  return (
    <div
      className={`rounded-lg border px-4 py-3 transition-colors ${
        right.active ? 'border-[var(--color-glass-border)]' : 'border-red-500/10 opacity-60'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{typeIcons[right.type] || '📋'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-fg)]">{right.name}</span>
            {!right.active && (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-muted)] line-clamp-2">{right.description}</p>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
            <span className="capitalize">{right.protocol}</span>
            <span>·</span>
            <span className="capitalize">{right.type}</span>
            <span>·</span>
            <span>Granted {daysAgo > 0 ? `${daysAgo}d ago` : 'today'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Attestation Card ─────────────────────────────────────────────────

function AttestationCard({ att }: { att: AttestationRecord }) {
  const daysAgo = Math.floor((Date.now() - att.createdAt) / (1000 * 60 * 60 * 24));

  return (
    <div className="rounded-lg border border-[var(--color-glass-border)] px-4 py-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-fg)] capitalize">
              {att.protocol} Attestation
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                att.active ? 'bg-degen-500/15 text-degen-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {att.active ? 'Active' : 'Revoked'}
            </span>
          </div>
          <p className="text-xs text-[var(--color-muted)]">
            W3C Verifiable Credential · Created {daysAgo > 0 ? `${daysAgo} days ago` : 'today'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => verifyAttestation(att.id)}
            className="rounded-lg border border-[var(--color-glass-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => downloadAttestation(att.id)}
            className="rounded-lg border border-[var(--color-glass-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
          >
            JSON
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Verify and download handlers ─────────────────────────────────────

async function verifyAttestation(_id: string) {
  // Opens the credential verification dialog
  window.open(`/api/identity/attestation/${_id}/verify`, '_blank');
}

async function downloadAttestation(id: string) {
  try {
    const res = await fetch(`/api/identity/attestation/${id}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attestation-${id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Silent — error handled by caller
  }
}

async function downloadPortableBundle(walletAddress: string) {
  try {
    const res = await fetch('/api/identity/portable-bundle', {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to fetch');
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `identity-bundle-${walletAddress.slice(2, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Silent
  }
}

// ─── Main Page Component ──────────────────────────────────────────────

export default function DigitalRightsPage() {
  const { walletAddress } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sovereignty, setSovereignty] = useState<SovereigntyScore | null>(null);
  const [manifest, setManifest] = useState<RightsManifest | null>(null);
  const [rights, setRights] = useState<NetworkRight[]>([]);
  const [attestations, setAttestations] = useState<AttestationRecord[]>([]);
  const [didDocument, setDidDocument] = useState<DidDocument | null>(null);
  const [portableBundle, setPortableBundle] = useState<PortableBundle | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rights' | 'attestations' | 'identity'>(
    'overview',
  );
  const [exporting, setExporting] = useState(false);

  const fetchAllData = useCallback(async () => {
    if (!walletAddress) return;

    try {
      const [scoreRes, manifestRes, rightsRes, attestRes, didRes, bundleRes] = await Promise.all([
        fetch('/api/rights/sovereignty-score', { credentials: 'include' }),
        fetch('/api/rights/manifest', { credentials: 'include' }),
        fetch('/api/identity/rights', { credentials: 'include' }),
        fetch('/api/identity/attestations', { credentials: 'include' }),
        fetch('/api/identity/did', { credentials: 'include' }),
        fetch('/api/identity/portable-bundle', { credentials: 'include' }),
      ]);

      if (scoreRes.ok) {
        const data = (await scoreRes.json()) as { data: SovereigntyScore };
        setSovereignty(data.data ?? (data as unknown as SovereigntyScore));
      }
      if (manifestRes.ok) {
        const data = (await manifestRes.json()) as { data: RightsManifest };
        setManifest(data.data ?? (data as unknown as RightsManifest));
      }
      if (rightsRes.ok) {
        const data = (await rightsRes.json()) as { data: NetworkRight[] };
        setRights(data.data ?? []);
      }
      if (attestRes.ok) {
        const data = (await attestRes.json()) as { data: AttestationRecord[] };
        setAttestations(data.data ?? []);
      }
      if (didRes.ok) {
        const data = (await didRes.json()) as { data: DidDocument };
        setDidDocument(data.data ?? null);
      }
      if (bundleRes.ok) {
        const data = (await bundleRes.json()) as { data: PortableBundle };
        setPortableBundle(data.data ?? null);
      }
    } catch {
      showToast('error', 'Failed to load rights data');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, showToast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleExportBundle = useCallback(async () => {
    if (!walletAddress) return;
    setExporting(true);
    try {
      await downloadPortableBundle(walletAddress);
      showToast('success', 'Identity bundle downloaded');
    } catch {
      showToast('error', 'Failed to download bundle');
    } finally {
      setExporting(false);
    }
  }, [walletAddress, showToast]);

  const handleFullExport = useCallback(async () => {
    setExporting(true);
    try {
      // Trigger full data export
      const res = await fetch('/api/export/all', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'degenfeed-export.zip';
      a.click();
      URL.revokeObjectURL(url);
      showToast('success', 'Full data export downloaded');
    } catch {
      showToast('error', 'Failed to export data');
    } finally {
      setExporting(false);
    }
  }, [showToast]);

  // Icons
  const shieldIcon = (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );

  if (!walletAddress) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
        <PageHeader
          title="Digital Rights"
          description="Your permanent, verifiable rights across every network"
          icon={shieldIcon}
          breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Digital Rights' }]}
        />
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
          <p className="text-sm text-amber-400">
            Connect a wallet to view your digital rights, attestations, and sovereignty score.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
        <PageHeader
          title="Digital Rights"
          description="Your permanent, verifiable rights across every network"
          icon={shieldIcon}
          breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Digital Rights' }]}
        />
        <LoadingSkeleton />
      </div>
    );
  }

  const activeRights = rights.filter((r) => r.active);
  const activeAttestations = attestations.filter((a) => a.active);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 animate-page-enter pb-28 sm:pb-6">
      <PageHeader
        title="Digital Rights"
        description="Your permanent, verifiable rights across every network"
        icon={shieldIcon}
        breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Digital Rights' }]}
        actions={
          <button
            type="button"
            onClick={handleFullExport}
            disabled={exporting}
            className="rounded-xl bg-degen-500/15 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/25 disabled:opacity-50"
          >
            {exporting ? 'Exporting\u2026' : 'Export All Data'}
          </button>
        }
      />

      {/* === Sovereignty Score Section ============================ */}
      <section className="mb-8" aria-labelledby="heading-sovereignty">
        <h2
          id="heading-sovereignty"
          className="mb-3 text-base font-semibold text-[var(--color-fg)]"
        >
          Sovereignty Score
        </h2>
        <div className="overflow-hidden rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)]">
          <div className="px-5 py-5">
            {sovereignty ? (
              <ScoreGauge {...sovereignty} />
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                No score yet. Link your first network identity to start building your sovereignty
                score.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* === Tab Navigation ======================================= */}
      <div className="mb-6 flex gap-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] p-1">
        {[
          { id: 'overview' as const, label: 'Overview', count: manifest?.totalNetworks },
          { id: 'rights' as const, label: 'Rights', count: activeRights.length },
          { id: 'attestations' as const, label: 'Attestations', count: activeAttestations.length },
          { id: 'identity' as const, label: 'Identity' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-degen-500/15 text-degen-400'
                : 'text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-overlay)]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-[10px] opacity-70">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* === Overview Tab ========================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Network membership cards */}
          <section aria-labelledby="heading-networks">
            <h3 id="heading-networks" className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Network Memberships
            </h3>
            <div className="space-y-2">
              {manifest && manifest.networks.length > 0 ? (
                manifest.networks.map((network) => (
                  <NetworkBadge
                    key={`${network.protocol}-${network.identifier}`}
                    network={network}
                  />
                ))
              ) : (
                <p className="text-sm text-[var(--color-muted)] py-4">
                  No network memberships yet. Link your first identity in Settings {'>'} Connected
                  Accounts.
                </p>
              )}
            </div>
          </section>

          {/* Quick stats */}
          <section aria-labelledby="heading-stats">
            <h3 id="heading-stats" className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Rights Summary
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-[var(--color-glass-border)] px-4 py-3">
                <p className="text-2xl font-bold text-degen-400">{manifest?.totalNetworks || 0}</p>
                <p className="text-xs text-[var(--color-muted)]">Networks</p>
              </div>
              <div className="rounded-lg border border-[var(--color-glass-border)] px-4 py-3">
                <p className="text-2xl font-bold text-[var(--color-fg)]">
                  {manifest?.totalRights || 0}
                </p>
                <p className="text-xs text-[var(--color-muted)]">Total Rights</p>
              </div>
              <div className="rounded-lg border border-[var(--color-glass-border)] px-4 py-3">
                <p className="text-2xl font-bold text-degen-400">
                  {manifest?.activeMemberships || 0}
                </p>
                <p className="text-xs text-[var(--color-muted)]">Active</p>
              </div>
              <div className="rounded-lg border border-[var(--color-glass-border)] px-4 py-3">
                <p className="text-2xl font-bold text-[var(--color-fg)]">{attestations.length}</p>
                <p className="text-xs text-[var(--color-muted)]">Attestations</p>
              </div>
            </div>
          </section>

          {/* Manifest hash for verification */}
          {manifest && (
            <section aria-labelledby="heading-manifest">
              <h3
                id="heading-manifest"
                className="mb-3 text-sm font-semibold text-[var(--color-fg)]"
              >
                Verification
              </h3>
              <div className="rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-4 py-3">
                <p className="text-xs text-[var(--color-muted)]">Rights Manifest Hash</p>
                <code className="mt-1 block truncate text-xs text-degen-400">
                  {manifest.manifestHash}
                </code>
                <p className="mt-2 text-[10px] text-[var(--color-muted)]">
                  This hash cryptographically verifies your rights manifest. Share it with anyone
                  who needs to verify your network membership.
                </p>
              </div>
            </section>
          )}
        </div>
      )}

      {/* === Rights Tab ============================================ */}
      {activeTab === 'rights' && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-muted)]">
            Rights are granted permanently and cannot be revoked. Inactive rights are shown dimmed.
          </p>
          {rights.length > 0 ? (
            rights.map((right) => <RightCard key={right.id} right={right} />)
          ) : (
            <p className="rounded-lg border border-[var(--color-glass-border)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
              No rights have been granted yet. Rights are earned through network participation,
              contributions, and achievements.
            </p>
          )}
          {/* Action buttons */}
          <details className="rounded-lg border border-[var(--color-glass-border)]">
            <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)]">
              About Permanent Rights
            </summary>
            <div className="space-y-2 px-4 pb-4 text-xs text-[var(--color-muted)]">
              <p>
                <strong className="text-[var(--color-fg)]">What are Network Rights?</strong>
              </p>
              <p>
                Network rights are permanent, immutable records of your participation in a network.
                Once granted, they cannot be deleted or modified — only marked inactive.
              </p>
              <p>
                <strong className="text-[var(--color-fg)]">Why can't they be deleted?</strong>
              </p>
              <p>
                Rights are append-only by design. This prevents anyone (including us) from erasing
                your history. The fact that &ldquo;wallet X had right Y on date Z&rdquo; is recorded
                forever. This is a feature, not a bug — it guarantees your contributions are
                permanently recognized.
              </p>
              <p>
                <strong className="text-[var(--color-fg)]">Right Types:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  <strong>Membership</strong> — Network membership and identity
                </li>
                <li>
                  <strong>Contribution</strong> — Content contributions and community engagement
                </li>
                <li>
                  <strong>Achievement</strong> — Milestones and earned achievements
                </li>
                <li>
                  <strong>Governance</strong> — DAO participation and voting rights
                </li>
                <li>
                  <strong>Content</strong> — Content licensing and usage rights
                </li>
                <li>
                  <strong>Reputation</strong> — Reputation scores and trust signals
                </li>
              </ul>
            </div>
          </details>
        </div>
      )}

      {/* === Attestations Tab ====================================== */}
      {activeTab === 'attestations' && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-muted)]">
            W3C Verifiable Credentials cryptographically prove your identity on each protocol. Each
            attestation is independently verifiable without DegenFeed.
          </p>
          {attestations.length > 0 ? (
            attestations.map((att) => <AttestationCard key={att.id} att={att} />)
          ) : (
            <p className="rounded-lg border border-[var(--color-glass-border)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
              No attestations created yet. Attestations are automatically created when you link your
              first identity.
            </p>
          )}
        </div>
      )}

      {/* === Identity Tab ========================================== */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          {/* DID Document */}
          <section aria-labelledby="heading-did">
            <h3 id="heading-did" className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Decentralized Identifier (DID)
            </h3>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-5 py-4">
              {didDocument ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">DID</p>
                    <code className="mt-0.5 block text-sm text-degen-400 break-all">
                      {didDocument.id}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">Also Known As</p>
                    {didDocument.alsoKnownAs.length > 0 ? (
                      <ul className="mt-0.5 space-y-1">
                        {didDocument.alsoKnownAs.map((aka) => (
                          <li key={aka}>
                            <code className="text-xs text-[var(--color-fg)] break-all">{aka}</code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">None yet</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-muted)]">Verification Methods</p>
                    <ul className="mt-0.5 space-y-1">
                      {didDocument.verificationMethod.map((vm) => (
                        <li key={vm.id}>
                          <code className="text-xs text-[var(--color-fg)]">
                            {vm.type}
                            {vm.blockchainAccountId
                              ? ` · ${vm.blockchainAccountId.slice(0, 14)}...`
                              : ''}
                          </code>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-muted)]">
                  No DID document found. DIDs are automatically generated when you link your first
                  identity.
                </p>
              )}
            </div>
          </section>

          {/* Portable Bundle */}
          <section aria-labelledby="heading-bundle">
            <h3 id="heading-bundle" className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Portable Identity Bundle
            </h3>
            <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] px-5 py-4">
              {portableBundle ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#00ff41"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14" />
                      <path d="M16.5 22a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z" />
                      <path d="M20 16.5L16.5 13l-2.5 2.5" />
                    </svg>
                    <span className="text-sm text-[var(--color-fg)]">
                      Your identity is portable
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-muted)]">
                    This bundle contains everything needed to prove your identity on any server:
                    your DID Document, protocol identities, and attestation references.
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Connected protocols:{' '}
                    {portableBundle.protocols.map((p) => p.protocol).join(', ') || 'None'}
                  </p>
                  <button
                    type="button"
                    onClick={handleExportBundle}
                    disabled={exporting}
                    className="rounded-xl bg-degen-500/15 px-4 py-2 text-xs font-medium text-degen-400 transition-colors hover:bg-degen-500/25 disabled:opacity-50"
                  >
                    Download Identity Bundle
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--color-muted)]">
                    No portable identity bundle yet. Bundles are generated when you have at least
                    one linked identity and attestation.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Exit Guide link */}
          <section aria-labelledby="heading-exit">
            <h3 id="heading-exit" className="mb-3 text-sm font-semibold text-[var(--color-fg)]">
              Exit Preparation
            </h3>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">🚪</span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-fg)]">
                    You are never locked in
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    Your identity, content, followers, and coins travel with you. If you ever want
                    to leave DegenFeed, you keep everything.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <a
                      href="/docs/EXIT-GUIDE"
                      className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
                    >
                      View Exit Guide
                    </a>
                    <button
                      type="button"
                      onClick={handleFullExport}
                      className="rounded-lg border border-[var(--color-glass-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-overlay)] transition-colors"
                    >
                      Download All Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
