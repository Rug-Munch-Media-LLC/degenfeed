import { NextResponse } from 'next/server';
// TODO: Wire to worker backend
export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  console.log(`[moderation] Post removed for report ${id}`);

  return NextResponse.json({ ok: true, id, action: 'post_removed' });
}
