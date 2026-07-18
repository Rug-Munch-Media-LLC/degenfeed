import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const body = (await request.json()) as { enabled: boolean };

  console.log(`[admin] Flag "${key}" set to ${body.enabled}`);

  return NextResponse.json({ ok: true, key, enabled: body.enabled });
}
