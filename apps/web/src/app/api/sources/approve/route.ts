import { NextResponse } from 'next/server';
import { log } from '@/lib/log';
// TODO: Wire to worker backend
import { approveSources } from '../../../../lib/source-engine';
import { requireAdmin } from '../../_auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const body = (await request.json()) as { id?: string; ids?: string[] };
  const ids = body.ids ?? (body.id ? [body.id] : []);

  if (ids.length === 0) {
    return NextResponse.json({ error: 'No source IDs provided' }, { status: 400 });
  }

  const result = approveSources(ids);

  log('info', `[admin] Approved ${result.approved} source(s)`);

  return NextResponse.json({ ok: true, approved: result.approved, sources: result.sources });
}
