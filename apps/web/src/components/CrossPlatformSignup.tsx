'use client';

/**
 * @components/CrossPlatformSignup — One-click account creation flow.
 *
 * Integrates with the /api/register-platform endpoint to create accounts
 * on supported platforms. Shows credential cards after success, progress
 * tracking, and "login elsewhere" recommendations.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePremium } from '../hooks/usePremium';
import { useAuth } from './AuthProvider';
import {
  CredentialCard,
  CredentialSecurityNote,
  CredentialsProgressBanner,
  registrationToCredential,
} from './CredentialsDisplay';
import { PremiumPaymentModal } from './PremiumPaymentModal';
import { useToast } from './Toast';

// ─── Types ────────────────────────────────────────────────────────────────

interface PlatformMeta {
  id: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  instanceUrl: string;
  requiresPremium: boolean;
}

interface RegistrationResult {
  platform: string;
  status: 'pending' | 'created' | 'failed';
  username?: string;
  error?: string;
  accountInfo?: Record<string, string>;
}

interface PlatformStatus {
  registered: boolean;
  username: string | null;
}

interface RegistrationStatusData {
  accounts: RegistrationResult[];
  platformStatus: Record<string, PlatformStatus>;
  connectedCount: number;
  totalPlatforms: number;
  isPremium: boolean;
  tier: string | null;
}

// ─── Platform config ──────────────────────────────────────────────────────

const SIGNUP_PLATFORMS: PlatformMeta[] = [
  {
    id: 'mastodon',
    label: 'Mastodon / GoToSocial',
    icon: '🐘',
    color: '#6364ff',
    description: 'Create a free account on social.degenfeed.xyz',
    instanceUrl: 'social.degenfeed.xyz',
    requiresPremium: false,
  },
  {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    description: 'Generate a new Nostr keypair',
    instanceUrl: 'Decentralized relays',
    requiresPremium: false,
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '☁',
    color: '#1185fe',
    description: 'Create a Bluesky account (invite code from pool)',
    instanceUrl: 'bsky.social',
    requiresPremium: true,
  },
  {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    description: 'On-chain Farcaster account ($5 reg fee covered by Pro)',
    instanceUrl: 'Farcaster Hub',
    requiresPremium: true,
  },
  {
    id: 'lens',
    label: 'Lens Protocol',
    icon: '◎',
    color: '#abfe2c',
    description: 'Lens profile on Polygon',
    instanceUrl: 'Lens Protocol',
    requiresPremium: true,
  },
];

// ─── Username input ───────────────────────────────────────────────────────

function PlatformSignupForm({
  onSignup,
  loading,
}: {
  platform: PlatformMeta;
  onSignup: (username: string) => void;
  loading: boolean;
}) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().length >= 2) {
      onSignup(username.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Choose a username..."
        disabled={loading}
        minLength={2}
        maxLength={30}
        pattern="[a-zA-Z0-9_\-.]{2,30}"
        className="min-w-0 flex-1 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-card)] px-3 py-2 text-sm text-[var(--color-fg)] placeholder-[var(--color-muted)] focus:border-degen-500 focus:outline-none disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading || username.trim().length < 2}
        className="shrink-0 rounded-lg bg-degen-500 px-3 py-2 text-xs font-bold text-black transition-all hover:bg-degen-400 hover:shadow-[0_0_12px_var(--color-accent-glow)] disabled:opacity-40"
      >
        {loading ? (
          <span className="flex items-center gap-1.5">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-black/30 border-t-black/80" />
            Creating...
          </span>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

interface CrossPlatformSignupProps {
  /** If true, shows compact version for sidebar/widget use */
  compact?: boolean;
  /** Called after any successful registration */
  onRegistrationComplete?: () => void;
}

export function CrossPlatformSignup({
  compact = false,
  onRegistrationComplete,
}: CrossPlatformSignupProps) {
  const { walletAddress } = useAuth();
  const { isPremium, loading: premiumLoading } = usePremium();
  const { showToast } = useToast();

  // Registration state
  const [statusData, setStatusData] = useState<RegistrationStatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [signingUp, setSigningUp] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [results, setResults] = useState<RegistrationResult[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch registration status
  const fetchStatus = useCallback(async () => {
    if (!walletAddress) {
      setLoadingStatus(false);
      return;
    }
    try {
      const res = await fetch('/api/register-platform/status', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as { data: RegistrationStatusData };
        setStatusData(data.data);
        setResults(data.data.accounts ?? []);
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setLoadingStatus(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Premium gate redirect
  const handlePremiumRequired = useCallback(() => {
    setShowPaymentModal(true);
  }, []);

  // Handle signup
  const handleSignup = useCallback(
    async (platformId: string, username: string) => {
      if (!walletAddress) {
        showToast('error', 'Connect your wallet first');
        return;
      }

      const platform = SIGNUP_PLATFORMS.find((p) => p.id === platformId);
      if (!platform) return;

      // Check premium
      if (platform.requiresPremium && !isPremium) {
        setShowPaymentModal(true);
        return;
      }

      setSigningUp(platformId);
      setErrors((prev) => ({ ...prev, [platformId]: '' }));

      try {
        const res = await fetch('/api/register-platform', {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ platform: platformId, username }),
        });

        const data = (await res.json()) as {
          data?: RegistrationResult;
          error?: string;
          upgrade?: boolean;
        };

        if (!res.ok) {
          if (data.upgrade) {
            setShowPaymentModal(true);
            setSigningUp(null);
            return;
          }
          const errMsg = data.error || `Registration failed (${res.status})`;
          setErrors((prev) => ({ ...prev, [platformId]: errMsg }));
          showToast('error', errMsg);
          setSigningUp(null);
          return;
        }

        // Success
        const result = data.data!;
        setResults((prev) => [...prev.filter((r) => r.platform !== platformId), result]);

        if (result.status === 'created') {
          showToast(
            'success',
            `🎉 ${platform.label} account created! Your credentials are ready below.`,
          );
        } else if (result.status === 'failed') {
          setErrors((prev) => ({
            ...prev,
            [platformId]: result.error || 'Registration failed',
          }));
          showToast('error', result.error || 'Registration failed');
        }

        // Refresh status
        await fetchStatus();
        onRegistrationComplete?.();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        setErrors((prev) => ({ ...prev, [platformId]: msg }));
        showToast('error', msg);
      } finally {
        setSigningUp(null);
      }
    },
    [walletAddress, isPremium, fetchStatus, showToast, onRegistrationComplete],
  );

  // Merge results with status data
  const connectedCount = statusData?.connectedCount ?? 0;
  const totalPlatforms = statusData?.totalPlatforms ?? 5;

  const registeredPlatforms = useMemo(() => {
    const set = new Set(results.filter((r) => r.status === 'created').map((r) => r.platform));
    return set;
  }, [results]);

  const credentialCards = useMemo(() => {
    return results
      .filter((r) => r.status === 'created')
      .map((r) => registrationToCredential(r))
      .filter(Boolean) as NonNullable<ReturnType<typeof registrationToCredential>>[];
  }, [results]);

  // ── Loading state ──
  if (!walletAddress) {
    return (
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-4 text-center text-sm text-[var(--color-muted)]">
        Connect your wallet to create accounts.
      </div>
    );
  }

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-degen-500 border-t-transparent" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <CredentialsProgressBanner
          connectedCount={connectedCount}
          totalPlatforms={totalPlatforms}
        />
        {credentialCards.length > 0 && (
          <>
            <div className="space-y-3">
              {credentialCards.map((card) => (
                <CredentialCard key={card.platform} credential={card} />
              ))}
            </div>
            <CredentialSecurityNote />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-bold text-[var(--color-fg)]">
          Cross-Platform Account Creation
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Create accounts on all supported platforms with one click. Your credentials are encrypted
          and stored securely.
        </p>
      </div>

      {/* ── Premium status bar ── */}
      {!premiumLoading && !isPremium && (
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-sm" aria-hidden="true">
              ⚡
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-fg)]">
                Some platforms require Pro
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Bluesky, Farcaster, and Lens registration require a Pro subscription ($10/mo).
                Mastodon and Nostr are free.
              </p>
            </div>
            <a
              href="/premium"
              className="shrink-0 rounded-lg bg-degen-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-degen-400 transition-colors"
            >
              Upgrade
            </a>
          </div>
        </div>
      )}

      {/* ── Progress banner ── */}
      <CredentialsProgressBanner connectedCount={connectedCount} totalPlatforms={totalPlatforms} />

      {/* ── Platform cards ── */}
      <div className="space-y-3">
        {SIGNUP_PLATFORMS.map((platform) => {
          const registered = registeredPlatforms.has(platform.id);
          const signingUpThis = signingUp === platform.id;
          const error = errors[platform.id];
          const needsPremium = platform.requiresPremium && !isPremium;

          return (
            <div
              key={platform.id}
              className={`overflow-hidden rounded-xl border transition-all ${
                registered
                  ? 'border-degen-500/20 bg-degen-500/[0.03]'
                  : 'border-[var(--color-glass-border)] bg-[var(--color-card)]'
              }`}
            >
              {/* Platform header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl" aria-hidden="true">
                  {platform.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[var(--color-fg)]">
                      {platform.label}
                    </span>
                    {registered && (
                      <span className="rounded-full bg-degen-500/15 px-2 py-0.5 text-[9px] font-medium text-degen-400">
                        ✓ Connected
                      </span>
                    )}
                    {needsPremium && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-medium text-amber-400">
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {platform.description}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted)]/60 font-mono">
                    {platform.instanceUrl}
                  </p>
                </div>
                {needsPremium && !registered && (
                  <button
                    type="button"
                    onClick={handlePremiumRequired}
                    className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </div>

              {/* Signup form (if not registered) */}
              {!registered && !needsPremium && (
                <div className="border-t border-[var(--color-glass-border)] px-4 py-3">
                  <PlatformSignupForm
                    platform={platform}
                    onSignup={(username) => handleSignup(platform.id, username)}
                    loading={signingUpThis}
                  />
                  {error && <p className="mt-1.5 text-[10px] text-red-400">{error}</p>}
                </div>
              )}

              {/* Registration pending message */}
              {registered && (
                <div className="border-t border-[var(--color-glass-border)] px-4 py-2">
                  <p className="text-[11px] text-[var(--color-muted)]">
                    ✓ Account created. See credentials below.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Credential cards ── */}
      {credentialCards.length > 0 && (
        <>
          <div>
            <h3 className="mb-3 text-base font-bold text-[var(--color-fg)]">
              Your Portable Credentials
            </h3>
            <p className="mb-3 text-xs text-[var(--color-muted)]">
              Use these credentials to login on any{' '}
              {credentialCards.length === 1 ? `${credentialCards[0]?.label}` : 'compatible'} app.
              You own this account.
            </p>
            <div className="space-y-3">
              {credentialCards.map((card) => (
                <CredentialCard key={card.platform} credential={card} />
              ))}
            </div>
          </div>

          <CredentialSecurityNote />
        </>
      )}

      {/* ── Empty state ── */}
      {credentialCards.length === 0 && !loadingStatus && (
        <div className="rounded-xl border border-dashed border-[var(--color-glass-border)] bg-[var(--color-card)] p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-degen-500/10 text-xl text-degen-400">
            +
          </div>
          <h3 className="mb-1 text-sm font-bold text-[var(--color-fg)]">No accounts created yet</h3>
          <p className="mx-auto max-w-sm text-xs text-[var(--color-muted)]">
            Create accounts above to unlock cross-protocol posting and portable credentials you can
            use anywhere.
          </p>
        </div>
      )}

      {/* ── Payment modal ── */}
      <PremiumPaymentModal
        open={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          fetchStatus();
        }}
        onSuccess={() => {
          setShowPaymentModal(false);
          fetchStatus();
        }}
      />
    </div>
  );
}

// ─── Mini signup widget (for sidebar/protocol pages) ──────────────────────

export function CrossPlatformSignupMini() {
  const { walletAddress } = useAuth();
  const [statusData, setStatusData] = useState<RegistrationStatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }
    fetch('/api/register-platform/status', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((d: { data: RegistrationStatusData }) => {
        setStatusData(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  if (loading) return null;

  const connected = statusData?.connectedCount ?? 0;
  const total = statusData?.totalPlatforms ?? 5;

  if (connected >= total) return null; // All done

  return (
    <div className="rounded-xl border border-degen-500/10 bg-gradient-to-br from-degen-500/[0.04] to-transparent p-3">
      <div className="flex items-center gap-2">
        <span className="text-degen-400 text-sm">🚀</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--color-fg)]">
            {connected}/{total} platforms connected
          </p>
          <p className="text-[10px] text-[var(--color-muted)]">
            Create the remaining {total - connected} to post everywhere.
          </p>
        </div>
        <a
          href="/settings"
          className="shrink-0 rounded-lg bg-degen-500/15 px-2.5 py-1 text-[10px] font-medium text-degen-400 transition-colors hover:bg-degen-500/25"
        >
          Setup
        </a>
      </div>
    </div>
  );
}
