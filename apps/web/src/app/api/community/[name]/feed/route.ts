import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    return await proxyGet(`/api/community/${name}/feed`, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
