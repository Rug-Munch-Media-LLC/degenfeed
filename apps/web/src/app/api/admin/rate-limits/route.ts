import { type NextRequest, NextResponse } from 'next/server';
import { requireAdmin, withAdminHeaders } from '../_auth';

export const runtime = 'nodejs';

// Mirrors the config in src/middleware.ts — enforced via token bucket
const RATE_LIMITS = [
  { endpoint: '/api/* (global)', limit: 100, window: '60 s', current: 0, status: 'ok' as const },
  { endpoint: 'POST /api/auth/*', limit: 5, window: '60 s', current: 0, status: 'ok' as const },
  {
    endpoint: 'POST /api/tip/create',
    limit: 10,
    window: '60 s',
    current: 0,
    status: 'ok' as const,
  },
  { endpoint: 'POST /api/publish', limit: 20, window: '60 s', current: 0, status: 'ok' as const },
  { endpoint: 'POST /api/admin/*', limit: 20, window: '60 s', current: 0, status: 'ok' as const },
  { endpoint: 'POST / PUT / DELETE', limit: 30, window: '60 s', current: 0, status: 'ok' as const },
];

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  return NextResponse.json(
    { limits: RATE_LIMITS },
    withAdminHeaders({
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    }),
  );
}
