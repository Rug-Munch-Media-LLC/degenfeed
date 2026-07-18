import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const RATE_LIMITS = [
  { endpoint: '/api/feed/*', limit: 100, window: '1 min', current: 42, status: 'ok' as const },
  { endpoint: '/api/publish', limit: 10, window: '1 min', current: 3, status: 'ok' as const },
  {
    endpoint: '/api/auth/*',
    limit: 20,
    window: '1 min',
    current: 18,
    status: 'near_limit' as const,
  },
  { endpoint: '/api/search', limit: 30, window: '1 min', current: 5, status: 'ok' as const },
  { endpoint: '/api/moderation/*', limit: 50, window: '1 min', current: 2, status: 'ok' as const },
  { endpoint: '/api/tips', limit: 15, window: '1 min', current: 7, status: 'ok' as const },
];

export async function GET() {
  return NextResponse.json(
    { limits: RATE_LIMITS },
    {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    },
  );
}
