import { NextResponse } from 'next/server';
import { MOCK_PUBLIC_FEEDS as mockPublicFeeds } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ data: { feeds: mockPublicFeeds }, meta: { count: mockPublicFeeds.length } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
