import { NextResponse } from 'next/server';
import { proxyGet } from '../../../../_proxy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/creator/videos/:id/analytics
 *
 * Fetch analytics for a single video: views over time, tips,
 * source/protocol breakdown, watch time, completion rate.
 * Supports ?days=N for time range (default 30, max 365).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length < 8) {
    return NextResponse.json({ error: 'Invalid video ID' }, { status: 400 });
  }

  const days = Math.min(
    Math.max(Number(new URL(request.url).searchParams.get('days')) || 30, 1),
    365,
  );
  return proxyGet(`/api/creator/videos/${id}/analytics?days=${days}`, request);
}
