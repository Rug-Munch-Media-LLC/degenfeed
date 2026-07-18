import { NextResponse } from 'next/server';
import { PLATFORM_TRENDING } from './_mock-trending';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trending/per-platform
 *
 * Returns trending posts, topics, channels, and creators per social platform.
 * Query params: platform, category, time
 * Response shape: { data: { platform, posts, topics, channels, creators, fetchedAt }, meta: { platform, category, timeWindow, totalPosts } }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') || 'farcaster';
    const category = searchParams.get('category') || 'all';
    const timeWindow = searchParams.get('time') || 'today';

    const data = PLATFORM_TRENDING[platform];
    if (!data) {
      return NextResponse.json(
        { error: `Unsupported platform: ${platform}`, status: 400 },
        { status: 400 },
      );
    }

    // Filter by category
    let filteredPosts = data.posts;
    if (category !== 'all') {
      filteredPosts = data.posts.filter((p) => p.topic?.toLowerCase() === category.toLowerCase());
    }

    // Sort by engagement score, limit to 20
    const sortedPosts = [...filteredPosts].sort((a, b) => b.engagementScore - a.engagementScore);

    return NextResponse.json({
      data: {
        ...data,
        posts: sortedPosts.slice(0, 20),
      },
      meta: {
        platform,
        category,
        timeWindow,
        totalPosts: filteredPosts.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
