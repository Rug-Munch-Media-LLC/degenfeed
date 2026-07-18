import { NextResponse } from 'next/server';
import { getSourceHealth } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET() {
  const { health } = getSourceHealth();

  return NextResponse.json(
    { health, total: health.length },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    },
  );
}
