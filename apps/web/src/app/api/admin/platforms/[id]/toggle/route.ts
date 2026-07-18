import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { enabled: boolean };

  console.log(`[admin] Platform "${id}" toggled to ${body.enabled}`);

  return NextResponse.json({ ok: true, platform: id, enabled: body.enabled });
}
