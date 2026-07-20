/**
 * @api/analytics/stream-view — Record a stream/space view with source platform data.
 *
 * Tracks where viewers are coming from so we can measure cross-platform
 * funnel effectiveness. This is a fire-and-forget endpoint — errors are
 * logged server-side but never returned to the client.
 *
 * POST /api/analytics/stream-view
 * Body: { streamId, sourcePlatform, sourceInstance?, referrer?, userAgent?, timestamp?, guestId? }
 */

import { type NextRequest, NextResponse } from 'next/server';

/* ─── Types ─────────────────────────────────────────────────────── */

interface StreamViewPayload {
  streamId: string;
  sourcePlatform: string;
  sourceInstance?: string;
  referrer?: string;
  userAgent?: string;
  timestamp?: number;
  guestId?: string;
}

/* ─── Rate limiting (in-memory, per-IP, burst-aware) ─────────── */

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per minute per IP
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Periodic cleanup to prevent memory leak
const CLEANUP_INTERVAL = 300_000; // 5 minutes
let lastCleanup = Date.now();

function maybeCleanupRateLimits(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

/* ─── Validation ────────────────────────────────────────────────── */

const VALID_PLATFORMS = new Set([
  'mastodon',
  'bluesky',
  'farcaster',
  'nostr',
  'threads',
  'lens',
  'degenfeed',
  'direct',
  'unknown',
]);

function validatePayload(body: unknown): body is StreamViewPayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.streamId !== 'string' || !b.streamId) return false;
  if (typeof b.sourcePlatform !== 'string') return false;
  if (!VALID_PLATFORMS.has(b.sourcePlatform)) return false;
  return true;
}

/* ─── Handler ────────────────────────────────────────────────────── */

export async function POST(request: NextRequest): Promise<NextResponse> {
  maybeCleanupRateLimits();

  // Rate limit by IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Parse and validate
  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!validatePayload(body)) {
    return NextResponse.json(
      { error: 'Invalid payload. Required: streamId (string), sourcePlatform (valid platform)' },
      { status: 400 },
    );
  }

  const payload = body as StreamViewPayload;

  try {
    // ── Log to stdout for log aggregators ──
    const logEntry = {
      event: 'stream_view',
      streamId: payload.streamId,
      sourcePlatform: payload.sourcePlatform,
      sourceInstance: payload.sourceInstance ?? null,
      referrer: payload.referrer?.slice(0, 512) ?? null,
      userAgent: payload.userAgent?.slice(0, 256) ?? null,
      timestamp: payload.timestamp ?? Date.now(),
      guestId: payload.guestId ?? null,
      ip: anonymizeIp(ip),
    };

    // Structured logging
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(logEntry));

    // ── Persist to database (async, non-blocking) ──
    // This is a placeholder for the actual DB insertion.
    // In production this writes to ClickHouse or Postgres via the
    // /api/analytics/batch endpoint for efficient batching.
    persistAnalytics(logEntry).catch(() => {
      // Log failure but don't block response
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[analytics/stream-view] Error:', err);
    // Always return success to the client — analytics is non-critical
    return NextResponse.json({ ok: true }, { status: 201 });
  }
}

/* ─── Persistence ────────────────────────────────────────────────── */

interface AnalyticsRecord {
  event: string;
  streamId: string;
  sourcePlatform: string;
  sourceInstance: string | null;
  referrer: string | null;
  userAgent: string | null;
  timestamp: number;
  guestId: string | null;
  ip: string;
}

async function persistAnalytics(_record: AnalyticsRecord): Promise<void> {
  // TODO: Insert into analytics database
  // Example: await db.insert(analyticsTable).values(record);
  //
  // For now, we rely on structured stdout logging which is captured
  // by our log aggregator (Grafana Loki / Datadog).
}

/* ─── Helpers ────────────────────────────────────────────────────── */

/**
 * Anonymize an IP address by zeroing out the last segment.
 * Preserves IPv4 /24 prefix and IPv6 /64 prefix.
 */
function anonymizeIp(ip: string): string {
  if (ip.includes(':')) {
    // IPv6 — keep /64 prefix
    const parts = ip.split(':');
    const prefix = parts.slice(0, 4).join(':');
    return `${prefix}:xxxx:xxxx:xxxx:xxxx`;
  }

  // IPv4 — keep /24 prefix
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  return '0.0.0.0';
}
