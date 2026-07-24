import { NextResponse } from 'next/server';
import { getLiveSpaces } from '@degenfeed/spaces-bridge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/streams/live
 * Legacy endpoint — returns all live streams/spaces from all platforms.
 * Maintained for backward compatibility with existing bridge consumers.
 */
export async function GET() {
  try {
    const spaces = await getLiveSpaces({ timeout: 5000 });
    return NextResponse.json({
      streams: spaces,
      total: spaces.length,
      platforms: [...new Set(spaces.flatMap((s) => s.platforms.map((p) => p.platform)))],
      fetchedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, streams: [], total: 0 }, { status: 200 });
  }
}
