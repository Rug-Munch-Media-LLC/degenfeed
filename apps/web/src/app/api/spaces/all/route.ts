import { getContentType, getLiveSpaces } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/spaces/all
 * Aggregated feed of ALL live content from every available platform.
 * This is the main endpoint for the unified Live Hub (/spaces/live).
 *
 * Returns: { spaces: SpaceItem[], total: number, platforms: string[], counts: { audio, video, photos } }
 */
export async function GET() {
  try {
    const spaces = await getLiveSpaces({ timeout: 5000 });

    // Enrich each space with content type
    const enriched = spaces.map((space) => {
      if (!space.contentType && space.platforms.length > 0) {
        const mainPlatform = space.platforms[0].platform;
        return { ...space, contentType: getContentType(mainPlatform) };
      }
      return space;
    });

    const platforms = [...new Set(enriched.flatMap((s) => s.platforms.map((p) => p.platform)))];

    // Count by content type
    const counts: Record<string, number> = {
      audio: enriched.filter((s) => s.contentType === 'audio' || !s.contentType).length,
      video: enriched.filter((s) => s.contentType === 'video').length,
      photos: enriched.filter((s) => s.contentType === 'photos').length,
    };

    return NextResponse.json({
      spaces: enriched,
      total: enriched.length,
      platforms,
      counts,
      fetchedAt: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { error: message, spaces: [], total: 0, platforms: [], counts: {} },
      { status: 200 },
    );
  }
}
