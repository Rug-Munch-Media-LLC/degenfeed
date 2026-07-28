/**
 * Cross-poster per-target publishers
 */

import { getPublicKey, signEvent } from '@degenfeed/nostr-sdk';
import WebSocket from 'ws';

// ─── Publisher implementations ──────────────────────────────────────────

async function publishToNostrRelay(_payload: unknown): Promise<boolean> {
  const relayUrl = process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:8085';
  const privateKeyHex = process.env.NOSTR_PRIVATE_KEY_HEX;
  if (!privateKeyHex) {
    console.log('[nostr] No NOSTR_PRIVATE_KEY_HEX configured — cannot sign events');
    return false;
  }
  try {
    return new Promise((resolve) => {
      try {
        // Sign the event with proper Nostr pubkey, id, and sig
        const payload = _payload as Record<string, unknown>;
        const pubkey = getPublicKey(privateKeyHex);
        const signedEvent = signEvent(
          {
            pubkey,
            created_at: (payload.created_at as number) || Math.floor(Date.now() / 1000),
            kind: (payload.kind as number) || 1,
            tags: (payload.tags as string[][]) || [],
            content: (payload.content as string) || '',
          },
          privateKeyHex,
        );

        const ws = new WebSocket(relayUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(['EVENT', signedEvent]));
          console.log(`[nostr] Sent signed event ${signedEvent.id.slice(0, 8)} to ${relayUrl}`);
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'OK') {
              clearTimeout(timer);
              ws.close();
              const ok = msg[2] === true;
              if (ok) {
                console.log(`[nostr] ✓ Event accepted by relay`);
              } else {
                console.log(`[nostr] ✗ Relay rejected event: ${JSON.stringify(msg).slice(0, 200)}`);
              }
              resolve(ok);
            }
          } catch {
            // ignore
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve(false);
        });

        ws.addEventListener('close', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

async function publishToBluesky(_payload: unknown): Promise<boolean> {
  const pdsUrl = process.env.ATPROTO_PDS_URL || 'https://bsky.social';
  const appPassword = process.env.BLUESKY_APP_PASSWORD || '';
  const identifier = process.env.BLUESKY_IDENTIFIER || '';
  const did = process.env.BLUESKY_CROSSPOST_DID || '';

  if (!did) return false;

  // Resolve JWT: use cached env var first, refresh via app password if expired
  let jwt = process.env.BLUESKY_CROSSPOST_JWT || '';
  if (!jwt || isJwtExpired(jwt)) {
    if (!appPassword || !identifier) {
      console.log('[crossposter] Bluesky: missing app password or identifier for JWT refresh');
      return false;
    }
    try {
      const sessionRes = await fetch(pdsUrl + '/xrpc/com.atproto.server.createSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: appPassword }),
      });
      if (!sessionRes.ok) {
        console.log('[crossposter] Bluesky: session refresh failed');
        return false;
      }
      const session = (await sessionRes.json()) as { accessJwt?: string };
      if (!session.accessJwt) {
        console.log('[crossposter] Bluesky: no accessJwt in session response');
        return false;
      }
      jwt = session.accessJwt;
      console.log('[crossposter] Bluesky: JWT refreshed via app password');
    } catch (err) {
      console.log('[crossposter] Bluesky: session error', (err as Error).message);
      return false;
    }
  }

  const payload = _payload as Record<string, unknown>;
  try {
    const res = await fetch(pdsUrl + '/xrpc/com.atproto.repo.createRecord', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + jwt,
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record: payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Check if a JWT token is expired by decoding its payload */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    return !payload.exp || payload.exp < now;
  } catch {
    return true;
  }
}

async function publishToPeerTube(payload: unknown): Promise<boolean> {
  const ptBase = process.env.PEERTUBE_BASE_URL || 'http://127.0.0.1:9011';
  const token = process.env.PEERTUBE_ACCESS_TOKEN || '';
  const { text, tags } = payload as { text: string; tags: string[] };

  if (!token) return false;

  try {
    const res = await fetch(`${ptBase}/api/v1/videos/announce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, tags }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function publishToFarcaster(_payload: unknown): Promise<boolean> {
  const fid = process.env.FARCASTER_BOT_FID;
  const signerKey = process.env.FARCASTER_BOT_SIGNER_KEY;
  const hubUrl = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
  const payload = _payload as { text: string; embeds?: Array<{ url: string }> };

  if (!fid || !signerKey) {
    console.log('[crossposter] Farcaster: missing FARCASTER_BOT_FID or FARCASTER_BOT_SIGNER_KEY');
    return false;
  }

  const truncatedText =
    payload.text.length > 320 ? `${payload.text.slice(0, 317)}...` : payload.text;

  try {
    const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
    const castResult = buildFarcasterCastMessage({
      signerKeyHex: signerKey,
      fid: Number(fid),
      text: truncatedText,
    });

    if (!castResult.ok || !castResult.messageHex) {
      console.log(`[crossposter] ✗ Failed to build Farcaster cast: ${castResult.error}`);
      return false;
    }

    const bodyBytes = new Uint8Array(
      castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) ?? [],
    );
    const res = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/1.0',
      },
      body: bodyBytes,
    });

    if (res.ok) {
      console.log(`[crossposter] ✓ Farcaster cast submitted to Hubble`);
      return true;
    }

    const errBody = await res.text().catch(() => '');
    console.log(`[crossposter] ✗ Farcaster: HTTP ${res.status} ${errBody.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.log(`[crossposter] ✗ Farcaster error: ${(err as Error).message}`);
    return false;
  }
}

// ─── Lens v2 helpers ─────────────────────────────────────────────────────
// Lens Protocol v2 uses api.lens.xyz with wallet-based SIWE auth.
// Access tokens expire in ~10 min; refresh tokens in ~9 days.
// We cache the access token in memory and auto-refresh when expired.

let _lensAccessToken: string | null = null;
let _lensTokenExpiresAt = 0;

async function lensAuthenticate(): Promise<string | null> {
  const lensApiUrl = process.env.LENS_API_URL || 'https://api.lens.xyz/graphql';
  const refreshToken = process.env.LENS_REFRESH_TOKEN || '';
  const accountAddr = process.env.LENS_ACCOUNT_ADDRESS || '';

  if (!refreshToken || !accountAddr) {
    console.log(
      '[crossposter] Lens: cannot authenticate — missing LENS_REFRESH_TOKEN or LENS_ACCOUNT_ADDRESS',
    );
    return null;
  }

  // Use refresh token to get a new access token
  try {
    const res = await fetch(lensApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://degenfeed.xyz' },
      body: JSON.stringify({
        query: `mutation {
          refresh(request: { refreshToken: "${refreshToken}" }) {
            ... on AuthenticationTokens { accessToken refreshToken }
          }
        }`,
      }),
    });
    if (!res.ok) {
      console.log(`[crossposter] Lens: token refresh HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as {
      data?: { refresh?: { accessToken?: string; refreshToken?: string } };
    };
    const newToken = body?.data?.refresh?.accessToken;
    if (!newToken) {
      console.log('[crossposter] Lens: token refresh failed — no accessToken in response');
      return null;
    }

    _lensAccessToken = newToken;
    _lensTokenExpiresAt = decodeJwtExpiry(newToken);
    console.log('[crossposter] Lens: token refreshed');

    // Store updated refresh token
    const newRefresh = body?.data?.refresh?.refreshToken;
    if (newRefresh) {
      process.env.LENS_REFRESH_TOKEN = newRefresh;
    }

    return newToken;
  } catch (err) {
    console.log(`[crossposter] Lens: token refresh error: ${(err as Error).message}`);
    return null;
  }
}

/** Decode JWT expiry timestamp (in seconds since epoch). Returns 0 on failure. */
function decodeJwtExpiry(token: string): number {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return 0;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload.exp || 0;
  } catch {
    return 0;
  }
}

async function publishToLens(_payload: unknown): Promise<boolean> {
  const lensApiUrl = process.env.LENS_API_URL || 'https://api.lens.xyz/graphql';
  const accountAddr = process.env.LENS_ACCOUNT_ADDRESS || '';
  const feedAddr = process.env.LENS_FEED_ADDRESS || '0xcB5E109FFC0E15565082d78E68dDDf2573703580';
  const payload = _payload as { text: string; embeds?: Array<{ url: string }> };

  if (!accountAddr) {
    console.log('[crossposter] Lens: missing LENS_ACCOUNT_ADDRESS — cannot post');
    return false;
  }

  // Get a valid access token (reuse cached or re-authenticate)
  let accessToken = _lensAccessToken;
  const now = Math.floor(Date.now() / 1000);
  if (!accessToken || now >= _lensTokenExpiresAt - 60) {
    accessToken = null;
    _lensAccessToken = null;
  }
  if (!accessToken) {
    accessToken = await lensAuthenticate();
    if (!accessToken) {
      console.log('[crossposter] Lens: failed to authenticate');
      return false;
    }
  }

  const truncatedText =
    payload.text.length > 5000 ? `${payload.text.slice(0, 4997)}...` : payload.text;

  // Lens v2: post content as JSON with a "content" field, URI-encoded
  const contentObj = { content: truncatedText };
  const contentUri = `data:application/json,${encodeURIComponent(JSON.stringify(contentObj))}`;

  try {
    const res = await fetch(lensApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://degenfeed.xyz',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `mutation {
          post(request: { contentUri: "${contentUri}", feed: "${feedAddr}" }) {
            __typename
            ... on PostResponse { hash }
            ... on TransactionWillFail { reason }
            ... on PostOperationValidationFailed { reason }
          }
        }`,
      }),
    });

    if (res.ok) {
      const body = (await res.json()) as {
        data?: { post?: { __typename: string; hash?: string; reason?: string } };
      };
      const result = body?.data?.post;
      if (result?.__typename === 'PostResponse') {
        console.log(`[crossposter] ✓ Lens post successful: ${result.hash?.slice(0, 18) || ''}...`);
        return true;
      }
      console.log(`[crossposter] ✗ Lens: ${result?.__typename}: ${result?.reason || ''}`);
      return false;
    }

    const errBody = await res.text().catch(() => '');
    console.log(`[crossposter] ✗ Lens: HTTP ${res.status} ${errBody.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.log(`[crossposter] ✗ Lens error: ${(err as Error).message}`);
    return false;
  }
}

async function publishToMastodon(payload: unknown): Promise<boolean> {
  const instance = process.env.MASTODON_INSTANCE || 'https://social.degenfeed.xyz';
  const token = process.env.MASTODON_ACCESS_TOKEN || '';
  const { status, visibility } = payload as { status: string; visibility: string };

  if (!token) return false;

  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, visibility: visibility || 'public' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function publishToPixelfed(_payload: unknown): Promise<boolean> {
  const payload = _payload as {
    caption: string;
    images: string[];
    visibility: string;
    protocol: string;
    authorName: string;
  };

  if (!payload.images || payload.images.length === 0) {
    console.log('[crossposter] Pixelfed: no images in payload');
    return false;
  }

  try {
    const { publishUnifiedPost } = await import('../providers/pixelfed-write');
    const { UnifiedPost } = await import('../server/types');

    const mockPost = {
      text: payload.caption,
      embeds: payload.images.map((url: string) => ({ kind: 'image' as const, url, meta: {} })),
      protocol: payload.protocol || 'mastodon',
      author: {
        displayName: payload.authorName || 'Unknown',
        id: '',
        primary: { protocol: 'mastodon', id: '' },
        handles: {},
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      id: '',
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: [],
    };

    const result = await publishUnifiedPost(mockPost as UnifiedPost);
    if (result.ok) {
      console.log(`[crossposter] ✓ Pixelfed: ${result.status?.url || 'ok'}`);
      return true;
    }
    console.log(`[crossposter] ✗ Pixelfed: ${result.error}`);
    return false;
  } catch (err) {
    console.log(`[crossposter] ✗ Pixelfed error: ${(err as Error).message}`);
    return false;
  }
}

async function publishToWriteFreely(_payload: unknown): Promise<boolean> {
  const payload = _payload as {
    title: string;
    body: string;
    tags?: string[];
    protocol: string;
  };

  const token = process.env.WRITEFREELY_TOKEN || '';
  const alias = process.env.WRITEFREELY_ALIAS || 'degenfeed';

  if (!token) {
    console.log('[crossposter] WriteFreely: missing WRITEFREELY_TOKEN');
    return false;
  }

  try {
    const { postToWriteFreely } = await import('../providers/writefreely-write');

    const result = await postToWriteFreely(payload.title, payload.body, token, alias, payload.tags);

    if (result.ok) {
      console.log(`[crossposter] ✓ WriteFreely: ${result.post?.url || 'ok'}`);
      return true;
    }
    console.log(`[crossposter] ✗ WriteFreely: ${result.error}`);
    return false;
  } catch (err) {
    console.log(`[crossposter] ✗ WriteFreely error: ${(err as Error).message}`);
    return false;
  }
}

// ─── Publisher lookup ───────────────────────────────────────────────────

export const PUBLISHERS: Record<string, (payload: unknown) => Promise<boolean>> = {
  nostr: publishToNostrRelay,
  bluesky: publishToBluesky,
  peertube: publishToPeerTube,
  farcaster: publishToFarcaster,
  lens: publishToLens,
  mastodon: publishToMastodon,
  pixelfed: publishToPixelfed,
  writefreely: publishToWriteFreely,
};
