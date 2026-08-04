import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/spaces/[id]/react — Send a reaction
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  void params;
  try {
    const body = await request.json();
    const { userId, emoji } = body;
    if (!userId || !emoji) {
      return NextResponse.json({ error: 'userId and emoji required' }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      reaction: {
        userId,
        emoji: emoji.trim(),
        createdAt: Date.now(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
}
