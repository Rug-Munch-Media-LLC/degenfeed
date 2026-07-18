import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { MOCK_UPCOMING_SPACES } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ spaces: MOCK_UPCOMING_SPACES });
}
