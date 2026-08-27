import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// TODO: Wire to worker backend

const PreferencesSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    priceAlerts: z.boolean().optional(),
    protocolUpdates: z.boolean().optional(),
  }).optional(),
  defaultFeedView: z.enum(['compact', 'comfortable']).optional(),
  defaultFeedSort: z.enum(['trending', 'newest', 'following']).optional(),
}).catchall(z.unknown());

// === In-memory store (replace with KV in production) ==========
// This is a simple store for demo. In production, use Cloudflare KV, Upstash, or similar.
const preferencesStore = new Map<string, Record<string, unknown>>();

function getSessionId(request: NextRequest): string {
  // Use cookie or IP-based session
  const cookie = request.cookies.get('df_session');
  if (cookie?.value) return cookie.value;
  // Fallback: use a combination of headers
  const forwarded = request.headers.get('x-forwarded-for') ?? 'anonymous';
  const userAgent = request.headers.get('user-agent') ?? '';
  return `anon:${forwarded}:${userAgent.slice(0, 20)}`;
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    const prefs = preferencesStore.get(sessionId) ?? {};
    return NextResponse.json({ data: prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message, status: 500 }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = PreferencesSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const sessionId = getSessionId(request);
    const existing = preferencesStore.get(sessionId) ?? {};
    preferencesStore.set(sessionId, { ...existing, ...parsed.data });

    const response = NextResponse.json({ data: { ok: true } });

    // Handle theme cookie if present
    if (typeof body.theme === 'string') {
      response.cookies.set('df_theme', body.theme, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
        secure: true,
        httpOnly: false,
      });
    }

    // Set session cookie
    response.cookies.set('df_session', sessionId, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: message, status: 400 }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const sessionId = getSessionId(request);
    preferencesStore.set(sessionId, body as Record<string, unknown>);

    const response = NextResponse.json({ data: { ok: true } });

    if (typeof (body as Record<string, unknown>).theme === 'string') {
      response.cookies.set('df_theme', (body as Record<string, unknown>).theme as string, {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
        secure: true,
        httpOnly: false,
      });
    }

    response.cookies.set('df_session', sessionId, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid request body';
    return NextResponse.json({ error: message, status: 400 }, { status: 400 });
  }
}
