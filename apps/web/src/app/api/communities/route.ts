import { NextResponse } from 'next/server';
import { MOCK_COMMUNITIES } from '../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      data: MOCK_COMMUNITIES,
      meta: { total: MOCK_COMMUNITIES.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
