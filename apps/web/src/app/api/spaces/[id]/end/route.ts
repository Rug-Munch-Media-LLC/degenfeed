import { endSpace, getLiveSpaces } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const EndSchema = z.object({
  hostId: z.string().optional(),
});

/**
 * POST /api/spaces/[id]/end — End a space (host only)
 * Ends the space across all platforms it's active on.
 * Saves the recording URL if available.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = EndSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const hostId = parsed.data.hostId;

    // Find the space
    const spaces = await getLiveSpaces({ timeout: 3000 });
    const space = spaces.find((s) => s.id === id);

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Verify host
    if (hostId && space.hostId !== hostId && !space.coHosts.includes(hostId)) {
      return NextResponse.json({ error: 'Only the host can end the space' }, { status: 403 });
    }

    // End across all platforms
    await endSpace(space);

    return NextResponse.json({
      ok: true,
      space: {
        ...space,
        status: 'ended',
        endedAt: Date.now(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to end space';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
