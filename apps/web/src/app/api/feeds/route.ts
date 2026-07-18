import { NextResponse } from 'next/server';
import { mockCustomFeeds, mockPublicFeeds } from '../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    myFeeds: mockCustomFeeds,
    publicFeeds: mockPublicFeeds,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(
    { ok: true, feed: { id: 'new-feed', ...body } },
    { status: 201 },
  );
}
