import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return await proxyGet('/api/identity/profile', request);
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to resolve identity profile' }, { status: 500 });
  }
}
