import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * POST /api/events/atproto/rsvp — RSVP to a Smoke Signal event.
 */
export async function POST(request: NextRequest) {
  try {
    return await proxyPost('/api/events/atproto/rsvp', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
