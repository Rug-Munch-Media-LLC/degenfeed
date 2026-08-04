import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Search autocomplete endpoint.
 *
 * GET /api/search/autocomplete?q=bit
 *
 * Returns query, creator, and niche suggestions powered by MeiliSearch.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim() ?? '';

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const workerUrl =
      process.env.WORKER_URL ||
      process.env.NEXT_PUBLIC_WORKER_URL ||
      process.env.NEXT_PUBLIC_API_BASE ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:8787';

    // First try: query the backend's autocomplete endpoint
    try {
      const res = await fetch(`${workerUrl}/api/search/autocomplete?q=${encodeURIComponent(q)}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          suggestions?: Array<{ text: string; type: string; source?: string; score: number }>;
        };
        if (data.suggestions && data.suggestions.length > 0) {
          return NextResponse.json({ suggestions: data.suggestions.slice(0, 8) });
        }
      }
    } catch {
      // Fall through to direct MeiliSearch query
    }

    // Second try: query MeiliSearch directly for author/niche suggestions
    const meiliUrl = process.env.MEILISEARCH_URL || 'http://127.0.0.1:7700';
    const meiliKey = process.env.MEILI_SEARCH_KEY || '';

    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (meiliKey) headers.authorization = `Bearer ${meiliKey}`;

      const res = await fetch(`${meiliUrl}/indexes/posts/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          q,
          limit: 5,
          attributesToRetrieve: ['authorName', 'authorHandle', 'niches', 'source'],
        }),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          hits: Array<{
            authorName: string;
            authorHandle: string;
            niches: string[];
            source: string;
          }>;
        };
        const suggestions: Array<{ text: string; type: string; source?: string; score: number }> =
          [];
        const seen = new Set<string>();

        for (const hit of data.hits ?? []) {
          const authorName = hit.authorName || hit.authorHandle;
          if (authorName?.toLowerCase().includes(q.toLowerCase())) {
            const key = `author:${authorName}`;
            if (!seen.has(key)) {
              seen.add(key);
              suggestions.push({
                text: authorName,
                type: 'creator',
                source: hit.source,
                score: 0.7,
              });
            }
          }
          for (const niche of hit.niches ?? []) {
            if (niche.toLowerCase().includes(q.toLowerCase())) {
              const key = `niche:${niche}`;
              if (!seen.has(key)) {
                seen.add(key);
                suggestions.push({
                  text: niche,
                  type: 'query',
                  score: 0.6,
                });
              }
            }
          }
        }

        suggestions.sort((a, b) => b.score - a.score);
        return NextResponse.json({ suggestions: suggestions.slice(0, 8) });
      }
    } catch {
      // MeiliSearch unavailable — return empty
    }

    return NextResponse.json({ suggestions: [] });
  } catch (err) {
    console.error('[autocomplete] Error:', err);
    return NextResponse.json({ suggestions: [] });
  }
}
