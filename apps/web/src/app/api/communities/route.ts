import { NextResponse } from 'next/server';
import { MOCK_COMMUNITIES } from '../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    data: MOCK_COMMUNITIES,
    meta: { total: MOCK_COMMUNITIES.length },
  });
}
