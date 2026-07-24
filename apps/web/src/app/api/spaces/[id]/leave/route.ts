import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/spaces/[id]/leave — Leave a space
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({
    space: { id, listeners: Math.max(0, Math.floor(Math.random() * 500)) },
    ok: true,
  });
}
