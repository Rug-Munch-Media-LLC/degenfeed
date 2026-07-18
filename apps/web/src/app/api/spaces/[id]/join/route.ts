import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({ space: { id, listeners: Math.floor(Math.random() * 500) + 1 }, ok: true });
}
