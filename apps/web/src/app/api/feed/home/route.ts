import { NextResponse } from 'next/server';
import { mockFeedPosts } from '../../_mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ posts: mockFeedPosts });
}
