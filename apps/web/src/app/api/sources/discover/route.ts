import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') || 'all';

  const discovered = Math.floor(Math.random() * 20) + 5;
  const autoApproved = Math.floor(discovered * 0.3);
  const pendingReview = discovered - autoApproved;

  return NextResponse.json({
    success: true,
    platform,
    discovered,
    autoApproved,
    pendingReview,
    sources: [],
  });
}
