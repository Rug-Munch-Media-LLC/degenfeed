'use client';

/**
 * @degenfeed/ui — CrossPlatformSetup
 *
 * UI component for cross-platform account registration.
 * Shows all 5 supported platforms with registration status.
 * Free users see "Pro feature" badges; premium users can create accounts.
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────

export type RegistrationPlatform = 'farcaster' | 'lens' | 'bluesky' | 'mastodon' | 'nostr';

export type RegistrationStatus = 'pending' | 'created' | 'failed';

export interface PlatformAccount {
  platform: RegistrationPlatform;
  status: RegistrationStatus;
  username?: string;
  error?: string;
  txHash?: string;
  accountInfo?: Record<string, string>;
}

export interface PlatformStatus {
  registered: boolean;
  username: string | null;
}

export interface RegisterPlatformStatusData {
  accounts: PlatformAccount[];
  platformStatus: Record<string, PlatformStatus>;
  connectedCount: number;
  totalPlatforms: number;
  isPremium: boolean;
  tier: string | null;
}

export interface CrossPlatformSetupProps {
  /** Wallet address of the current user */
  walletAddress: string;
  /** Whether the user is premium (overrides API check) */
  isPremium?: boolean;
  /** Callback when accounts are fetched */
  onAccountsLoaded?: (accounts: PlatformAccount[]) => void;
  /** Callback after successful registration */
  onRegistered?: (result: PlatformAccount) => void;
  /** Callback when the "Upgrade" button is clicked (instead of navigating to /premium) */
  onUpgrade?: () => void;
  /** Custom API base URL */
  apiBase?: string;
}

// ─── Platform metadata ────────────────────────────────────────────────

const PREMIUM_PLATFORMS = new Set<RegistrationPlatform>(['farcaster', 'lens', 'bluesky']);
const FREE_PLATFORMS = new Set<RegistrationPlatform>(['mastodon', 'nostr']);

const PLATFORM_META: Record<RegistrationPlatform, {
  label: string;
  icon: string;
  color: string;
  description: string;
  fee: string;
  requiresPremium: boolean;
}> = {
  farcaster: {
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    description: 'Decentralized social protocol',
    fee: 'Gas covered',
    requiresPremium: true,
  },
  lens: {
    label: 'Lens',
    icon: '◎',
    color: '#00501e',
    description: 'Web3 social graph',
    fee: 'Gas covered',
    requiresPremium: true,
  },
  bluesky: {
    label: 'Bluesky',
    icon: '☁',
    color: '#1185fe',
    description: 'AT Protocol social',
    fee: 'Free',
    requiresPremium: true,
  },
  mastodon: {
    label: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    description: 'Fediverse social',
    fee: 'Free',
    requiresPremium: false,
  },
  nostr: {
    label: 'Nostr',
    icon: '⚡',
    color: '#8b5cf6',
    description: 'Relay-based protocol',
    fee: 'Free',
    requiresPremium: false,
  },
};

// ─── Component ────────────────────────────────────────────────────────

export function CrossPlatformSetup({
  walletAddress,
  isPremium: propIsPremium,
  onAccountsLoaded,
  onRegistered,
  onUpgrade,
  apiBase = '',
}: CrossPlatformSetupProps) {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [statusData, setStatusData] = useState<RegisterPlatformStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registeringFor, setRegisteringFor] = useState<RegistrationPlatform | null>(null);
  const [usernameInputs, setUsernameInputs] = useState<Partial<Record<RegistrationPlatform, string>>>({});

  const isPremium = propIsPremium ?? statusData?.isPremium ?? false;

  // ── Fetch status ──────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBase}/api/register-platform/status`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in required');
          return;
        }
        const errData = await res.json().catch(() => ({ error: 'Failed to load status' })) as { error?: string };
        setError(errData.error || 'Failed to load status');
        return;
      }

      const json = await res.json() as { data: RegisterPlatformStatusData };
      setStatusData(json.data);
      setAccounts(json.data.accounts || []);
      onAccountsLoaded?.(json.data.accounts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [apiBase, onAccountsLoaded]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Register on platform ──────────────────────────────────────

  const handleRegister = useCallback(async (platform: RegistrationPlatform) => {
    const desiredUsername = usernameInputs[platform]?.trim();
    if (!desiredUsername) return;

    setRegisteringFor(platform);

    try {
      const res = await fetch(`${apiBase}/api/register-platform`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platform, username: desiredUsername }),
      });

      const json = await res.json() as { data: PlatformAccount; error?: string };

      if (!res.ok || json.data?.status === 'failed') {
        const errMsg = json.data?.error || json.error || 'Registration failed';

        // Update the account in the list
        setAccounts((prev) => [
          ...prev.filter((a) => a.platform !== platform),
          { platform, status: 'failed', error: errMsg },
        ]);

        setError(errMsg);
        return;
      }

      // Success
      const result: PlatformAccount = {
        platform: json.data.platform,
        status: 'created',
        username: json.data.username,
        txHash: json.data.txHash,
        accountInfo: json.data.accountInfo,
      };

      setAccounts((prev) => [...prev.filter((a) => a.platform !== platform), result]);
      setUsernameInputs((prev) => ({ ...prev, [platform]: '' }));
      onRegistered?.(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setAccounts((prev) => [
        ...prev.filter((a) => a.platform !== platform),
        { platform, status: 'failed', error: 'Network error' },
      ]);
    } finally {
      setRegisteringFor(null);
    }
  }, [apiBase, usernameInputs, onRegistered]);

  // ── Derived state ─────────────────────────────────────────────

  const connectedCount = accounts.filter((a) => a.status === 'created').length;
  const connectedPlatformNames = accounts
    .filter((a) => a.status === 'created')
    .map((a) => a.platform);

  // ── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
          <span className="ml-3 text-sm text-[var(--color-muted)]">Loading platform status...</span>
        </div>
      </div>
    );
  }

  if (error && !accounts.length) {
    return (
      <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-[var(--color-fg)]">Cross-Platform Setup</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Create accounts on all major social platforms from one place
          </p>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-lg font-bold text-[var(--color-fg)]">{connectedCount}</span>
            <span className="text-sm text-[var(--color-muted)]">/{statusData?.totalPlatforms ?? 5}</span>
            <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider">Connected</p>
          </div>
          {/* Progress bar */}
          <div className="h-12 w-1 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
            <div
              className="bg-degen-500 rounded-full transition-all duration-500"
              style={{
                height: `${(connectedCount / (statusData?.totalPlatforms ?? 5)) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Platform list ── */}
      <div className="space-y-3">
        {(Object.entries(PLATFORM_META) as [RegistrationPlatform, typeof PLATFORM_META[RegistrationPlatform]][]).map(
          ([platform, meta]) => {
            const account = accounts.find((a) => a.platform === platform);
            const isConnected = account?.status === 'created';
            const isFailed = account?.status === 'failed';
            const isPending = account?.status === 'pending' && !isFailed;
            const isRegistering = registeringFor === platform;
            const usernameInput = usernameInputs[platform] || '';

            return (
              <div
                key={platform}
                className={`rounded-xl border p-4 transition-colors ${
                  isConnected
                    ? 'border-green-500/30 bg-green-500/5'
                    : isFailed
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-[var(--color-glass-border)] bg-[var(--color-overlay)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Platform info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0" aria-hidden="true">
                      {meta.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-fg)]" style={{ color: meta.color }}>
                          {meta.label}
                        </span>
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                            </svg>
                            Created
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-400">
                            Failed
                          </span>
                        )}
                        {!isConnected && !isFailed && meta.requiresPremium && !isPremium && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            Pro feature
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-muted)] mt-0.5">
                        {isConnected && account?.username
                          ? `@${account.username}`
                          : isFailed && account?.error
                            ? account.error
                            : meta.description}
                      </p>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0 ml-3">
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                        </svg>
                        Connected
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="username"
                          value={usernameInput}
                          onChange={(e) =>
                            setUsernameInputs((prev) => ({ ...prev, [platform]: e.target.value }))
                          }
                          disabled={isRegistering || (meta.requiresPremium && !isPremium)}
                          className="w-28 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-2.5 py-1.5 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-muted)] disabled:opacity-40 focus:outline-none focus:border-degen-500/50"
                        />
                        <button
                          type="button"
                          onClick={() => handleRegister(platform)}
                          disabled={(meta.requiresPremium && !isPremium) || !usernameInput.trim() || isRegistering}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            !meta.requiresPremium || isPremium
                              ? 'bg-degen-500/15 text-degen-400 hover:bg-degen-500/25 border border-degen-500/30 disabled:opacity-40 disabled:cursor-not-allowed'
                              : 'bg-[var(--color-glass-border)] text-[var(--color-muted)] cursor-not-allowed opacity-40'
                          }`}
                        >
                          {isRegistering ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-degen-400 border-t-transparent" />
                              Creating...
                            </>
                          ) : (
                            'Create'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fee info — show for all when user is premium, or just free platforms */}
                {!isConnected && (isPremium || !meta.requiresPremium) && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--color-muted)]">
                    <span className="rounded bg-[var(--color-glass-border)] px-1.5 py-0.5">{meta.fee}</span>
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>

      {/* ── Global error ── */}
      {error && (
        <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Upgrade prompt ── */}
      {!isPremium && (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--color-fg)]">Upgrade to Pro</p>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                Create accounts on all platforms with one click. We cover gas fees.
              </p>
            </div>
            {onUpgrade ? (
              <button
                type="button"
                onClick={onUpgrade}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 px-4 py-2 text-sm font-medium transition-colors"
              >
                Upgrade
              </button>
            ) : (
              <a
                href="/premium"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 px-4 py-2 text-sm font-medium transition-colors"
              >
                Upgrade
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Bulk create for premium ── */}
      {isPremium && connectedCount < 5 && (
        <div className="mt-4 border-t border-[var(--color-glass-border)] pt-4">
          <p className="text-xs text-[var(--color-muted)] mb-2">
            {connectedCount}/5 platforms connected
          </p>
          <div className="h-1.5 rounded-full bg-[var(--color-glass-border)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-degen-500 to-purple-500 transition-all duration-500"
              style={{ width: `${(connectedCount / 5) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
