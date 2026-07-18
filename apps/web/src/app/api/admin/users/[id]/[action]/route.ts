import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;

  const validActions = ['ban', 'suspend', 'warn'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  const body = (await request.json()) as { reason?: string };

  console.log(`[admin] User ${id}: ${action} (reason: ${body.reason || 'none'})`);

  const statusMap: Record<string, string> = {
    ban: 'banned',
    suspend: 'suspended',
    warn: 'warned',
  };

  return NextResponse.json({ ok: true, status: statusMap[action] });
}
