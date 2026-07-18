import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const targets = Array.isArray(body.targets) ? body.targets.filter(Boolean) : [];

    if (!text) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }
    if (targets.length === 0) {
      return NextResponse.json({ error: 'Invalid targets' }, { status: 400 });
    }

    const results: Record<string, { success: boolean; hash?: string }> = {};
    for (const target of targets) {
      results[target] = {
        success: true,
        hash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      };
    }

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
