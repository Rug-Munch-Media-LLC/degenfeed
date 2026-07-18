import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;

  const validActions = ['remove', 'approve', 'feature'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  console.log(`[admin] Content ${id}: ${action}`);

  return NextResponse.json({ ok: true, id, action });
}
