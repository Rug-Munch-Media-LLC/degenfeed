import { NextResponse } from 'next/server';
import { MOCK_COMMUNITIES } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const community = MOCK_COMMUNITIES.find((c) => c.name === slug || c.name === name);

  if (!community) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 });
  }

  return NextResponse.json({ community });
}
