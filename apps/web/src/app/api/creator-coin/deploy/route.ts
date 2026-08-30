import { NextResponse } from 'next/server';
import { z } from 'zod';
export const dynamic = 'force-dynamic';

const DeploySchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(10),
  chain: z.enum(['base', 'solana']).optional(),
  feeConfig: z
    .object({
      creatorFeeBps: z.number().int().min(0).max(2000).optional(),
      platformFeeBps: z.number().int().min(0).max(200).optional(),
    })
    .optional(),
});

/**
 * POST /api/creator-coin/deploy
 *
 * NOT IMPLEMENTED — honest fence.
 *
 * There is no server-side coin deployment pipeline in this app yet: no
 * DegenFeedCoinV4 factory is deployed, and no deployer wallet/factory address
 * is configured. The Creator Studio previously POSTed to a nonexistent
 * `/api/coin/launch`, and the worker backend returned fabricated
 * `0x<random-uuid>` "deployed" addresses persisted for a year. This endpoint
 * refuses honestly instead.
 *
 * When the factory is deployed, wire this route to the factory's
 * `createCoin`/`deployCoin` entrypoint behind the platform wallet, then call
 * `setPlatformFeeBps(feeConfig.platformFeeBps)` and `setReferrer(...)` on the
 * new coin before `initialBuy()` (see DegenFeedCoinV4.sol).
 */
export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = DeploySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error:
        'Creator coin deployment is not implemented — no factory contract is deployed and no deployer key is configured. This endpoint refuses instead of returning a fake contract address.',
      code: 'NOT_IMPLEMENTED',
    },
    { status: 501 },
  );
}
