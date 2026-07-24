import { type NextRequest, NextResponse } from 'next/server';
import { proxyGet, proxyPost } from '../../_proxy';
import { requireAdmin, withAdminHeaders } from '../_auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  try {
    const response = await proxyGet('/api/admin/protocols', request);
    const headers = new Headers(response.headers);
    headers.set('X-Admin-Validated', 'true');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, withAdminHeaders({ status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  try {
    return await proxyPost('/api/admin/protocols', request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, withAdminHeaders({ status: 500 }));
  }
}
