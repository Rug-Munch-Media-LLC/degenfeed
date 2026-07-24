import { NextResponse } from 'next/server';
import { getLiveSpaces } from '@degenfeed/spaces-bridge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/spaces/all
 * Aggregated feed of ALL live spaces from every available platform.
 * This is the main endpoint for the unified Spaces UI (/spaces/live).
 * Returns: { spaces: SpaceItem[], total: number, platforms: string[] }
 */
export async function GET() {
  try {
    const spaces = await getLiveSpaces({ timeout: 5000 });
    const platforms = [...new Set(spaces.flatMap((s) => s.platforms.map((p) => p.platform)))];

    return NextResponse.json({
      spaces,
      total: spaces.length,
      platforms,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message, spaces: [], total: 0, platforms: [] },
      { status: 200 },
    );
  }
}
