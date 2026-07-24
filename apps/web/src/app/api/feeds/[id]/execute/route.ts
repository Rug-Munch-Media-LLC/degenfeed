import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/feeds/:id/execute — Proxy to worker's /api/custom-feeds/:id/execute
 * Forwards query params (sort, limit, cursor) for feed execution.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return await proxyGet(`/api/custom-feeds/${id}/execute`, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
