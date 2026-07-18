import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../_auth';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const { id, name } = await params;

  console.log(`[admin] Restarting service "${name}" on server "${id}"`);

  return NextResponse.json({ ok: true });
}
