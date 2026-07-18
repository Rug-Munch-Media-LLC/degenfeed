import { type NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/log';
import { requireAdmin } from '../../../../_auth';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const { id, action } = await params;

  const validActions = ['confirm', 'false_positive'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  log('info', `[admin] Spam ${id}: ${action}`);

  return NextResponse.json({ ok: true, id, action });
}
