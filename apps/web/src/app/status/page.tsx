export const runtime = 'edge';

/**
 * /status — Protocol health dashboard
 *
 * SSR-fetches /api/feed/health from the worker so the page works without JS
 * and isn't blocked by CORS. Shows last-checked timestamp, per-protocol
 * status (healthy/degraded/down), latency, and a manual refresh button.
 */

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { StatusClient } from './StatusClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Status — DegenFeed',
  description:
    'Live protocol health for Nostr, Farcaster, Lens, Bluesky, Mastodon, Threads, Reddit, and RSS.',
};

interface ProtocolHealth {
  healthy: boolean;
  latencyMs: number;
  error?: string;
}

interface FeedHealthResponse {
  health: Record<string, ProtocolHealth>;
  checkedAt: number;
}

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'app.degenfeed.xyz';
  const protocol = h.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

async function loadHealth(): Promise<FeedHealthResponse | null> {
  try {
    const res = await fetch(`${await getBaseUrl()}/api/feed/health`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-store' },
    });
    if (!res.ok) return null;
    return (await res.json()) as FeedHealthResponse;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const data = await loadHealth();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Protocol Status</h1>
        <p className="mt-1 text-sm text-gray-500">
          Live health checks for every protocol DegenFeed aggregates from.
        </p>
      </header>
      <StatusClient initialData={data} />
    </div>
  );
}
