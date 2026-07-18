import { NextResponse } from 'next/server';
import { MOCK_LIVE_SPACES } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ spaces: MOCK_LIVE_SPACES });
}
