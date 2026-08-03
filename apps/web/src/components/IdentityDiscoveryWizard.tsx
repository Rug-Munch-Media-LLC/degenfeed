'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

/* ─── Types ───────────────────────────────────────────────────── */

interface DiscoveredIdentity {
  protocol: string;
  label: string;
  identity: Record<string, unknown>;
  confidence: 'verified' | 'inferred';
  method: string;
  linkable: boolean;
}

interface DiscoveryResult {
  discovered: DiscoveredIdentity[];
  alreadyLinked: string[];
  walletAddress: string;
  scannedProtocols: string[];
  scanDurationMs: number;
  lastDiscovery?: number | null;
}

type DiscoveryStep = 'idle' | 'scanning' | 'results' | 'linking' | 'done' | 'error';

interface IdentityDiscoveryWizardProps {
  walletAddress: string | null;
  /** Called when linking completes */
  onComplete?: (linkedCount: number) => void;
  /** Called when user dismisses */
  onDismiss?: () => void;
  /** Show as inline card vs full modal */
  variant?: 'modal' | 'inline' | 'onboarding';
}

/* ─── Protocol Metadata ───────────────────────────────────────── */

const PROTOCOL_META: Record<
  string,
  { name: string; icon: string; color: string; description: string }
> = {
  farcaster: {
    name: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    description: 'Web3 social protocol',
  },
  lens: { name: 'Lens', icon: '◎', color: '#abfe2c', description: 'Decentralized social graph' },
  nostr: { name: 'Nostr', icon: '⚡', color: '#8b5cf6', description: 'Relay-based network' },
  bluesky: { name: 'Bluesky', icon: '☁', color: '#1185fe', description: 'AT Protocol network' },
  mastodon: { name: 'Mastodon', icon: '🐘', color: '#6364ff', description: 'Fediverse' },
  ens: { name: 'ENS', icon: '𐞥', color: '#5299ff', description: 'Ethereum Name Service' },
  telegram: { name: 'Telegram', icon: '✈', color: '#0088cc', description: 'Messaging' },
  reddit: { name: 'Reddit', icon: '🔴', color: '#ff4500', description: 'Social news' },
  twitter: { name: 'Twitter/X', icon: '𝕏', color: '#000000', description: 'Social media' },
  github: { name: 'GitHub', icon: '⌘', color: '#333333', description: 'Code hosting' },
};

/* ─── Scanning Animation ──────────────────────────────────────── */

function ScanningAnimation({ message, progress }: { message: string; progress: number }) {
  const dots = useRef(['', '.', '..', '...']).current;
  const [dotIdx, setDotIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotIdx((i) => (i + 1) % dots.length);
    }, 400);
    return () => clearInterval(interval);
  }, [dots.length]);

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Animated scanner */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-degen-500/20" />
        <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-t-degen-500 border-r-degen-500/60" />
        <div className="absolute inset-4 rounded-full bg-degen-500/10" />
        <span className="relative text-3xl">🔍</span>
      </div>

      <div className="text-center">
        <p className="text-base font-semibold text-[var(--color-fg)]">
          Scanning your connected identities
          <span className="tabular-nums">{dots[dotIdx]}</span>
        </p>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{message}</p>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-degen-500 to-purple-500 transition-all duration-500"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Scanning {DISCOVERY_PROTOCOLS.length} protocols...
      </p>
    </div>
  );
}

const DISCOVERY_PROTOCOLS = ['Farcaster', 'Lens', 'Nostr', 'Bluesky', 'ENS', 'Telegram'];

/* ─── Results Display ─────────────────────────────────────────── */

function IdentityCard({
  item,
  onLink,
  onIgnore,
  isLinking,
}: {
  item: DiscoveredIdentity & { linkable?: boolean };
  onLink: () => void;
  onIgnore: () => void;
  isLinking: boolean;
}) {
  const meta = PROTOCOL_META[item.protocol] || {
    name: item.protocol,
    icon: '🔗',
    color: '#666',
    description: '',
  };

  const isVerified = item.confidence === 'verified';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-3 transition-all hover:border-degen-500/20">
      {/* Protocol icon */}
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ background: `${meta.color}18`, color: meta.color }}
      >
        {meta.icon}
      </span>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-fg)]">{meta.name}</span>
          {isVerified ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-degen-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-degen-400">
              <svg
                aria-hidden="true"
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="mr-0.5"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Verified
            </span>
          ) : (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
              Suggested
            </span>
          )}
        </div>
        <p className="truncate text-xs text-[var(--color-muted)]">{item.label}</p>
        {!isVerified && (
          <p className="mt-0.5 text-[9px] text-amber-400">
            Found via {item.method.replace(/_/g, ' ')}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onLink}
          disabled={isLinking}
          className="rounded-lg bg-degen-500/10 px-3 py-1.5 text-xs font-semibold text-degen-400 transition-all hover:bg-degen-500/20 disabled:opacity-50"
        >
          {isLinking ? 'Linking...' : item.linkable === false ? 'Linked' : 'Link'}
        </button>
        <button
          type="button"
          onClick={onIgnore}
          className="rounded-lg px-2 py-1.5 text-xs font-medium text-[var(--color-muted)] transition-all hover:bg-red-500/10 hover:text-red-400"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/* ─── Grouped Results ─────────────────────────────────────────── */

function ResultsGroup({
  title,
  items,
  onLink,
  onIgnore,
  linkingIds,
}: {
  title: string;
  items: Array<DiscoveredIdentity & { id?: string }>;
  onLink: (idx: number) => void;
  onIgnore: (idx: number) => void;
  linkingIds: Set<number>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {title}
      </h4>
      {items.map((item, idx) => (
        <IdentityCard
          key={`${item.protocol}-${idx}`}
          item={item}
          onLink={() => onLink(idx)}
          onIgnore={() => onIgnore(idx)}
          isLinking={linkingIds.has(idx)}
        />
      ))}
    </div>
  );
}

/* ─── Already Linked Section ──────────────────────────────────── */

function AlreadyLinkedBadge({ protocols }: { protocols: string[] }) {
  if (protocols.length === 0) return null;

  return (
    <div className="rounded-xl border border-degen-500/10 bg-degen-500/[0.03] p-3">
      <p className="mb-1.5 text-xs font-medium text-degen-400">
        🔗 Already linked ({protocols.length})
      </p>
      <div className="flex flex-wrap gap-1">
        {protocols.map((p) => (
          <span
            key={p}
            className="inline-flex items-center gap-1 rounded-full bg-degen-500/10 px-2 py-0.5 text-[10px] font-medium text-degen-400"
          >
            {PROTOCOL_META[p]?.icon || '🔗'} {PROTOCOL_META[p]?.name || p}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────── */

export function IdentityDiscoveryWizard({
  walletAddress,
  onComplete,
  onDismiss,
  variant = 'modal',
}: IdentityDiscoveryWizardProps) {
  const [step, setStep] = useState<DiscoveryStep>('idle');
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [linkableItems, setLinkableItems] = useState<
    Array<DiscoveredIdentity & { linkable: boolean }>
  >([]);
  const [linkingIds, setLinkingIds] = useState<Set<number>>(new Set());
  const [linkedCount, setLinkedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [_seenBefore, setSeenBefore] = useState(false);
  const abortRef = useRef(false);

  // Check if we've already run discovery
  useEffect(() => {
    if (!walletAddress || variant !== 'onboarding') return;

    (async () => {
      try {
        const res = await api.get<{ data: { canDiscover: boolean; lastDiscovery: number | null } }>(
          '/api/identity/discovery/status',
        );
        if (res.success && res.data?.data) {
          setSeenBefore(res.data.data.lastDiscovery !== null);
        }
      } catch {
        // ignore
      }
    })();
  }, [walletAddress, variant]);

  const startDiscovery = useCallback(async () => {
    if (!walletAddress) return;

    setStep('scanning');
    setProgress(0);
    setProgressMessage('Initializing discovery...');
    setErrorMessage('');
    abortRef.current = false;

    // Simulate progress updates while waiting for the API
    const progressMessages = [
      'Scanning ENS for linked identities...',
      'Checking Farcaster for verified wallet...',
      'Searching Lens Protocol for your profile...',
      'Scanning Nostr relays for your identity...',
      'Checking Bluesky for your account...',
      'Cross-referencing identities across protocols...',
    ];

    // Start the API call
    const apiPromise = api.post<{ data: DiscoveryResult }>('/api/identity/discover');

    // Update progress while waiting
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(95, p + 2);
        const msgIdx = Math.min(
          progressMessages.length - 1,
          Math.floor((next / 100) * progressMessages.length),
        );
        setProgressMessage(progressMessages[msgIdx]);
        return next;
      });
    }, 600);

    try {
      const res = await apiPromise;
      clearInterval(progressInterval);

      if (abortRef.current) return;

      if (!res.success || !res.data) {
        setStep('error');
        setErrorMessage(res.error || 'Discovery failed');
        return;
      }

      const result = res.data.data;
      setDiscoveryResult(result);
      setProgress(100);
      setProgressMessage('Discovery complete!');

      // Build linkable items (filter out already linked)
      const items = result.discovered.map((d) => ({
        ...d,
        linkable: !result.alreadyLinked.includes(d.protocol),
      }));
      setLinkableItems(items);

      // Auto-advance to results after a brief pause
      setTimeout(() => {
        if (!abortRef.current) {
          setStep('results');
        }
      }, 500);
    } catch (err) {
      clearInterval(progressInterval);
      setStep('error');
      setErrorMessage(String(err));
    }
  }, [walletAddress]);

  const handleLink = useCallback(
    async (idx: number) => {
      const item = linkableItems[idx];
      if (!item?.linkable) return;

      // Link single identity
      setLinkingIds((prev) => new Set(prev).add(idx));

      try {
        const res = await api.post<{ success: boolean }>('/api/identity/link', {
          protocol: item.protocol,
          identity: item.identity,
        });

        if (res.success) {
          setLinkedCount((c) => c + 1);
          setLinkableItems((prev) =>
            prev.map((d, i) => (i === idx ? { ...d, linkable: false } : d)),
          );
        }
      } catch {
        // ignore
      } finally {
        setLinkingIds((prev) => {
          const next = new Set(prev);
          next.delete(idx);
          return next;
        });
      }
    },
    [linkableItems],
  );

  const handleLinkAll = useCallback(async () => {
    if (!linkableItems.some((d) => d.linkable)) return;

    setStep('linking');

    try {
      const res = await api.post<{ data: { linked: number } }>('/api/identity/link-all', {
        discovered: linkableItems.filter((d) => d.linkable),
      });

      if (res.success && res.data?.data) {
        setLinkedCount((c) => c + (res.data.data?.linked ?? 0));
        setLinkableItems((prev) => prev.map((d) => ({ ...d, linkable: false })));

        setTimeout(() => {
          setStep('done');
        }, 500);
      } else {
        setStep('error');
        setErrorMessage(res.error || 'Failed to link identities');
      }
    } catch (err) {
      setStep('error');
      setErrorMessage(String(err));
    }
  }, [linkableItems]);

  const handleIgnore = useCallback((idx: number) => {
    setLinkableItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], linkable: false };
      return next;
    });
  }, []);

  // Auto-start for onboarding variant
  useEffect(() => {
    if (variant === 'onboarding' && walletAddress && step === 'idle') {
      startDiscovery();
    }
  }, [variant, walletAddress, step, startDiscovery]);

  const handleDismiss = useCallback(() => {
    abortRef.current = true;
    onDismiss?.();
  }, [onDismiss]);

  const containerClass =
    variant === 'modal'
      ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'
      : '';

  const cardClass =
    variant === 'modal'
      ? 'mx-4 w-full max-w-lg rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-bg)] p-6 shadow-2xl'
      : 'rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-card)] p-6';

  return (
    <div className={containerClass}>
      <div className={cardClass}>
        {/* ── Header ── */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🆔</span>
            <h3 className="text-base font-bold text-[var(--color-fg)]">Discover Identities</h3>
          </div>
          {variant === 'modal' && (
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg p-1.5 text-[var(--color-muted)] transition-all hover:bg-[var(--color-glass-border)]"
            >
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* ── IDLE ── */}
        {step === 'idle' && variant !== 'onboarding' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-purple-500/10">
              <span className="text-2xl">🔗</span>
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              Discover your identities across Farcaster, Lens, Nostr, Bluesky, ENS, and more.
            </p>
            <button
              type="button"
              onClick={startDiscovery}
              className="btn-primary press-effect px-6 py-2 text-sm"
            >
              Start Discovery
            </button>
          </div>
        )}

        {/* ── SCANNING ── */}
        {step === 'scanning' && <ScanningAnimation message={progressMessage} progress={progress} />}

        {/* ── RESULTS ── */}
        {step === 'results' && discoveryResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-degen-500/10 to-purple-500/5 px-3 py-2">
              <span className="text-xs font-medium text-[var(--color-fg)]">
                Found {linkableItems.filter((d) => d.linkable).length} new identities
              </span>
              <span className="text-[10px] text-[var(--color-muted)]">
                Scanned {discoveryResult.scannedProtocols.length} protocols in{' '}
                {(discoveryResult.scanDurationMs / 1000).toFixed(1)}s
              </span>
            </div>

            {/* Already linked */}
            <AlreadyLinkedBadge protocols={discoveryResult.alreadyLinked} />

            {/* Verified identities */}
            <ResultsGroup
              title="✅ Verified"
              items={linkableItems.filter((d) => d.confidence === 'verified' && d.linkable)}
              onLink={handleLink}
              onIgnore={handleIgnore}
              linkingIds={linkingIds}
            />

            {/* Suggested identities */}
            <ResultsGroup
              title="💡 Suggested"
              items={linkableItems.filter((d) => d.confidence === 'inferred' && d.linkable)}
              onLink={handleLink}
              onIgnore={handleIgnore}
              linkingIds={linkingIds}
            />

            {/* Empty state */}
            {linkableItems.filter((d) => d.linkable).length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm text-[var(--color-muted)]">
                  All identities are already linked to your account.
                </p>
              </div>
            )}

            {/* Actions */}
            {linkableItems.filter((d) => d.linkable).length > 0 && (
              <div className="flex gap-2 pt-2">
                {variant === 'onboarding' && (
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex-1 rounded-xl border border-[var(--color-glass-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-muted)] transition-all hover:bg-[var(--color-glass-border)]"
                  >
                    Skip
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLinkAll}
                  className="btn-primary flex-1 px-4 py-2.5 text-sm"
                >
                  Link All ({linkableItems.filter((d) => d.linkable).length})
                </button>
              </div>
            )}

            {linkableItems.filter((d) => d.linkable).length === 0 && variant === 'onboarding' && (
              <button
                type="button"
                onClick={() => {
                  setStep('done');
                  onComplete?.(0);
                }}
                className="btn-primary w-full px-4 py-2.5 text-sm"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* ── LINKING ── */}
        {step === 'linking' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-degen-500/20" />
              <span className="relative text-2xl">🔗</span>
            </div>
            <p className="text-sm font-medium text-[var(--color-fg)]">
              Linking identities to your wallet...
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-degen-500/20 to-emerald-500/10">
              <span className="text-2xl">🎉</span>
            </div>
            <p className="text-base font-semibold text-[var(--color-fg)]">
              {linkedCount > 0
                ? `Linked ${linkedCount} ${linkedCount === 1 ? 'identity' : 'identities'}!`
                : 'All identities already linked!'}
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              Your unified profile is ready. Content from all your protocols will appear in your
              feed.
            </p>
            {(variant === 'onboarding' || variant === 'modal') && (
              <button
                type="button"
                onClick={() => {
                  onComplete?.(linkedCount);
                  handleDismiss();
                }}
                className="btn-primary mt-2 px-8 py-2.5 text-sm"
              >
                {variant === 'onboarding' ? "Let's Go! →" : 'Done'}
              </button>
            )}
          </div>
        )}

        {/* ── ERROR ── */}
        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
              <span className="text-xl">⚠️</span>
            </div>
            <p className="text-sm font-medium text-red-400">
              {errorMessage || 'Discovery failed. Please try again.'}
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl border border-[var(--color-glass-border)] px-4 py-2 text-sm font-medium text-[var(--color-muted)]"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={startDiscovery}
                className="btn-primary px-4 py-2 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── Footer hint ── */}
        {step === 'results' && (
          <p className="mt-3 text-center text-[9px] text-[var(--color-muted)]">
            Identities are cached for 1 hour. Run discovery again later to find new connections.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Discovery Status Badge (for settings/profile) ──────────── */

export function DiscoveryStatusBadge({
  walletAddress,
  onRefresh,
}: {
  walletAddress: string | null;
  onRefresh?: () => void;
}) {
  const [result, setResult] = useState<{
    lastDiscovery: number | null;
    discoveredCount: number;
    alreadyLinkedCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await api.get<{
        data: {
          lastDiscovery: number | null;
          cachedResult: { discoveredCount: number; alreadyLinkedCount: number } | null;
        };
      }>('/api/identity/discovery/status');
      if (res.success && res.data?.data) {
        setResult({
          lastDiscovery: res.data.data.lastDiscovery,
          discoveredCount: res.data.data.cachedResult?.discoveredCount || 0,
          alreadyLinkedCount: res.data.data.cachedResult?.alreadyLinkedCount || 0,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    check();
  }, [check]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-glass-border)] px-2 py-1 text-[10px] text-[var(--color-muted)]">
        Loading...
      </span>
    );
  }

  if (!result) return null;

  const hoursAgo = result.lastDiscovery
    ? Math.floor((Date.now() - result.lastDiscovery) / 3600000)
    : null;

  return (
    <button
      type="button"
      onClick={onRefresh || check}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--color-glass-border)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-muted)] transition-all hover:bg-degen-500/10 hover:text-degen-400"
      title={`Last discovered: ${hoursAgo !== null ? `${hoursAgo}h ago` : 'Never'}. ${result.discoveredCount} new, ${result.alreadyLinkedCount} linked.`}
    >
      🔍{' '}
      {result.discoveredCount > 0
        ? `${result.discoveredCount} to link`
        : hoursAgo !== null
          ? `Discovered ${hoursAgo}h ago`
          : 'Not yet scanned'}
    </button>
  );
}

/* ─── Compact Inline Trigger ──────────────────────────────────── */

interface DiscoveryTriggerProps {
  walletAddress: string | null;
  className?: string;
}

export function DiscoveryTrigger({ walletAddress, className = '' }: DiscoveryTriggerProps) {
  const [showWizard, setShowWizard] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowWizard(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-degen-500/10 to-purple-500/10 px-3 py-2 text-xs font-semibold text-degen-400 transition-all hover:from-degen-500/20 hover:to-purple-500/20 ${className}`}
      >
        🔗 Discover Linked Identities
      </button>

      {showWizard && walletAddress && (
        <IdentityDiscoveryWizard
          walletAddress={walletAddress}
          variant="modal"
          onComplete={() => setShowWizard(false)}
          onDismiss={() => setShowWizard(false)}
        />
      )}
    </>
  );
}
