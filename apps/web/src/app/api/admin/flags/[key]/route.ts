import { type NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/log';
import { requireAdmin } from '../../_auth';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const { key } = await params;
  const body = (await request.json()) as { enabled: boolean };

  log('info', `[admin] Flag "${key}" set`, { enabled: body.enabled });

  return NextResponse.json({ ok: true, key, enabled: body.enabled });
}
