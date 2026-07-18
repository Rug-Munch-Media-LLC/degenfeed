import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = (await request.json()) as { id?: string; ids?: string[] };

  const approved = body.ids?.length ? body.ids.length : body.id ? 1 : 0;

  console.log(`[admin] Approved ${approved} source(s)`);

  return NextResponse.json({ ok: true, approved });
}
