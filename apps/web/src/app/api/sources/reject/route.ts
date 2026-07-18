import { NextResponse } from 'next/server';
import { log } from '@/lib/log';
// TODO: Wire to worker backend
import { rejectSources } from '../../../../lib/source-engine';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; ids?: string[] };
  const ids = body.ids ?? (body.id ? [body.id] : []);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No source IDs provided' }, { status: 400 });
  }

  const result = rejectSources(ids);

  log('info', `[admin] Rejected ${result.rejected} source(s)`);

  return NextResponse.json({ ok: true, rejected: result.rejected });
}
