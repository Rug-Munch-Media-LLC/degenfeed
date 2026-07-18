import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { getNewThisWeekSources } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET() {
  const { sources } = getNewThisWeekSources();

  return NextResponse.json(
    { sources, total: sources.length },
    {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    },
  );
}
