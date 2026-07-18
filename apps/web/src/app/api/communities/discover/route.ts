/**
 * GET /api/communities/discover — Discover communities across the fediverse.
 *
 * Proxies the discoverCommunities function from @degenfeed/feed-providers
 * to return federated communities matching user interests.
 *
 * Query params:
 *   - category: string (crypto, defi, nft, trading, tech, etc.)
 *   - instance: string (filter by instance domain)
 *   - search: string (text search)
 *   - sort: 'subscribers' | 'active' | 'posts' | 'new'
 *   - min_subs: number
 *   - limit: number (max 100)
 */

import { discoverCommunities } from '@degenfeed/feed-providers';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const instance = searchParams.get('instance') || undefined;
    const search = searchParams.get('search') || undefined;
    const sort = (searchParams.get('sort') || 'subscribers') as
      | 'subscribers'
      | 'active'
      | 'posts'
      | 'new';
    const minSubs = parseInt(searchParams.get('min_subs') || '0', 10) || 0;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);

    const communities = await discoverCommunities({
      category,
      search,
      instance,
      sort,
      minSubs,
      limit,
    });

    // Compute category counts from results
    const categoryCounts: Record<string, number> = {};
    for (const c of communities) {
      categoryCounts[c.niche] = (categoryCounts[c.niche] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      data: communities,
      meta: {
        total: communities.length,
        category: category || null,
        sort,
        minSubs,
        categoryCounts,
        fetchedAt: Date.now(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
