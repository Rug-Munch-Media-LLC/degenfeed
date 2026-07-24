import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/spaces/[id]/request-speak — Request to become a speaker
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { userId, displayName, avatarUrl } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Simulate speaker addition
    return NextResponse.json({
      ok: true,
      space: {
        id,
        speakers: [
          {
            id: userId,
            displayName: displayName || 'Speaker',
            avatarUrl,
            isHost: false,
            isCoHost: false,
            speaking: false,
          },
        ],
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
