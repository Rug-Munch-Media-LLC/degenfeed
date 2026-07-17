/**
 * POST /api/moderation/report
 *
 * Accepts a moderation report for a post and logs it.
 * In production this would fan out to a moderation queue / database.
 * For now we store reports in-memory (singleton) — they are visible
 * on the server but reset on each cold start.
 */

export const runtime = 'edge';

import { NextResponse } from 'next/server';

interface ReportEntry {
  postId: string;
  reason: string;
  description?: string;
  reportedAt: number;
  ipHash?: string;
}

/** In-memory report log (resets per worker instance — fine for MVP) */
const reports: ReportEntry[] = [];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      postId?: string;
      reason?: string;
      description?: string;
    };

    if (!body.postId || typeof body.postId !== 'string') {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }

    const REASONS = ['spam', 'harassment', 'scam', 'nsfw', 'other'];
    if (!body.reason || !REASONS.includes(body.reason)) {
      return NextResponse.json(
        { error: `reason must be one of: ${REASONS.join(', ')}` },
        { status: 400 },
      );
    }

    const entry: ReportEntry = {
      postId: body.postId,
      reason: body.reason,
      description: body.description?.slice(0, 1000),
      reportedAt: Date.now(),
    };

    reports.push(entry);

    // TODO: In production, fan out to a moderation queue (KV / Postgres / ClickHouse)
    // and optionally notify moderators.

    return NextResponse.json({ ok: true, reportId: `${entry.reportedAt}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid request' },
      { status: 400 },
    );
  }
}

/**
 * GET /api/moderation/report
 *
 * Returns recent reports. Not exposed in the UI — useful for debugging.
 */
export async function GET() {
  return NextResponse.json({ reports: reports.slice(-50) });
}
