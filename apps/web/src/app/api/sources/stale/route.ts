import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { getStaleSources } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET() {
  const { sources } = getStaleSources();

  return NextResponse.json(
    { sources, total: sources.length },
    {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    },
  );
}
