import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ReactSchema = z.object({
  userId: z.string().min(1).max(100),
  emoji: z.string().min(1).max(10),
});

/**
 * POST /api/spaces/[id]/react — Send a reaction
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  void params;
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = ReactSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { userId, emoji } = parsed.data;

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
