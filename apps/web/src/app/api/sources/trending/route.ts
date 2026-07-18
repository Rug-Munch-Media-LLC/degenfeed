import { NextResponse } from 'next/server';
import { getTrendingSources } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET() {
  const { trending } = getTrendingSources(10);

  return NextResponse.json(
    { trending },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    },
  );
}
