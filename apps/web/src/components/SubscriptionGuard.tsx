'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SubscribeButton } from './SubscribeButton';

interface SubscriptionGuardProps {
  creator: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

type AccessState =
  | { status: 'loading' }
  | { status: 'granted' }
  | { status: 'denied' }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: Error };

// 5-minute cache TTL
const CACHE_TTL = 5 * 60 * 1000;

function shortAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function SubscriptionGuard({ creator, children, fallback }: SubscriptionGuardProps) {
  const [access, setAccess] = useState<AccessState>({ status: 'loading' });
  const cacheRef = useRef<{ creator: string; until: number } | null>(null);

  const checkAccess = useCallback(async () => {
    // Check cache first
    const cached = cacheRef.current;
    if (cached && cached.creator === creator && Date.now() < cached.until) {
      setAccess({ status: 'granted' });
      return;
    }

    setAccess({ status: 'loading' });

    try {
      const res = await fetch('/api/subscription/check-content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ creator }),
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 401) {
          setAccess({ status: 'unauthenticated' });
          return;
        }
        // Fail open on unexpected status codes
        console.warn(
          `[SubscriptionGuard] check-content returned ${res.status} for creator=${creator}; failing open`,
        );
        setAccess({ status: 'granted' });
        return;
      }

      const data = (await res.json()) as { hasAccess?: boolean };

      if (data.hasAccess === true) {
        // Cache the positive result
        cacheRef.current = { creator, until: Date.now() + CACHE_TTL };
        setAccess({ status: 'granted' });
      } else {
        setAccess({ status: 'denied' });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      // Fail open: show children if check fails
      console.warn(
        `[SubscriptionGuard] check failed for creator=${creator}: ${error.message}; failing open`,
      );
      setAccess({ status: 'error', error });
    }
  }, [creator]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  // Loading state — skeleton pulse
  if (access.status === 'loading') {
    return (
      <div
        className="relative"
        role="status"
        aria-busy="true"
        aria-label="Checking subscription access"
      >
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-48 animate-pulse rounded-xl bg-[var(--color-muted)]" />
        </div>
      </div>
    );
  }

  // Access granted (or errored — fail open)
  if (access.status === 'granted' || access.status === 'error') {
    return <>{children}</>;
  }

  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }

  const creatorShort = shortAddress(creator);

  // Not authenticated — show sign-in prompt
  if (access.status === 'unauthenticated') {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none blur-sm">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center backdrop-blur-sm">
            <p className="mb-2 text-lg font-bold text-[var(--color-fg)]">Sign in to view</p>
            <p className="mb-4 text-sm text-[var(--color-muted)]">
              Connect your wallet to check access for this content
            </p>
            <span className="inline-block rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm font-medium text-[var(--color-muted)]">
              Sign in to continue
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Denied — show subscription CTA
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <div className="rounded-2xl border border-degen-500/30 bg-[var(--color-card)] p-6 text-center backdrop-blur-sm">
          <p className="mb-2 text-lg font-bold text-[var(--color-fg)]">Subscriber-only content</p>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            Subscribe to {creatorShort} for exclusive access
          </p>
          <SubscribeButton creatorAddress={creator} creatorName={creatorShort} variant="inline" />
        </div>
      </div>
    </div>
  );
}
