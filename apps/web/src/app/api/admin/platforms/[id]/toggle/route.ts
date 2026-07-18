import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../_auth';

export const runtime = 'nodejs';

// TODO: Wire to worker backend
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const { id } = await params;
  const body = (await request.json()) as { enabled: boolean };

  console.log(`[admin] Platform "${id}" toggled to ${body.enabled}`);

  return NextResponse.json({ ok: true, platform: id, enabled: body.enabled });
}
