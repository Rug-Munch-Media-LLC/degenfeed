/**
 * Cross-poster per-target publishers
 */

import type { ProtocolName } from './crossposter-types';

// ─── Publisher implementations ──────────────────────────────────────────

async function publishToNostrRelay(_payload: unknown): Promise<boolean> {
  const relayUrl = process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:32768';
  try {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(relayUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(['EVENT', _payload]));
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'OK') {
              clearTimeout(timer);
              ws.close();
              resolve(msg[1] === true || typeof msg[1] === 'string');
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
  const jwt = process.env.BLUESKY_CROSSPOST_JWT || '';
  const did = process.env.BLUESKY_CROSSPOST_DID || '';

  if (!jwt || !did) return false;
  const payload = _payload as Record<string, unknown>;

  try {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
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
  const apiKey = process.env.NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;
  const payload = _payload as { text: string; embeds?: Array<{ url: string }> };

  if (!apiKey || !signerUuid) {
    console.log('[crossposter] Farcaster: missing NEYNAR_API_KEY or FARCASTER_SIGNER_UUID');
    return false;
  }

  const truncatedText =
    payload.text.length > 320 ? `${payload.text.slice(0, 317)}...` : payload.text;

  try {
    const res = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        api_key: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signer_uuid: signerUuid,
        text: truncatedText,
        embeds: payload.embeds || [],
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { cast?: { hash?: string } };
      console.log(`[crossposter] ✓ Farcaster cast: ${data.cast?.hash || 'ok'}`);
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

async function publishToLens(_payload: unknown): Promise<boolean> {
  const lensApiUrl = process.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
  const accessToken = process.env.LENS_ACCESS_TOKEN || '';
  const profileId = process.env.LENS_PROFILE_ID || '';
  const payload = _payload as { text: string; embeds?: Array<{ url: string }> };

  if (!accessToken || !profileId) {
    console.log('[crossposter] Lens: missing LENS_ACCESS_TOKEN or LENS_PROFILE_ID');
    return false;
  }

  const truncatedText =
    payload.text.length > 5000 ? `${payload.text.slice(0, 4997)}...` : payload.text;

  try {
    const res = await fetch(lensApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `mutation CreatePost($request: CreatePublicPostRequest!) {
          createPost(request: $request) {
            ... on Post { id }
          }
        }`,
        variables: {
          request: {
            profileId,
            contentURI: `data:text/plain,${encodeURIComponent(truncatedText)}`,
          },
        },
      }),
    });

    if (res.ok) {
      console.log(`[crossposter] ✓ Lens post successful`);
      return true;
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
