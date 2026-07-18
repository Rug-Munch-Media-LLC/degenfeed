import { NextResponse } from 'next/server';
import { getPendingSources } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET() {
  const { sources, total } = getPendingSources();

  return NextResponse.json(
    { sources, total },
    {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
