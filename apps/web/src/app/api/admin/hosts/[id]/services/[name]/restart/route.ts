import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  const { id, name } = await params;

  console.log(`[admin] Restarting service "${name}" on server "${id}"`);

  return NextResponse.json({ ok: true });
}
