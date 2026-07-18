import { NextResponse } from 'next/server';
import { mockPublicFeeds } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ feeds: mockPublicFeeds });
}
