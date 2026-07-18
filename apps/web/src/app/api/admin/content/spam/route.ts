import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet } from '../../../_proxy';
import { requireAdmin } from '../../_auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  try {
    const response = await proxyGet('/api/admin/content/spam', request);
    const headers = new Headers(response.headers);
    headers.set('X-Admin-Validated', 'true');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}
