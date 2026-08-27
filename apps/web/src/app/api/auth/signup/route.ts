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
import { SignupSchema } from '../../../lib/validation/schemas';

// Bridge is reachable from the web container via host.docker.internal
// (the self-hosted API server at :3101 is NOT — it binds host loopback only).
const BRIDGE_URL =
  process.env.BRIDGE_INTERNAL_URL ??
  process.env.WORKER_URL?.replace(/:\d+$/, ':8787') ??
  'http://host.docker.internal:8787';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = SignupSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 },
      );
    }
    const { username, email, walletAddress, displayName, password } = parsed.data;

    const bridgeKey = process.env.BRIDGE_API_KEY;
    if (!bridgeKey) {
      return NextResponse.json({ error: 'Bridge auth not configured' }, { status: 500 });
    }

    const payload: Record<string, unknown> = {
      username,
      displayName: displayName || username,
    };
    if (walletAddress) payload.walletAddress = walletAddress;
    if (email) payload.email = email;
    if (password) payload.password = password;

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
