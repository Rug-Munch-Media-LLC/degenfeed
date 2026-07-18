import { type NextRequest, NextResponse } from 'next/server';
import { log } from '@/lib/log';
import { requireAdmin } from '../_auth';

export const runtime = 'nodejs';

// TODO: Wire to worker backend
const SYSTEM_CONFIG = {
  maintenanceMode: false,
  allowNewRegistrations: true,
  requireEmailVerification: false,
  defaultFeedType: 'trending',
  cacheEnabled: true,
  logLevel: 'info',
  maxUploadSize: 10,
  apiVersion: 'v2.1.0',
  buildVersion: '2026.07.18-0842',
  environment: process.env.NODE_ENV || 'production',
};

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  return NextResponse.json(SYSTEM_CONFIG, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  try {
    const body = (await request.json()) as { key: string; value: unknown };

    if (!body.key) {
      return NextResponse.json({ error: 'key is required' }, { status: 400 });
    }

    log('info', `[admin] Config "${body.key}" updated`, { value: body.value });

    return NextResponse.json({ ok: true, key: body.key, value: body.value });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
