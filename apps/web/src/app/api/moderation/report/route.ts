import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/moderation/report
 *
 * Proxies to the feed-worker backend, which persists the report in the
 * REPORTS KV namespace. Reports survive restarts and surface in the
 * admin moderation surface (GET /api/moderation/reports).
 */
export async function POST(request: NextRequest) {
  try {
    return await proxyPost('/api/moderation/report', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

/**
 * GET /api/moderation/report
 *
 * Returns recent reports from the persistent store (admin surface).
 */
export async function GET(request: NextRequest) {
  try {
    return await proxyGet('/api/moderation/reports', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
