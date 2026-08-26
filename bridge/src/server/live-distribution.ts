// ═══════════════════════════════════════════════════════════════════════
// Live Distribution Engine — per-protocol fan-out
//
// When a creator's Owncast stream actually starts (STREAM_STARTED webhook),
// this module fans the HLS stream out to every platform the creator chose
// at go-live:
//
//   nostr      → NIP-53 kind:30311 live event (signed) via spaces-bridge
//   farcaster  → cast with Frame video embed (`fc:frame:video` HLS URL)
//                submitted to Hubble
//   lens       → Livepeer stream creation + Momoka (gasless) publication
//   bluesky    → AT Protocol skeet with embed card (HLS URL)
//   mastodon   → ActivityPub status post with HLS link
//
// On stream end (STREAM_STOPPED webhook / manual end):
//   nostr      → kind:30311 status:ended event with the same d tag
//   farcaster  → "ended" cast (casts are immutable — cleanup is a follow-up)
//   lens       → Livepeer stream deleted (Momoka publication is immutable)
//   bluesky    → original skeet deleted (com.atproto.repo.deleteRecord)
//   mastodon   → original status deleted (DELETE /api/v1/statuses/:id)
//
// Honesty contract: every per-protocol result is a REAL attempt. If a
// protocol client is not configured we return ok:false with a clear error —
// we NEVER fabricate success.
// ═══════════════════════════════════════════════════════════════════════

import { MomokaClient } from '@degenfeed/lens-sdk/momoka';
import { endNip53LiveEvent, livepeerBridge, publishNip53LiveEvent } from '@degenfeed/spaces-bridge';
import type { CreatorLivePlatform, DistributionResult, LiveSession } from './live-routes';
import { buildLiveConnection } from './live-routes';

// spaces-bridge's NIP-53 publisher reads NOSTR_PRIVATE_KEY, while the bridge
// env exposes NOSTR_PRIVATE_KEY_HEX. Map it once so publishNip53LiveEvent()
// works from this process without changes to spaces-bridge.
process.env.NOSTR_PRIVATE_KEY ||= process.env.NOSTR_PRIVATE_KEY_HEX || '';

const HTTP_TIMEOUT_MS = 10_000;

function env(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// ─── HLS URL ────────────────────────────────────────────────────────────

/**
 * The public HLS URL for a session, used as the NIP-53 `streaming` tag, the
 * Farcaster frame video embed, the Bluesky card URI and the Mastodon link.
 */
function sessionHlsUrl(session: LiveSession): string {
  return buildLiveConnection(session).hlsUrl;
}

// ─── Nostr (NIP-53 kind:30311) ──────────────────────────────────────────

async function distributeToNostr(
  session: LiveSession,
  hlsUrl: string,
): Promise<DistributionResult> {
  const result = await publishNip53LiveEvent({
    dTag: `degenfeed-live-${session.streamId}`,
    title: session.title,
    status: 'live',
    streamUrl: hlsUrl,
    summary: session.description || undefined,
    imageUrl: session.thumbnailUrl,
    currentParticipants: 0,
    tags: session.tags,
    hostName: session.creatorName,
  });
  return {
    ok: result.ok,
    error: result.error,
    eventId: result.eventId,
    dTag: result.dTag,
    relaysAccepted: result.relayResult?.relaysAccepted,
    url: result.eventId ? `nostr:${result.eventId}` : undefined,
  };
}

async function endNostr(session: LiveSession): Promise<DistributionResult> {
  const dTag = session.distribution.nostr?.dTag || `degenfeed-live-${session.streamId}`;
  const result = await endNip53LiveEvent({
    dTag,
    title: session.title,
    summary: session.description,
  });
  return {
    ok: result.ok,
    error: result.error,
    eventId: result.eventId,
    dTag,
  };
}

// ─── Farcaster (Frame video embed cast) ─────────────────────────────────

async function distributeToFarcaster(
  session: LiveSession,
  hlsUrl: string,
): Promise<DistributionResult> {
  const fid = env('FARCASTER_BOT_FID', '');
  const signerKey = env('FARCASTER_BOT_SIGNER_KEY', '');
  if (!fid || !signerKey) {
    return {
      ok: false,
      error: 'Farcaster bot not configured (FARCASTER_BOT_FID / FARCASTER_BOT_SIGNER_KEY)',
    };
  }
  const hubUrl = env('FARCASTER_BOT_HUB_URL', 'http://127.0.0.1:2281');

  try {
    const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
    const text = `🔴 LIVE: ${session.title}\n\nWatch on DegenFeed: ${hlsUrl}`.slice(0, 280);
    const castResult = buildFarcasterCastMessage({
      signerKeyHex: signerKey,
      fid: Number(fid),
      text,
      // Frame video embed — Warpcast renders .m3u8 URLs as a live video frame.
      embeds: [{ url: hlsUrl }],
    });
    if (!castResult.ok || !castResult.messageHex) {
      return { ok: false, error: castResult.error || 'Failed to build cast message' };
    }
    const bodyBytes = new Uint8Array(
      castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => Number.parseInt(b, 16)) ?? [],
    );
    const res = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/1.0',
      },
      body: bodyBytes,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Farcaster HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as { hash?: string };
    return {
      ok: true,
      castHash: data.hash,
      url: data.hash ? `https://warpcast.com/~/cast/${data.hash}` : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Farcaster publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function endFarcaster(session: LiveSession): Promise<DistributionResult> {
  const fid = env('FARCASTER_BOT_FID', '');
  const signerKey = env('FARCASTER_BOT_SIGNER_KEY', '');
  if (!fid || !signerKey) {
    return { ok: false, error: 'Farcaster bot not configured' };
  }
  const hubUrl = env('FARCASTER_BOT_HUB_URL', 'http://127.0.0.1:2281');

  try {
    const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
    const text = `🔚 Stream ended: ${session.title}`.slice(0, 280);
    const castResult = buildFarcasterCastMessage({
      signerKeyHex: signerKey,
      fid: Number(fid),
      text,
    });
    if (!castResult.ok || !castResult.messageHex) {
      return { ok: false, error: castResult.error || 'Failed to build ended cast' };
    }
    const bodyBytes = new Uint8Array(
      castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => Number.parseInt(b, 16)) ?? [],
    );
    const res = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/1.0',
      },
      body: bodyBytes,
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, error: `Farcaster HTTP ${res.status}` };
    const data = (await res.json()) as { hash?: string };
    return { ok: true, castHash: data.hash };
  } catch (err) {
    return {
      ok: false,
      error: `Farcaster end failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Lens (Livepeer stream + Momoka publication) ────────────────────────

let _lensAccessToken: string | null = null;
let _lensTokenExpiresAt = 0;

/**
 * Obtain a Lens API access token: prefer a directly-configured token, else
 * refresh via LENS_REFRESH_TOKEN + LENS_ACCOUNT_ADDRESS (Lens v2 auth).
 * Mirrors the (disabled) crossposter helper so the live engine stays
 * self-contained.
 */
async function getLensAccessToken(): Promise<string | null> {
  const direct = env('LENS_ACCESS_TOKEN', '');
  if (direct) return direct;
  const refreshToken = env('LENS_REFRESH_TOKEN', '');
  const accountAddr = env('LENS_ACCOUNT_ADDRESS', '');
  if (!refreshToken || !accountAddr) return null;

  const now = Math.floor(Date.now() / 1000);
  if (_lensAccessToken && now < _lensTokenExpiresAt - 60) return _lensAccessToken;

  try {
    const res = await fetch(env('LENS_API_URL', 'https://api-v2.lens.dev/graphql'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://degenfeed.xyz' },
      body: JSON.stringify({
        query: `mutation {
          refresh(request: { refreshToken: "${refreshToken}" }) {
            ... on AuthenticationTokens { accessToken refreshToken }
          }
        }`,
      }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { refresh?: { accessToken?: string; refreshToken?: string } };
    };
    const token = body?.data?.refresh?.accessToken;
    if (!token) return null;
    _lensAccessToken = token;
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1] || 'e30=', 'base64').toString('utf8'),
      ) as { exp?: number };
      _lensTokenExpiresAt = payload.exp || 0;
    } catch {
      _lensTokenExpiresAt = 0;
    }
    const newRefresh = body.data?.refresh?.refreshToken;
    if (newRefresh) process.env.LENS_REFRESH_TOKEN = newRefresh;
    return token;
  } catch {
    return null;
  }
}

async function distributeToLens(session: LiveSession, hlsUrl: string): Promise<DistributionResult> {
  const profileId = env('LENS_PROFILE_ID', '');

  // 1. Create a Livepeer stream for the Lens playback URL (best effort).
  let livepeerStreamId: string | undefined;
  let playbackUrl: string | undefined;
  try {
    const lp = await livepeerBridge.create({
      title: session.title,
      description: session.description,
      hostId: session.creatorId,
      hostName: session.creatorName,
      platforms: ['lens'],
      contentType: 'video',
    });
    livepeerStreamId = lp.nativeId;
    playbackUrl = lp.streamUrl;
  } catch (err) {
    console.warn(
      `[live-dist] Lens: Livepeer stream skipped — ${err instanceof Error ? err.message : err}`,
    );
  }

  // 2. Momoka (gasless) publication linking the playback/HLS URL.
  const accessToken = await getLensAccessToken();
  if (!accessToken) {
    return {
      ok: false,
      error:
        'Lens not authenticated (LENS_ACCESS_TOKEN or LENS_REFRESH_TOKEN + LENS_ACCOUNT_ADDRESS)',
      livepeerStreamId,
      playbackUrl,
    };
  }
  if (!profileId) {
    return {
      ok: false,
      error: 'LENS_PROFILE_ID not configured',
      livepeerStreamId,
      playbackUrl,
    };
  }

  try {
    const momoka = new MomokaClient();
    const pub = await momoka.submit({
      content: `🔴 LIVE: ${session.title}\n\n${playbackUrl || hlsUrl}`,
      profileId,
      accessToken,
      tags: ['degenfeed-live', ...session.tags],
    });
    return {
      ok: pub.accepted,
      error: pub.error,
      publicationId: pub.publicationId,
      daHash: pub.daHash,
      playbackUrl,
      livepeerStreamId,
      url: pub.proofUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Lens Momoka publish failed: ${err instanceof Error ? err.message : String(err)}`,
      livepeerStreamId,
      playbackUrl,
    };
  }
}

async function endLens(session: LiveSession): Promise<DistributionResult> {
  const streamId = session.distribution.lens?.livepeerStreamId;
  if (!streamId) return { ok: true, note: 'No Livepeer stream to delete' };
  const apiKey = env('LIVEPEER_API_KEY', '');
  if (!apiKey) {
    return { ok: false, error: 'LIVEPEER_API_KEY not configured — Livepeer stream left active' };
  }
  try {
    const res = await fetch(`https://livepeer.studio/api/stream/${streamId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (res.ok || res.status === 404) {
      return { ok: true, livepeerStreamId: streamId };
    }
    return { ok: false, error: `Livepeer stream delete failed (HTTP ${res.status})` };
  } catch (err) {
    return {
      ok: false,
      error: `Livepeer stream delete failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Bluesky (skeet with embed card) ────────────────────────────────────

interface BlueskySession {
  jwt: string;
  did: string;
}

async function getBlueskySession(): Promise<BlueskySession | null> {
  const jwt = env('BLUESKY_CROSSPOST_JWT', '');
  const did = env('BLUESKY_CROSSPOST_DID', '');
  if (jwt && did) return { jwt, did };

  const identifier = env('BLUESKY_IDENTIFIER', '');
  const appPassword = env('BLUESKY_APP_PASSWORD', '');
  if (!identifier || !appPassword) return null;

  try {
    const pds = env('ATPROTO_PDS_URL', 'https://bsky.social');
    const res = await fetch(`${pds}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessJwt?: string; did?: string };
    if (!data.accessJwt || !data.did) return null;
    return { jwt: data.accessJwt, did: data.did };
  } catch {
    return null;
  }
}

async function distributeToBluesky(
  session: LiveSession,
  hlsUrl: string,
): Promise<DistributionResult> {
  const bsky = await getBlueskySession();
  if (!bsky) {
    return {
      ok: false,
      error:
        'Bluesky not configured (BLUESKY_CROSSPOST_DID/JWT or BLUESKY_IDENTIFIER + BLUESKY_APP_PASSWORD)',
    };
  }
  const pds = env('ATPROTO_PDS_URL', 'https://bsky.social');

  try {
    const record = {
      $type: 'app.bsky.feed.post',
      text: `🔴 LIVE: ${session.title}\n\nWatch on DegenFeed`,
      createdAt: new Date().toISOString(),
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: hlsUrl,
          title: session.title.slice(0, 100),
          description: (session.description || `Live on DegenFeed`).slice(0, 200),
        },
      },
    };
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bsky.jwt}`,
      },
      body: JSON.stringify({
        repo: bsky.did,
        collection: 'app.bsky.feed.post',
        record,
      }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Bluesky HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as { uri?: string };
    return { ok: true, url: data.uri };
  } catch (err) {
    return {
      ok: false,
      error: `Bluesky publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function endBluesky(session: LiveSession): Promise<DistributionResult> {
  const uri = session.distribution.bluesky?.url;
  if (!uri) return { ok: true, note: 'No Bluesky skeet to delete' };
  const bsky = await getBlueskySession();
  if (!bsky) {
    return { ok: false, error: 'Bluesky not configured — skeet left in place' };
  }
  const pds = env('ATPROTO_PDS_URL', 'https://bsky.social');
  const rkey = uri.split('/').pop();

  try {
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${bsky.jwt}`,
      },
      body: JSON.stringify({
        repo: bsky.did,
        collection: 'app.bsky.feed.post',
        rkey,
      }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (res.ok || res.status === 404) return { ok: true, url: uri };
    return { ok: false, error: `Bluesky delete failed (HTTP ${res.status})` };
  } catch (err) {
    return {
      ok: false,
      error: `Bluesky delete failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Mastodon (status post with link) ───────────────────────────────────

async function distributeToMastodon(
  session: LiveSession,
  hlsUrl: string,
): Promise<DistributionResult> {
  const token = env('MASTODON_ACCESS_TOKEN', '');
  if (!token) {
    return { ok: false, error: 'MASTODON_ACCESS_TOKEN not configured' };
  }
  const instance = env('MASTODON_INSTANCE', 'https://social.degenfeed.xyz');

  try {
    const status = `🔴 LIVE: ${session.title}\n\nWatch: ${hlsUrl}`.slice(0, 500);
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, visibility: 'public', language: 'en' }),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Mastodon HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = (await res.json()) as { id?: string; url?: string };
    return {
      ok: true,
      url: data.url || `${instance}/@DegenFeed/${data.id || ''}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: `Mastodon publish failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function endMastodon(session: LiveSession): Promise<DistributionResult> {
  const statusUrl = session.distribution.mastodon?.url;
  if (!statusUrl) return { ok: true, note: 'No Mastodon status to delete' };
  const token = env('MASTODON_ACCESS_TOKEN', '');
  if (!token) return { ok: false, error: 'MASTODON_ACCESS_TOKEN not configured' };
  const instance = env('MASTODON_INSTANCE', 'https://social.degenfeed.xyz');
  const id = statusUrl.split('/').filter(Boolean).pop();

  try {
    const res = await fetch(`${instance}/api/v1/statuses/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    if (res.ok || res.status === 404) return { ok: true, url: statusUrl };
    return { ok: false, error: `Mastodon delete failed (HTTP ${res.status})` };
  } catch (err) {
    return {
      ok: false,
      error: `Mastodon delete failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

// ─── Orchestration ──────────────────────────────────────────────────────

const START_DISTRIBUTORS: Record<
  CreatorLivePlatform,
  (session: LiveSession, hlsUrl: string) => Promise<DistributionResult>
> = {
  nostr: distributeToNostr,
  farcaster: distributeToFarcaster,
  lens: distributeToLens,
  bluesky: distributeToBluesky,
  mastodon: distributeToMastodon,
  // owncast is the source stream (no fan-out); peertube restream is created
  // by the webhook pipeline before this engine runs.
  owncast: async () => ({ ok: true, note: 'owncast is the source stream — no fan-out needed' }),
  peertube: async () => ({
    ok: true,
    note: 'peertube restream handled by the webhook pipeline',
  }),
};

const END_DISTRIBUTORS: Record<
  CreatorLivePlatform,
  (session: LiveSession) => Promise<DistributionResult>
> = {
  nostr: endNostr,
  farcaster: endFarcaster,
  lens: endLens,
  bluesky: endBluesky,
  mastodon: endMastodon,
  owncast: async () => ({ ok: true, note: 'owncast ends via STREAM_STOPPED webhook' }),
  peertube: async () => ({ ok: true, note: 'peertube live ended by the webhook pipeline' }),
};

/**
 * Fan the session's stream out to every selected protocol. Updates the
 * session status to 'live', records per-platform DistributionResults, and
 * returns the results map. Never throws — per-protocol failures are captured
 * in the results.
 */
export async function distributeLiveStart(
  session: LiveSession,
): Promise<Partial<Record<CreatorLivePlatform, DistributionResult>>> {
  session.status = 'live';
  session.startedAt = Date.now();
  const hlsUrl = sessionHlsUrl(session);

  const entries = session.platforms.map(async (platform) => {
    const distributor = START_DISTRIBUTORS[platform];
    if (!distributor) {
      session.distribution[platform] = { ok: false, error: `No distributor for ${platform}` };
      return [platform, session.distribution[platform]] as const;
    }
    try {
      const result = await distributor(session, hlsUrl);
      session.distribution[platform] = result;
      //       console.log(
      //         `[live-dist] ${platform} ${result.ok ? 'LIVE' : 'FAILED'}: ${result.error || result.eventId || result.castHash || result.url || 'ok'}`,
      //       );
    } catch (err) {
      session.distribution[platform] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return [platform, session.distribution[platform]] as const;
  });

  await Promise.allSettled(entries);
  return { ...session.distribution };
}

/**
 * Clean up all protocol events for an ended stream. Updates the session
 * status to 'ended' and returns per-protocol cleanup results. Never throws.
 */
export async function distributeLiveEnd(
  session: LiveSession,
): Promise<Partial<Record<CreatorLivePlatform, DistributionResult>>> {
  session.status = 'ended';
  session.endedAt = Date.now();

  const entries = session.platforms.map(async (platform) => {
    const cleanup = END_DISTRIBUTORS[platform];
    if (!cleanup) {
      session.distribution[platform] = { ok: false, error: `No cleanup for ${platform}` };
      return [platform, session.distribution[platform]] as const;
    }
    try {
      const result = await cleanup(session);
      session.distribution[platform] = {
        ...session.distribution[platform],
        ...result,
      };
      //       console.log(
      //         `[live-dist] ${platform} ${result.ok ? 'ENDED' : 'END_FAILED'}: ${result.error || result.eventId || result.castHash || 'ok'}`,
      //       );
    } catch (err) {
      session.distribution[platform] = {
        ...session.distribution[platform],
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    return [platform, session.distribution[platform]] as const;
  });

  await Promise.allSettled(entries);
  return { ...session.distribution };
}

/**
 * Startup wiring: log which distribution platforms are configured. Called
 * from the bridge server listen callback.
 */
export function initLiveDistribution(): void {
  const configured: CreatorLivePlatform[] = [];
  if (process.env.NOSTR_PRIVATE_KEY || process.env.NOSTR_PRIVATE_KEY_HEX) configured.push('nostr');
  if (process.env.FARCASTER_BOT_FID && process.env.FARCASTER_BOT_SIGNER_KEY)
    configured.push('farcaster');
  if (
    process.env.LENS_PROFILE_ID &&
    (process.env.LENS_ACCESS_TOKEN || process.env.LENS_REFRESH_TOKEN)
  )
    configured.push('lens');
  if (process.env.BLUESKY_CROSSPOST_DID || process.env.BLUESKY_IDENTIFIER)
    configured.push('bluesky');
  if (process.env.MASTODON_ACCESS_TOKEN) configured.push('mastodon');
  //   console.log(
  //     `[bridge] Live distribution ready — configured: ${configured.length ? configured.join(', ') : '(none)'}`,
  //   );
}
