import { NextResponse } from 'next/server';
import { MOCK_TRENDING } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || 'weekly';
  const platform = url.searchParams.get('platform') || 'all';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  const pool = MOCK_TRENDING[period] ?? MOCK_TRENDING.weekly;
  let entries = pool;
  if (platform !== 'all') {
    entries = entries.filter((e) => e.platform === platform);
  }
  entries = entries.slice(0, limit);

  return NextResponse.json({
    entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
    updatedAt: new Date().toISOString(),
    period,
  });
}
