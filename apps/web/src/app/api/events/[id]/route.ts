import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Proxy to the bridge (injects BRIDGE_API_KEY, matches events/route.ts)
    const res = await proxyGet('/api/events', _request);

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch events', status: 502 }, { status: 502 });
    }

    const data = await res.json();
    const events = data.events || [];
    const event = events.find(
      (e: { id: string; url?: string }) => e.id === id || e.url?.includes(id),
    );

    if (!event) {
      return NextResponse.json({ error: 'Event not found', status: 404 }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
