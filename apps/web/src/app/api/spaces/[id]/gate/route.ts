import type { SpaceGating } from '@degenfeed/spaces-bridge';
import { checkAllGates } from '@degenfeed/spaces-bridge';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const GateSchema = z.object({
  userId: z.string().max(100).optional(),
  userAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
  gating: z.enum(['public', 'token-gated', 'followers']).optional(),
});

// Map the client-facing gating selector to the bridge's SpaceGating config.
// `followers` has no direct bridge equivalent; 'subscription' is the closest
// membership gate. Unknown selectors default to `none` (always allowed).
const GATING_MAP: Record<string, SpaceGating> = {
  public: { type: 'none' },
  'token-gated': { type: 'token' },
  followers: { type: 'subscription' },
};

/**
 * POST /api/spaces/[id]/gate — Check if user can access a premium space
 * Body: { userId, userAddress (optional) }
 * Response: { allowed, reason, gates }
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = GateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { userId, userAddress, gating } = parsed.data;

    if (!gating) {
      return NextResponse.json({ allowed: true, reason: 'No gating configured' });
    }

    const result = await checkAllGates(
      userId || 'anon',
      userAddress,
      GATING_MAP[gating] ?? { type: 'none' },
    );
    return NextResponse.json({ ...result, spaceId: id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gate check failed';
    return NextResponse.json({ allowed: false, error: message }, { status: 500 });
  }
}
