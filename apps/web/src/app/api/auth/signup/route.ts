/**
 * @degenfeed/web — POST /api/auth/signup
 *
 * Unified signup: ONE form → account on ALL DegenFeed identity services
 * (GoToSocial / ActivityPub + Bluesky PDS / AT Protocol + mesh services).
 *
 * Flow:
 *   1. Validate input (wallet + username, or email + username)
 *   2. Forward to the bridge's unified signup endpoint
 *      (bridge spawns the canonical Python provisioner)
 *   3. Return per-instance account details (GTS, PDS, Lemmy, PeerTube, …)
 *
 * The bridge runs on the host and is the only component that can spawn the
 * Python provisioner (which writes directly to GTS SQLite / PDS XRPC / etc).
 */

import { NextResponse } from 'next/server';

// Bridge is reachable from the web container via host.docker.internal
// (the self-hosted API server at :3101 is NOT — it binds host loopback only).
const BRIDGE_URL =
  process.env.BRIDGE_INTERNAL_URL ??
  process.env.WORKER_URL?.replace(/:\d+$/, ':8787') ??
  'http://host.docker.internal:8787';

interface SignupBody {
  walletAddress?: string;
  username?: string;
  email?: string;
  password?: string;
  displayName?: string;
  method?: string; // 'wallet' | 'email' | 'platform' (frontend compat)
  platform?: string; // frontend 'platform' method
  referrer?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SignupBody;

    // Accept both the canonical shape ({walletAddress, username}) and the
    // frontend GuestSignUp shapes ({method: 'wallet'|'email'|'platform', …}).
    const username = body.username?.trim().toLowerCase();
    const walletAddress = body.walletAddress ?? (body.method === 'wallet' ? undefined : undefined);

    if (!username || !/^[a-z0-9_]{1,30}$/.test(username)) {
      return NextResponse.json(
        {
          error: 'Username must be 1-30 characters (lowercase letters, numbers, underscores)',
        },
        { status: 422 },
      );
    }

    const bridgeKey = process.env.BRIDGE_API_KEY;
    if (!bridgeKey) {
      return NextResponse.json({ error: 'Bridge auth not configured' }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      username,
      displayName: body.displayName || username,
    };
    if (walletAddress) payload.walletAddress = walletAddress;
    if (body.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) payload.email = body.email;
    if (body.password && body.password.length >= 8) payload.password = body.password;

    const res = await fetch(`${BRIDGE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bridgeKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(100_000),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: (data as { error?: { message?: string } }).error?.message ?? 'Signup failed' },
        { status: res.status },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signup failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
