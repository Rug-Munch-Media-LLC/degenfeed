import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    // Proxy to the bridge which handles /api/events/:id internally
    const bridgeUrl = process.env.WORKER_URL
      ?? process.env.NEXT_PUBLIC_WORKER_URL
      ?? process.env.NEXT_PUBLIC_API_BASE
      ?? 'http://localhost:8787';

    const res = await fetch(`${bridgeUrl}/api/events`, {
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch events', status: 502 }, { status: 502 });
    }

    const data = await res.json();
    const events = data.events || [];
    const event = events.find((e: { id: string; url?: string }) =>
      e.id === id || e.url?.includes(id),
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
