import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // TODO: Wire to worker backend
    const bridges = [
      { from: 'nostr', to: 'farcaster', active: true, latency: 1200 },
      { from: 'farcaster', to: 'nostr', active: true, latency: 1500 },
      { from: 'nostr', to: 'bluesky', active: true, latency: 2000 },
      { from: 'bluesky', to: 'nostr', active: true, latency: 1800 },
      { from: 'lens', to: 'farcaster', active: true, latency: 900 },
      { from: 'farcaster', to: 'lens', active: true, latency: 1100 },
      { from: 'nostr', to: 'mastodon', active: true, latency: 1600 },
      { from: 'mastodon', to: 'nostr', active: true, latency: 1400 },
      { from: 'lens', to: 'bluesky', active: true, latency: 1300 },
      { from: 'bluesky', to: 'lens', active: true, latency: 1700 },
    ];

    return NextResponse.json({ ok: true, bridges });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch bridge status' }, { status: 500 });
  }
}
