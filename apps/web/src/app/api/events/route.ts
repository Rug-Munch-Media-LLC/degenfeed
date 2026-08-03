import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events — Unified events feed from all protocols.
 * Query params: limit, protocols, categories, dateFrom, dateTo, location, query
 */
export async function GET(request: NextRequest) {
  try {
    return await proxyGet('/api/events', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * POST /api/events — Not supported on the list endpoint
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Use POST /api/events/create instead', status: 405 },
    { status: 405 },
  );
}
