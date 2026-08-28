import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '../../_auth';
export const dynamic = 'force-dynamic';

const ExportSchema = z.object({
  data: z.record(z.unknown()),
  format: z.enum(['json', 'pretty']).optional(),
});

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
  const session = await requireSession(request);
  if (session instanceof NextResponse) return session;
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = ExportSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { data: exportData, format: fmt } = parsed.data;

    const format = fmt === 'pretty' ? 2 : 0;
    const json = JSON.stringify(exportData, null, format);

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
