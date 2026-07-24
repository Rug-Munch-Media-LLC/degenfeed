import { type NextRequest, NextResponse } from 'next/server';
// TODO: Wire to worker backend
import { cullLowQualitySources, getStats, runHealthCheck } from '../../../../../lib/source-engine';
import { requireAdmin } from '../../_auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  try {
    // Run health check
    const healthResult = runHealthCheck();

    // Cull low-quality sources
    const cullResult = cullLowQualitySources();

    // Get updated stats
    const stats = getStats();

    return NextResponse.json({
      success: true,
      checked: healthResult.checked,
      stale: healthResult.stale,
      culled: cullResult.culled,
      activeSources: stats.activeSources,
      pendingCount: stats.pendingCount,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
