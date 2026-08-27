import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/log';
import { requireAdmin } from '../../_auth';
export const runtime = 'nodejs';

const FlagSchema = z.object({
  enabled: z.boolean(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requireAdmin(request);
  if (auth) return auth;

  const { key } = await params;
  const rawBody = await request.json().catch(() => ({}));
  const parsed = FlagSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  log('info', `[admin] Flag "${key}" set`, { enabled: parsed.data.enabled });

  return NextResponse.json({ ok: true, key, enabled: parsed.data.enabled });
}
