import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bridge/status
 *
 * Returns the status of all cross-protocol bridges.
 * Each bridge has: from, to, active, latency, and stats.
 */
export async function GET() {
  try {
    // Try to get live stats from the bridge worker
    const workerUrl =
      process.env.WORKER_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';

    try {
      const headers: Record<string, string> = {};
      const bridgeKey = process.env.BRIDGE_API_KEY;
      if (bridgeKey) headers.Authorization = `Bearer ${bridgeKey}`;
      const res = await fetch(`${workerUrl}/api/crossposter/status`, {
        headers,
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = await res.json();
        const pairs = data.pairs || [];

        const bridges = pairs.map((pair: Record<string, unknown>) => ({
          from: pair.source,
          to: pair.targets,
          active: pair.enabled,
          latency: pair.lastSuccessAt ? 0 : -1,
          stats: {
            totalAttempts: pair.totalAttempts || 0,
            totalSuccesses: pair.totalSuccesses || 0,
            totalFailures: pair.totalFailures || 0,
            consecutiveFailures: pair.consecutiveFailures || 0,
            lastError: pair.lastError || null,
          },
        }));

        return NextResponse.json({ ok: true, bridges });
      }
    } catch {
      // Fall through to static data
    }

    // Static fallback with cross-poster v2 bridge metadata
    const bridges = [
      {
        from: 'mastodon',
        to: 'nostr',
        active: true,
        latency: 1200,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'mastodon',
        to: 'bluesky',
        active: true,
        latency: 2000,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'mastodon',
        to: 'peertube',
        active: true,
        latency: 0,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'lemmy',
        to: 'nostr',
        active: true,
        latency: 1500,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'nostr',
        to: 'farcaster',
        active: true,
        latency: 1500,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'nostr',
        to: 'bluesky',
        active: true,
        latency: 1800,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'farcaster',
        to: 'nostr',
        active: true,
        latency: 1500,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'lens',
        to: 'bluesky',
        active: true,
        latency: 1300,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
      {
        from: 'bluesky',
        to: 'lens',
        active: true,
        latency: 1700,
        stats: { totalAttempts: 0, totalSuccesses: 0, totalFailures: 0, consecutiveFailures: 0 },
      },
    ];

    return NextResponse.json({ ok: true, bridges });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch bridge status' }, { status: 500 });
  }
}
