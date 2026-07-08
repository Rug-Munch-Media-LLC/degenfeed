import type { UnifiedPost } from '@degenfeed/types';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import NewsLoading from './loading';
import NewsClient from './NewsClient';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

interface NewsApiResponse {
  data?: unknown[];
  meta?: {
    total: number;
    limit: number;
    category: string;
    query?: string;
    mustRead: boolean;
    trending: Array<{ topic: string; count: number; score: number }>;
    sourceCounts: Record<string, number>;
    fetchedAt: number;
    sources: number;
  };
  error?: string;
}

async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('host') || 'app.degenfeed.xyz';
  const protocol = h.get('x-forwarded-proto') || 'https';
  return `${protocol}://${host}`;
}

async function NewsData() {
  const url = `${await getBaseUrl()}/api/feed/news?limit=50`;
  const res = await fetch(url, {
    credentials: 'include',
    next: { revalidate: 0 },
    cache: 'no-store',
    headers: { 'cache-control': 'no-store' },
  });
  const json = (await res.json()) as NewsApiResponse;
  const initialPosts = (json.data || []) as UnifiedPost[];

  return <NewsClient initialPosts={initialPosts} initialMeta={json.meta || null} />;
}

export default function NewsPage() {
  return (
    <Suspense fallback={<NewsLoading />}>
      <NewsData />
    </Suspense>
  );
}
