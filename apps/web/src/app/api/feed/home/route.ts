import { NextRequest, NextResponse } from 'next/server';
import type { UnifiedPost } from '@degenfeed/types';
import type { MockFeedItem } from '../../_mock-data';
import { mockFeedPosts } from '../../_mock-data';

export const dynamic = 'force-dynamic';

/**
 * Converts a MockFeedItem to the UnifiedPost shape the UI expects.
 */
function toUnifiedPost(item: MockFeedItem): UnifiedPost {
  return {
    id: `${item.protocol}:${item.id}`,
    protocol: item.protocol as UnifiedPost['protocol'],
    author: {
      id: `${item.protocol}:${item.id}`,
      primary: { protocol: item.protocol as UnifiedPost['protocol'], id: item.author.handle },
      handles: { [item.protocol]: item.author.handle },
      displayName: item.author.displayName,
      bio: '',
      avatarUrl: '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: item.text,
    embeds: [],
    createdAt: item.createdAt,
    metrics: { likes: item.likes, reposts: 0, replies: item.replies, quotes: 0 },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: item.likes, reposts: 0, replies: item.replies, quotes: 0 },
    },
    raw: null,
    niches: [],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const protocols = searchParams.get('protocols');
  const sort = searchParams.get('sort');
  const limitParam = searchParams.get('limit');

  // Filter by protocol if specified
  let filtered = mockFeedPosts;
  if (protocols) {
    const requested = protocols.split(',').map((p) => p.trim().toLowerCase());
    filtered = mockFeedPosts.filter((p) =>
      requested.includes(p.protocol.toLowerCase()),
    );
  }

  // Sort
  if (sort === 'new') {
    filtered = [...filtered].sort((a, b) => b.createdAt - a.createdAt);
  } else if (sort === 'quality' || sort === 'hot') {
    filtered = [...filtered].sort((a, b) => b.likes - a.likes);
  }
  // trending — reuse hot sort for mock data

  // Limit
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 25, 100) : 25;
  const data = filtered.slice(0, limit);

  return NextResponse.json({
    data: data.map(toUnifiedPost),
    meta: { total: filtered.length, limit },
  });
}
