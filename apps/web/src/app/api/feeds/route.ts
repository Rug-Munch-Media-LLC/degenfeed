import { NextResponse } from 'next/server';
import { mockCustomFeeds, mockPublicFeeds } from '../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      data: {
        myFeeds: mockCustomFeeds,
        publicFeeds: mockPublicFeeds,
      },
      meta: { customCount: mockCustomFeeds.length, publicCount: mockPublicFeeds.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(
      { data: { ok: true, feed: { id: 'new-feed', ...body } } },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: message, status: 400 }, { status: 400 });
  }
}
