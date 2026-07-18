import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as { id: string };

  console.log(`[admin] Rejected source ${body.id}`);

  return NextResponse.json({ ok: true, id: body.id });
}
