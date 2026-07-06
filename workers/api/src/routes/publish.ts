import {
  RelayPool,
  createTextNote,
  generateSecretKey,
  getEventHash,
  getPublicKey,
  signEvent,
} from '@degenfeed/nostr-sdk';
import { type Env, jsonResponse } from '../index';

// ─── RSS-to-Nostr bridge ─────────────────────────────────────────────
// Fetches an RSS feed, converts each item to a Nostr text event,
// signs with the provided key, and publishes to Nostr relays.

export async function handleRssToNostrBridge(request: Request, _env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as Record<string, string>;
    const feedUrl = body.feedUrl;
    const nsec = body.nsec;
    if (!feedUrl || !nsec) {
      return jsonResponse({ error: 'feedUrl and nsec are required' }, 400);
    }

    // 1. Fetch and parse RSS
    const { GenericRssSource, feedToUnifiedPosts } = await import('@degenfeed/rss-sdk');
    const src = await GenericRssSource.fetch(feedUrl);
    const posts = feedToUnifiedPosts(src);
    if (posts.length === 0) return jsonResponse({ error: 'No items in feed' }, 400);

    // 2. Publish each item as a Nostr event
    const nostr = await import('@degenfeed/nostr-sdk');
    // nsec is a hex string — nostr-sdk functions expect hex strings
    const pk = nostr.getPublicKey(nsec);
    const pool = new nostr.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
      eoseTimeout: 3000,
    });

    const results: Array<{ title: string; ok: boolean; error?: string }> = [];
    const maxItems = Math.min(posts.length, 5); // Limit to 5 to avoid spam

    for (const post of posts.slice(0, maxItems)) {
      try {
        const linkUrl = post.embeds.find((e) => e.kind === 'link');
        const text = `${post.protocol}: ${post.text.slice(0, 200)}${linkUrl ? `\n\n${linkUrl.url}` : ''}`;
        const ev = nostr.createTextNote(text, nsec, []);
        ev.pubkey = pk;
        ev.id = nostr.getEventHash(ev);
        nostr.signEvent(ev, nsec);
        await pool.publish(ev);
        results.push({ title: post.text.slice(0, 50), ok: true });
      } catch (e) {
        results.push({ title: post.text.slice(0, 50), ok: false, error: String(e) });
      }
    }
    pool.disconnectAll();

    return jsonResponse({ results, total: posts.length, bridged: results.length });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handlePublish(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    interface PublishRequest {
      text?: string;
      targets?: string[];
      auth?: Record<string, string>;
      signedMessage?: string;
      typedDataId?: string;
      signature?: string;
    }
    const body: PublishRequest = (await request.json()) as PublishRequest;
    if (!body.text?.trim()) return jsonResponse({ error: 'Text required' }, 400);
    if (!body.targets?.length) return jsonResponse({ error: 'Targets required' }, 400);
    const auth = body.auth ?? ({} as Record<string, string>);

    const results: Record<string, { ok: boolean; error?: string; hash?: string }> = {};

    for (const target of body.targets) {
      try {
        switch (target) {
          case 'nostr': {
            const skHex: string = auth.nostr ?? '';
            const sk: string = skHex || generateSecretKey();
            const pk = getPublicKey(sk);
            const ev = createTextNote(body.text, sk, []);
            ev.pubkey = pk;
            ev.id = getEventHash(ev);
            signEvent(ev, sk);
            const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
              eoseTimeout: 2000,
            });
            await pool.publish(ev);
            pool.disconnectAll();
            results[target] = { ok: true };
            break;
          }

          case 'farcaster': {
            // Farcaster Hub submitMessage via REST API
            // Accepts a pre-signed Message protobuf from the client
            // Client flow: @farcaster/hub-web makeCastAdd → sign → send hex
            const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
            const signedMessage = body.signedMessage || body.auth?.farcaster_message;
            if (signedMessage) {
              // Submit pre-signed message to Hub
              const submitRes = await fetch(`${hubUrl}/v1/submitMessage`, {
                method: 'PUT',
                headers: { 'content-type': 'application/octet-stream' },
                body: signedMessage,
              });
              if (submitRes.ok) {
                const submitData = (await submitRes.json()) as Record<string, unknown>;
                results[target] = { ok: true, hash: String(submitData.hash || '') || undefined };
              } else {
                const errText = await submitRes.text();
                results[target] = {
                  ok: false,
                  error: `Farcaster Hub rejected: ${errText.slice(0, 100)}`,
                };
              }
            } else {
              // No pre-signed message — return stub asking client to sign
              results[target] = {
                ok: false,
                error:
                  'Client must sign cast using @farcaster/hub-web, then submit signedMessage in publish request.',
              };
            }
            break;
          }

          case 'lens': {
            // Lens API v2 broadcast — accepts a pre-signed typed data from the client
            // Client flow: lens.createPostTypedData → wallet.signTypedData → send signature
            const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
            const typedDataId = body.typedDataId || body.auth?.lens_typedDataId;
            const signature = body.signature || body.auth?.lens_signature;
            if (typedDataId && signature) {
              const broadcastRes = await fetch(lensApi, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  query:
                    'mutation Broadcast($request: BroadcastRequest!) { broadcast(request: $request) { ... on RelayerResult { txHash } ... on RelayError { reason } } }',
                  variables: { request: { id: typedDataId, signature } },
                }),
              });
              if (broadcastRes.ok) {
                const broadcastData = (await broadcastRes.json()) as Record<string, unknown>;
                const result = (broadcastData.data as Record<string, unknown>)?.broadcast as
                  | Record<string, unknown>
                  | undefined;
                results[target] = {
                  ok: !!result?.txHash,
                  hash: result?.txHash as string | undefined,
                  error: result?.reason as string | undefined,
                };
              } else {
                const errText = await broadcastRes.text();
                results[target] = {
                  ok: false,
                  error: `Lens broadcast failed: ${errText.slice(0, 100)}`,
                };
              }
            } else {
              results[target] = {
                ok: false,
                error:
                  'Client must sign typed data using wallet, then submit typedDataId + signature in publish request.',
              };
            }
            break;
          }

          case 'bluesky':
          case 'threads': {
            // AT Protocol repo.createRecord
            // Requires PDS session token (accessJwt) stored during sign-in
            const pdsUrl =
              target === 'bluesky'
                ? env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app'
                : env.THREADS_PDS_URL || 'https://public.threads.net';
            const accessJwt =
              auth[`${target}_jwt`] || auth[`${target}_accessJwt`] || auth.accessJwt;
            if (!accessJwt) {
              results[target] = { ok: false, error: `Not signed into ${target}` };
              break;
            }
            // Create record via XRPC — uses the DID from auth or extracts from JWT
            const repoDid = auth[`${target}_did`] || '';
            const recordRes = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` },
              body: JSON.stringify({
                repo: repoDid,
                collection: 'app.bsky.feed.post',
                record: { text: body.text, createdAt: new Date().toISOString() },
              }),
            });
            if (recordRes.ok) {
              results[target] = { ok: true };
            } else {
              const errText = await recordRes.text();
              results[target] = {
                ok: false,
                error: `${target} publish failed: ${errText.slice(0, 100)}`,
              };
            }
            break;
          }

          case 'mastodon': {
            const { GtSClient } = await import('@degenfeed/mastodon-sdk');
            const instance = auth.mastodon_instance || 'https://social.degenfeed.xyz';
            const accessToken = auth.mastodon;
            if (!accessToken) {
              results[target] = { ok: false, error: 'Not signed into Mastodon' };
              break;
            }
            const client = new GtSClient(instance, accessToken);
            await client.publish(body.text, { visibility: 'public' });
            results[target] = { ok: true };
            break;
          }

          default:
            results[target] = { ok: false, error: `${target} not supported` };
        }
      } catch (e) {
        results[target] = { ok: false, error: String(e) };
      }
    }
    return jsonResponse({ results });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}

export async function handleEngage(request: Request, _env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    interface EngageRequest {
      action?: string;
      postId?: string;
      protocol?: string;
      auth?: Record<string, string>;
      authToken?: string;
    }
    const body: EngageRequest = (await request.json()) as EngageRequest;
    const action = body.action ?? '';
    const postId = body.postId ?? '';
    const protocol = body.protocol ?? '';
    const auth = body.auth as Record<string, string> | undefined;

    if (!action || !postId || !protocol) {
      return jsonResponse({ error: 'action, postId, protocol required' }, 400);
    }

    switch (protocol) {
      case 'nostr': {
        return jsonResponse({
          ok: false,
          error: 'Reaction signing requires user key — coming soon',
        });
      }
      case 'mastodon': {
        // Mastodon like/repost via GtSClient
        const instance = auth?.mastodon_instance || 'https://social.degenfeed.xyz';
        const token =
          ((body as Record<string, unknown>).authToken as string) || auth?.mastodon || '';
        if (!token) return jsonResponse({ error: 'Not signed into Mastodon' }, 401);
        const { GtSClient } = await import('@degenfeed/mastodon-sdk');
        const client = new GtSClient(instance, token);
        if (action === 'like') await client.like(postId);
        else if (action === 'repost') await client.repost(postId);
        break;
      }
    }
    return jsonResponse({ ok: true, action, postId, protocol });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
}
