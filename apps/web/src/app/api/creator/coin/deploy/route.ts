/**
 * POST /api/creator/coin/deploy
 *
 * Proxies coin deployment to the Workers API.
 * Accepts creator coin configuration and returns the deployed coin address.
 */

import { CreatorCoinDeploySchema } from '../../../../../lib/validation/schemas';
import { proxyPost } from '../../../_proxy';

export const runtime = 'edge';

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.json();
    const parsed = CreatorCoinDeploySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: parsed.error.flatten() }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }

    return proxyPost('/api/creator/coin/deploy', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
