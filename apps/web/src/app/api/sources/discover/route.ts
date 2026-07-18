import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { runDiscovery } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') || 'all';

  const result = await runDiscovery(platform);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    platform: result.platform,
    discovered: result.discovered,
    autoApproved: result.autoApproved,
    pendingReview: result.pendingReview,
    sources: result.sources,
  });
}
