import { NextResponse } from 'next/server';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const CommunitySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(48),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = CommunitySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Not yet implemented — see ROADMAP.md
    return NextResponse.json(
      { error: 'Community creation not yet available', status: 501 },
      { status: 501 },
    );
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
