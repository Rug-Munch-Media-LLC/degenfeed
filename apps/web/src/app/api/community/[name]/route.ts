import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { MOCK_COMMUNITIES } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const community = MOCK_COMMUNITIES.find((c) => c.name === slug || c.name === name);

    if (!community) {
      return NextResponse.json({ error: 'Community not found', status: 404 }, { status: 404 });
    }

    return NextResponse.json({ data: { community } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
