import { NextResponse } from 'next/server';
import { checkAllGates } from '@degenfeed/spaces-bridge';
import type { SpaceGating } from '@degenfeed/spaces-bridge';

export const dynamic = 'force-dynamic';

/**
 * POST /api/spaces/[id]/gate — Check if user can access a premium space
 * Body: { userId, userAddress (optional) }
 * Response: { allowed, reason, gates }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { userId, userAddress, gating } = body;

    if (!gating) {
      return NextResponse.json({ allowed: true, reason: 'No gating configured' });
    }

    const result = await checkAllGates(userId || 'anon', userAddress, gating as SpaceGating);
    return NextResponse.json({ ...result, spaceId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gate check failed';
    return NextResponse.json({ allowed: false, error: message }, { status: 500 });
  }
}
