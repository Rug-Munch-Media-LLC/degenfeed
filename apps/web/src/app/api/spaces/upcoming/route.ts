import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return await proxyGet('/api/spaces/upcoming', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ spaces: [], error: message }, { status: 200 });
  }
}
