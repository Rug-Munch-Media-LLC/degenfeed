import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { MOCK_COMMUNITIES_LB } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') || 'all';
    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

    let entries = MOCK_COMMUNITIES_LB;
    if (platform !== 'all') {
      entries = entries.filter((e) => e.platform === platform);
    }
    entries = entries.slice(0, limit);

    return NextResponse.json({
      data: entries.map((e, i) => ({ ...e, rank: i + 1 })),
      meta: { platform, total: MOCK_COMMUNITIES_LB.length, updatedAt: new Date().toISOString() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
