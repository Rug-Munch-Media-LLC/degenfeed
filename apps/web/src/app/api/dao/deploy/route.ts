import { NextResponse } from 'next/server';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const DaoDeploySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  symbol: z.string().min(1).max(10).optional(),
});

/**
 * POST /api/dao/deploy
 *
 * NOT IMPLEMENTED — honest fence.
 *
 * Deploying a DAO requires an on-chain DegenFeedDAOFactoryV2 deployment plus a
 * platform factory address + funded deployer key configured server-side. None
 * of that exists yet, so this endpoint refuses instead of fabricating a DAO
 * address. When the factory is deployed, wire this route to
 * `DegenFeedDAOFactoryV2.deployDAO(params)` behind the platform wallet.
 */
export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  // Validate input so callers get schema errors, not silent 501s for garbage.
  const parsed = DaoDeploySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error:
        'DAO deployment is not implemented — no DegenFeedDAOFactoryV2 contract is deployed and no factory address/deployer key is configured. This endpoint refuses instead of returning a fake DAO address.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 },
  );
}
