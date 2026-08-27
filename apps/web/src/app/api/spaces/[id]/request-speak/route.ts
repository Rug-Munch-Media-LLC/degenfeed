import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RequestSpeakSchema = z.object({
  userId: z.string().min(1).max(100),
  displayName: z.string().max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

/**
 * POST /api/spaces/[id]/request-speak — Request to become a speaker
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = RequestSpeakSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { userId, displayName, avatarUrl } = parsed.data;

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
