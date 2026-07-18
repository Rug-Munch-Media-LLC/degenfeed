import { NextResponse } from 'next/server';
import { getMockFeed } from '../../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const feed = getMockFeed(name.toLowerCase());

  return NextResponse.json({
    data: feed,
    meta: { total: feed.length, name },
  });
}
