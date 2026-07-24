import { NextResponse } from 'next/server';
import { getLiveSpaces } from '@degenfeed/spaces-bridge';

export const dynamic = 'force-dynamic';

/**
 * GET /api/spaces/list
 * Returns all live spaces from all platforms in a unified format.
 * Supports filter by platform via ?platform=nostr,peertube
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const platformParam = url.searchParams.get('platform');
    const platforms = platformParam
      ? (platformParam.split(',').filter(Boolean) as Array<'nostr' | 'peertube' | 'owncast' | 'livepeer'>)
      : undefined;

    const spaces = await getLiveSpaces({ platforms, timeout: 5000 });
    return NextResponse.json({ spaces, total: spaces.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, spaces: [], total: 0 }, { status: 200 });
  }
}
