import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/export
 *
 * Accepts a JSON payload of user data (collected client-side from IndexedDB)
 * and returns it as a downloadable JSON archive.
 *
 * Body: { data: Record<string, unknown>, format?: 'json' | 'pretty' }
 *
 * Response: application/json file download with Content-Disposition attachment.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      data?: Record<string, unknown>;
      format?: 'json' | 'pretty';
    };

    if (!body.data || typeof body.data !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid "data" field in request body' },
        { status: 400 },
      );
    }

    const format = body.format === 'pretty' ? 2 : 0;
    const json = JSON.stringify(body.data, null, format);

    // Generate a timestamped filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `degenfeed-data-export-${timestamp}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(Buffer.byteLength(json, 'utf-8')),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
