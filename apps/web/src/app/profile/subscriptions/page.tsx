'use client';

import { ErrorBoundary } from '@degenfeed/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

// === Types (matches API response from /api/subscription/my) =====

interface MySubscription {
  creator: string;
  tier: string;
  amount: string;
  startDate: number;
  expiryDate: number;
  daysRemaining: number;
}

interface MySubscriptionsResponse {
  subscriptions: MySubscription[];
}

const TIER_LABELS: Record<string, string> = {
  supporter: 'Supporter',
  member: 'Member',
  patron: 'Patron',
};

const TIER_ICONS: Record<string, string> = {
  supporter: '⭐',
  member: '💎',
  patron: '👑',
};

const TIER_COLORS: Record<string, string> = {
  supporter: 'text-green-400',
  member: 'text-blue-400',
  patron: 'text-purple-400',
};

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<MySubscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/subscription/my', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as MySubscriptionsResponse;
        setSubscriptions(data.subscriptions || []);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/profile"
              className="mb-2 inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              ← Back to profile
            </Link>
            <h1 className="text-2xl font-bold text-[var(--color-fg)]">Your Subscriptions</h1>
            {!loading && (
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                {subscriptions.length} active subscription{subscriptions.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Link
            href="/discover"
            className="rounded-lg bg-degen-500/20 px-3 py-1.5 text-xs font-medium text-degen-400 hover:bg-degen-500/30 transition-colors"
          >
            Discover creators
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse p-4">
                <div className="mb-2 h-4 w-48 rounded bg-[var(--color-muted)]" />
                <div className="mb-2 h-3 w-32 rounded bg-[var(--color-muted)]" />
                <div className="h-3 w-24 rounded bg-[var(--color-muted)]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && subscriptions.length === 0 && (
          <div className="card py-16 text-center">
            <div className="mb-3 text-3xl">💝</div>
            <p className="text-[var(--color-muted)]">No active subscriptions yet.</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Support your favorite creators by subscribing to their content.
            </p>
            <Link href="/discover" className="btn-primary mt-4 inline-block text-sm">
              Find creators
            </Link>
          </div>
        )}

        {/* Subscription list */}
        {!loading && subscriptions.length > 0 && (
          <div className="space-y-3">
            {subscriptions.map((sub) => {
              const colorClass = TIER_COLORS[sub.tier] || 'text-[var(--color-muted)]';
              const tierLabel = TIER_LABELS[sub.tier] || sub.tier;
              const tierIcon = TIER_ICONS[sub.tier] || '⭐';

              return (
                <div key={sub.creator} className="card flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={colorClass}>{tierIcon}</span>
                      <Link
                        href={`/subscribe/${encodeURIComponent(sub.creator)}`}
                        className="text-sm font-semibold text-[var(--color-fg)] hover:text-degen-400 transition-colors truncate"
                      >
                        {shortenAddress(sub.creator)}
                      </Link>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${colorClass}`}
                      >
                        {tierLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--color-muted)]">
                      <span>Since {formatDate(sub.startDate)}</span>
                      <span>Expires {formatDate(sub.expiryDate)}</span>
                      <span className="text-degen-400">
                        {sub.daysRemaining > 0
                          ? `${sub.daysRemaining} day${sub.daysRemaining !== 1 ? 's' : ''} left`
                          : 'Expiring today'}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/subscribe/${encodeURIComponent(sub.creator)}`}
                    className="shrink-0 rounded-lg bg-[var(--color-muted)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-overlay)] hover:text-[var(--color-fg)] transition-colors"
                  >
                    Manage
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Info footer */}
        {!loading && subscriptions.length > 0 && (
          <div className="mt-6 text-center text-[10px] text-[var(--color-muted)]">
            Subscriptions are active for 30 days from confirmation. Renew before expiry to keep your
            benefits.
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
