import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const { id, action } = await params;

  const validActions = ['confirm', 'false_positive'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
  }

  console.log(`[admin] Spam ${id}: ${action}`);

  return NextResponse.json({ ok: true, id, action });
}
