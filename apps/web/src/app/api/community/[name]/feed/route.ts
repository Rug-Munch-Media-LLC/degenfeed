import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { getMockFeed } from '../../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const feed = getMockFeed(name.toLowerCase());

    return NextResponse.json({
      data: feed,
      meta: { total: feed.length, name },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
