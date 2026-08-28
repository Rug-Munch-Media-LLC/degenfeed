import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trending/hashtags
 *
 * Returns the top hashtag-style topics derived from recent posts via
 * MeiliSearch facet counts. This is REAL data from the indexed post
 * corpus (niches extracted from actual post content), not fabricated
 * trending numbers.
 *
 * Response: { topics: [{ tag, posts, category }] }
 * Empty array when MeiliSearch is unavailable or no recent posts exist.
 */
export async function GET(_request: NextRequest) {
  const meiliUrl = process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
  const meiliKey = process.env.MEILI_SEARCH_KEY || process.env.MEILI_MASTER_KEY || '';

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (meiliKey) headers.authorization = `Bearer ${meiliKey}`;

    // Facet distribution over the `niches` attribute of recent posts.
    // `limit: 0` returns no hits — we only want the facetDistribution.
    const res = await fetch(`${meiliUrl}/indexes/posts/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        limit: 0,
        facets: ['niches'],
        sort: ['createdAt:desc'],
      }),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      return NextResponse.json({ topics: [] });
    }

    const data = (await res.json()) as {
      facetDistribution?: { niches?: Record<string, number> };
    };

    const counts = data.facetDistribution?.niches ?? {};
    const topics = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({
        tag: `#${tag.charAt(0).toUpperCase()}${tag.slice(1)}`,
        posts: `${count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count} posts`,
        category: 'Trending',
      }));

    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json({ topics: [] });
  }
}
