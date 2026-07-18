export const runtime = 'edge';

/**
 * /status — Protocol health dashboard (public, no login required)
 *
 * SSR-fetches /api/health/protocols from the worker so the page works
 * without JS and isn't blocked by CORS. Shows per-protocol status
 * (up/degraded/down), latency, circuit breaker state, and auto-refresh.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { StatusClient } from './StatusClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Status — DegenFeed',
  description:
    'Live protocol health for Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, RSS, Lemmy, and Ponder.',
  openGraph: {
    title: 'Status — DegenFeed',
    description: 'Live protocol health dashboard for all supported social protocols.',
    url: 'https://app.degenfeed.xyz/status',
    images: [
      {
        url: 'https://app.degenfeed.xyz/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DegenFeed Status',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Status — DegenFeed',
    description: 'Live protocol health dashboard.',
  },
  alternates: { canonical: 'https://app.degenfeed.xyz/status' },
};

export interface ProtocolStatus {
  status: 'up' | 'degraded' | 'down';
  latency: number;
  lastChecked: number;
  circuitBreakerOpen: boolean;
  error?: string;
}

export interface ProtocolsHealthResponse {
  protocols: Record<string, ProtocolStatus>;
  summary: {
    total: number;
    up: number;
    degraded: number;
    down: number;
  };
  checkedAt: number;
}

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'app.degenfeed.xyz';
  const protocol = h.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

async function loadHealth(): Promise<ProtocolsHealthResponse | null> {
  try {
    const res = await fetch(`${await getBaseUrl()}/api/health/protocols`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-store' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ProtocolsHealthResponse;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const data = await loadHealth();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Protocol Status</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Live health checks for every protocol DegenFeed aggregates from. This page is public
          &mdash; share it with users before they report issues.
        </p>
      </header>
      <StatusClient initialData={data} />
    </div>
  );
}
