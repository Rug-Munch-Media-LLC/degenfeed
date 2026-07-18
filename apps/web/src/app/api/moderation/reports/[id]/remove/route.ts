import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  console.log(`[moderation] Post removed for report ${id}`);

  return NextResponse.json({ ok: true, id, action: 'post_removed' });
}
