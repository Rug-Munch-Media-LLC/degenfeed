import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../_auth';

// ── Minimal web-layer moderation (defense in depth) ─────────────────────
// The bridge enforces the authoritative filter; this cheap inline check
// rejects obvious abuse before the fan-out request leaves the app.
// Keep in sync with bridge/src/lib/content-moderation.ts.
const MAX_PUBLISH_LENGTH = 15_000;
const BLOCKED_PUBLISH_PATTERNS: RegExp[] = [
  /\bcsam\b/i,
  /\bchild\s+[ps]\b/i,
  /\bpreteen\s*(sex|porn)\b/i,
  /\b(sex|sexual)\s+(with|involving)\s+minors?\b/i,
];
const FLAGGED_PUBLISH_PATTERNS: RegExp[] = [
  /\b(claim|collect|receive)\s+(free|bonus|reward)\s+(tokens?|nft|airdrop)\b/i,
  /\b(verify|validate|confirm)\s+your\s+(wallet|account)\b/i,
  /\b(dm|message)\s+me\s+(to|for|and)\b/i,
  /\b(pump|dump)\s*(the)?\s*(token|coin|bag)\b/i,
  /\b(guaranteed|risk[- ]free)\s+(profits?|returns?)\b/i,
  /\bsend\s+\d+\s*(sol|eth|btc|usdt)\s+(to|and)\s+(receive|get)\b/i,
];
function webModerationCheck(text: string): { allowed: boolean } {
  const normalized = text.toLowerCase().replace(/https?:\/\//g, '');
  const blocked = BLOCKED_PUBLISH_PATTERNS.some((re) => re.test(normalized));
  const flagged = FLAGGED_PUBLISH_PATTERNS.some((re) => re.test(normalized));
  return { allowed: !blocked && !flagged };
}
export const dynamic = 'force-dynamic';

/**
 * POST /api/publish/selected
 *
 * Cross-protocol composer publish. Accepts the composer payload, forwards to
 * the bridge's real /api/publish fan-out, and returns per-protocol results.
 *
 * Body (CrossPostComposer shape):
 *   {
 *     masterPost: { text, title?, hashtags?, media?: [{ url, alt?, mimeType? }] },
 *     protocols: ['nostr','mastodon','bluesky','farcaster'],
 *     options?: {
 *       nostr?:    { relays?: string[]; nip05?: string },
 *       mastodon?: { cw?: string; visibility?: 'public'|'unlisted'|'private'|'direct' },
 *       bluesky?:  { labels?: string[]; threadGate?: boolean },
 *       farcaster?:{ channel?: string; embed?: string },
 *     }
 *   }
 *
 * Also accepts the flat spec shape: { content, protocols, media?, options? }.
 *
 * Response: { batchId, ok, results: [{ protocol, status, error?, url? }] }
 */

const VALID_PROTOCOLS = new Set(['nostr', 'mastodon', 'bluesky', 'farcaster']);

function resolveWorkerUrl(): string {
  return (
    process.env.WORKER_URL ??
    process.env.NEXT_PUBLIC_WORKER_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://host.docker.internal:8787'
  );
}

interface MediaItem {
  url: string;
  alt?: string;
  mimeType?: string;
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The authenticated user (wallet address) is forwarded to the bridge so the
  // cross-post fan-out is attributable and per-user rate limits can be applied.
  const requestedBy = session.address;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Normalize both body shapes: { masterPost, protocols } (composer) and
    // { content, protocols } (flat/spec).
    const master =
      body.masterPost && typeof body.masterPost === 'object'
        ? (body.masterPost as Record<string, unknown>)
        : null;
    const contentRaw = master ? String(master.text ?? '') : String(body.content ?? '');
    const title = master ? String(master.title ?? '') : '';
    const hashtags = Array.isArray(master?.hashtags)
      ? (master.hashtags as unknown[]).filter((h): h is string => typeof h === 'string')
      : [];
    const mediaRaw = master
      ? Array.isArray(master.media)
        ? (master.media as unknown[])
        : []
      : Array.isArray(body.media)
        ? (body.media as unknown[])
        : [];

    const content = contentRaw.trim();
    if (!content) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }
    if (content.length > MAX_PUBLISH_LENGTH) {
      return NextResponse.json({ error: 'Content too long' }, { status: 400 });
    }
    const moderation = webModerationCheck(content);
    if (!moderation.allowed) {
      return NextResponse.json({ error: 'Content blocked by moderation policy' }, { status: 451 });
    }

    const protocolsRaw = Array.isArray(body.protocols) ? (body.protocols as unknown[]) : [];
    const protocols = protocolsRaw.filter(
      (p): p is string => typeof p === 'string' && VALID_PROTOCOLS.has(p),
    );
    if (protocols.length === 0) {
      return NextResponse.json(
        { error: 'No valid protocols. Supported: nostr, mastodon, bluesky, farcaster' },
        { status: 400 },
      );
    }

    // Append hashtags to the shared content (common cross-post convention)
    let publishContent = content;
    if (hashtags.length > 0) {
      publishContent = `${content}\n\n${hashtags.map((h) => `#${h}`).join(' ')}`;
    }

    const media: MediaItem[] = mediaRaw.filter(
      (m: unknown): m is MediaItem =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as MediaItem).url === 'string' &&
        (m as MediaItem).url.length > 0,
    );

    const payload = {
      content: publishContent,
      requestedBy,
      protocols,
      media: media.length > 0 ? media : undefined,
      options: body.options && typeof body.options === 'object' ? body.options : undefined,
      title: title || undefined,
    };

    const bridgeKey = process.env.BRIDGE_API_KEY;
    const workerUrl = resolveWorkerUrl();
    let bridgeData: {
      results?: Record<string, { ok?: boolean; url?: string; error?: string }>;
      publishedAt?: string;
    } | null = null;
    let bridgeError: string | null = null;

    try {
      const res = await fetch(`${workerUrl}/api/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bridgeKey ? { Authorization: `Bearer ${bridgeKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        results?: Record<string, { ok?: boolean; url?: string; error?: string }>;
        publishedAt?: string;
      } | null;
      if (res.ok && data) {
        bridgeData = data;
      } else {
        bridgeError = data?.error ?? `Bridge HTTP ${res.status}`;
      }
    } catch (err) {
      bridgeError = err instanceof Error ? err.message : 'Bridge unreachable';
    }

    const batchId = `batch:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    // Bridge unavailable — report honestly per protocol (no fabricated success).
    if (!bridgeData?.results) {
      return NextResponse.json({
        batchId,
        ok: false,
        results: protocols.map((protocol) => ({
          protocol,
          status: 'failed' as const,
          error: bridgeError
            ? `Bridge publish unavailable: ${bridgeError}`
            : 'Bridge returned no results',
        })),
      });
    }

    const results = protocols.map((protocol) => {
      const r = bridgeData?.results?.[protocol];
      const ok = r?.ok === true;
      return {
        protocol,
        status: ok ? ('published' as const) : ('failed' as const),
        ...(ok && r.url ? { url: r.url } : {}),
        ...(!ok ? { error: r?.error || 'Publish failed' } : {}),
      };
    });

    return NextResponse.json({
      batchId,
      ok: results.every((r) => r.status === 'published'),
      results,
      publishedAt: bridgeData.publishedAt,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
