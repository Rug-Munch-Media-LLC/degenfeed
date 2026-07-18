import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { getStats } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET() {
  const stats = getStats();

  return NextResponse.json(
    { stats },
    {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
