import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/spaces/[id]/recording — Get recording URL for a past space
 * Searches across all platforms for the recording.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Stub: In production, query each platform's recording API
  return NextResponse.json({
    recording: {
      id,
      url: null,
      ready: false,
      duration: 0,
      platforms: [] as string[],
    },
  });
}
