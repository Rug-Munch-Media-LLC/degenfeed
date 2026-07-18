import { NextResponse } from 'next/server';
import { MOCK_COMMUNITIES_LB } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') || 'all';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100);

  let entries = MOCK_COMMUNITIES_LB;
  if (platform !== 'all') {
    entries = entries.filter((e) => e.platform === platform);
  }
  entries = entries.slice(0, limit);

  return NextResponse.json({
    entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
    updatedAt: new Date().toISOString(),
  });
}
