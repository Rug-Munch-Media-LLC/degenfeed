import { getLiveSpaces } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdateSpaceSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

/**
 * GET /api/spaces/[id] — Get space details
 * Searches across all platforms for the space.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const spaces = await getLiveSpaces({ timeout: 3000 });
    const space = spaces.find((s) => s.id === id);
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }
    return NextResponse.json({ space });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/spaces/[id] — Update space metadata
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = UpdateSpaceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = await request.json();
    return NextResponse.json({
      space: { id, ...body },
      ok: true,
      message: 'Space updated (stub)',
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
