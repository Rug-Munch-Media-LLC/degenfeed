import { getLiveSpaces } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
