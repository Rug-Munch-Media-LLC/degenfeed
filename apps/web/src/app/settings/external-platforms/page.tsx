'use client';

/**
 * Settings: External Platforms
 *
 * Manage connected external social platform accounts.
 * Shows connected accounts, allows disconnect, and provides
 * access to connect new platforms.
 */

import { useCallback, useEffect, useState } from 'react';
import { ConnectPlatformModal } from '../../../components/external-platforms/ConnectPlatformModal';
import { ExternalLiveDashboard } from '../../../components/external-platforms/ExternalLiveDashboard';

// ─── Types ────────────────────────────────────────────────────────────────

interface ConnectedAccount {
  platform: string;
  displayName: string;
  avatarUrl?: string;
  connectedAt: string;
  lastUsedAt?: string;
}

// ─── Account Card ─────────────────────────────────────────────────────────

function AccountCard({
  account,
  onDisconnect,
  platformMeta,
}: {
  account: ConnectedAccount;
  onDisconnect: (platform: string) => void;
  platformMeta: Record<string, { name: string; icon: string }>;
}) {
  const meta = platformMeta[account.platform] ?? {
    name: account.platform,
    icon: '🔌',
  };
  const connectedDate = new Date(account.connectedAt).toLocaleDateString();

  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-4 transition-all hover:border-white/20">
      <div className="flex items-center gap-3">
        <span className="text-2xl" role="img" aria-label={meta.name}>
          {meta.icon}
        </span>
        <div>
          <p className="font-medium text-[var(--color-fg)]">{meta.name}</p>
          <p className="text-sm text-[var(--color-muted)]">{account.displayName}</p>
          <p className="text-xs text-[var(--color-muted)]">
            Connected {connectedDate}
            {account.lastUsedAt && (
              <> · Last used {new Date(account.lastUsedAt).toLocaleDateString()}</>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDisconnect(account.platform)}
        className="rounded-lg border border-red-500/20 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10"
      >
        Disconnect
      </button>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { name: string; icon: string }> = {
  youtube: { name: 'YouTube', icon: '▶️' },
  twitch: { name: 'Twitch', icon: '📺' },
  kick: { name: 'Kick', icon: '🔴' },
  tiktok: { name: 'TikTok', icon: '🎵' },
  instagram: { name: 'Instagram', icon: '📸' },
  linkedin: { name: 'LinkedIn', icon: '💼' },
};

export default function ExternalPlatformsSettingsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [_disconnecting, setDisconnecting] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/external/accounts');
      const data = (await res.json()) as {
        data?: { accounts?: ConnectedAccount[] };
      };
      setAccounts(data.data?.accounts ?? []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const handleDisconnect = useCallback(
    async (platform: string) => {
      setDisconnecting(platform);
      try {
        const res = await fetch('/api/external/disconnect', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform }),
        });
        if (res.ok) {
          await fetchAccounts();
        }
      } catch {
        // Silently fail
      } finally {
        setDisconnecting(null);
      }
    },
    [fetchAccounts],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--color-fg)]">🌐 External Platforms</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Connect YouTube, Twitch, Kick, TikTok, Instagram, and LinkedIn to post, schedule, and go
          live from DegenFeed.
        </p>
      </div>

      {/* Connected Accounts */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-fg)]">Connected Accounts</h2>
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-white/20"
          >
            + Add Platform
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.03]" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-glass-border)] bg-white/[0.02] p-8 text-center">
            <p className="mb-2 text-lg text-[var(--color-fg)]">No external platforms connected</p>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Connect YouTube, Twitch, Kick, TikTok, Instagram, or LinkedIn to start posting across
              the web.
            </p>
            <button
              type="button"
              onClick={() => setShowConnectModal(true)}
              className="rounded-lg bg-white/10 px-6 py-2.5 text-sm font-medium text-[var(--color-fg)] transition-colors hover:bg-white/20"
            >
              Connect Your First Platform
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => (
              <AccountCard
                key={account.platform}
                account={account}
                onDisconnect={handleDisconnect}
                platformMeta={PLATFORM_META}
              />
            ))}
          </div>
        )}
      </section>

      {/* Live Dashboard */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-fg)]">Live Streaming</h2>
        <ExternalLiveDashboard />
      </section>

      {/* Connect Modal */}
      <ConnectPlatformModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onRefresh={fetchAccounts}
      />
    </div>
  );
}
