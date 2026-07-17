import { NextResponse } from 'next/server';

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * POST /api/notifications/push
 * Store or update a push subscription for the current user.
 * Expects: { subscription: PushSubscriptionData }
 * Uses cookie-based session to associate subscription with user.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subscription: PushSubscriptionData;
    };

    if (
      !body.subscription?.endpoint ||
      !body.subscription?.keys?.p256dh ||
      !body.subscription?.keys?.auth
    ) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    // In production, store in KV / DB keyed by user session or cookie.
    // For now, store in a cookie (max 4KB — fine for a single subscription).
    const response = NextResponse.json({ ok: true });
    response.cookies.set('df_push_sub', JSON.stringify(body.subscription), {
      path: '/',
      maxAge: 31536000, // 1 year
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

/**
 * DELETE /api/notifications/push
 * Remove the stored push subscription.
 */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('df_push_sub', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
    secure: true,
    httpOnly: true,
  });
  return response;
}
