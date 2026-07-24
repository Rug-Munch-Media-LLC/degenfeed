import { NextResponse } from 'next/server';
import { getLiveSpaces } from '@degenfeed/spaces-bridge';
import { proxyGet } from '../../_proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Try the worker backend first
    const workerRes = await proxyGet('/api/spaces/live', new Request('http://placeholder'));
    if (workerRes.ok) {
      const data = await workerRes.json();
      return NextResponse.json(data);
    }
    throw new Error('Worker unavailable');
  } catch {
    // Fallback: aggregate directly from all bridges
    try {
      const spaces = await getLiveSpaces({ timeout: 5000 });
      return NextResponse.json({ spaces });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      return NextResponse.json({ error: message, spaces: [] }, { status: 200 });
    }
  }
}
