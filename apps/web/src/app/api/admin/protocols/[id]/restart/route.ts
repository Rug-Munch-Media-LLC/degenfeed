import { type NextRequest, NextResponse } from 'next/server';
import { proxyPost } from '../../../../_proxy';
import { requireAdmin, withAdminHeaders } from '../../../_auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  try {
    return await proxyPost(`/api/admin/protocols/${params.id}/restart`, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, withAdminHeaders({ status: 500 }));
  }
}
