import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../../../../_proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/moderation/reports/:id/resolve
 *
 * Proxies to the feed-worker backend, which persists the report status in
 * the REPORTS KV namespace.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return await proxyPost(`/api/moderation/reports/${id}/resolve`, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
