import { NextResponse } from 'next/server';
import { runHealthCheck, cullLowQualitySources, getStats } from '../../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function POST() {
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
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 },
    );
  }
}
