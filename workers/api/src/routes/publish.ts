import { type Env, jsonResponse } from '../index';
import { generateSecretKey, getPublicKey, getEventHash, signEvent, createTextNote, RelayPool } from '@degenfeed/nostr-sdk';

// Helper: hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array((hex.match(/.{2}/g) || []).map(b => parseInt(b, 16)));
  return bytes;
}


// ─── RSS-to-Nostr bridge ─────────────────────────────────────────────
// Fetches an RSS feed, converts each item to a Nostr text event,
// signs with the provided key, and publishes to Nostr relays.

export async function handleRssToNostrBridge(request: Request, env: Env): Promise<Response> {
  try {
    const body: Record<string, string> = await request.json() as any;
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
    const pool = new (nostr.RelayPool)(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 3000 });

    const results: Array<{ title: string; ok: boolean; error?: string }> = [];
    const maxItems = Math.min(posts.length, 5); // Limit to 5 to avoid spam

    for (const post of posts.slice(0, maxItems)) {
      try {
        const linkUrl = post.embeds.find(e => e.kind === 'link');
        const text = post.protocol + ': ' + post.text.slice(0, 200) + (linkUrl ? '\n\n' + linkUrl.url : '');
        const ev: any = nostr.createTextNote(text, nsec, []);
        ev.pubkey = pk;
        ev.id = nostr.getEventHash(ev);
        nostr.signEvent(ev, nsec as any);
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
    const body: Record<string, any> = await request.json() as any;
    if (!body.text?.trim()) return jsonResponse({ error: 'Text required' }, 400);
    if (!body.targets?.length) return jsonResponse({ error: 'Targets required' }, 400);
    const auth = body.auth ?? {} as Record<string, string>;

    const results: Record<string, { ok: boolean; error?: string }> = {};

    for (const target of body.targets) {
      try {
        switch (target) {
          case 'nostr': {
            const skHex: string = auth.nostr ?? '';
            const sk: any = skHex ? hexToBytes(skHex) : generateSecretKey();
            const pk = getPublicKey(sk as any);
            const ev: any = createTextNote(body.text, sk as string, []);
            ev.pubkey = pk;
            ev.id = getEventHash(ev);
            signEvent(ev, sk as any);
            const pool = new RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], { eoseTimeout: 2000 });
            await pool.publish(ev);
            pool.disconnectAll();
            results[target] = { ok: true };
            break;
          }

          case 'farcaster': {
            // Farcaster Hub submitMessage via REST API
            // This calls the Hub's PUT /v1/submitMessage endpoint
            // The message must be a hex-encoded Message protobuf
            // For full support, use @farcaster/hub-web or @farcaster/protobufs
            const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
            results[target] = { ok: false, error: 'Farcaster publish requires @farcaster/hub-web for Message construction — coming soon. Use external tool to create cast and paste URL.' };
            break;
          }

          case 'lens': {
            // Lens API v2 broadcast — requires EIP-712 typed data signature from wallet
            // The workflow: createPostTypedData → wallet.signTypedData → broadcast
            // For now, return stub with clear instructions
            const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
            results[target] = { ok: false, error: 'Lens broadcast requires wallet signing — use Lens API directly with your wallet.' };
            break;
          }

          case 'bluesky':
          case 'threads': {
            // AT Protocol repo.createRecord
            // Requires PDS session token (accessJwt) stored during sign-in
            const pdsUrl = target === 'bluesky' ? (env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app') : (env.THREADS_PDS_URL || 'https://public.threads.net');
            const accessJwt = auth[target + '_jwt'];
            if (!accessJwt) {
              results[target] = { ok: false, error: 'Not signed into ' + target };
              break;
            }
            // Create record via XRPC — uses the DID from auth or extracts from JWT
            const repoDid = auth[target + '_did'] || '';
            const recordRes = await fetch(pdsUrl + '/xrpc/com.atproto.repo.createRecord', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'authorization': 'Bearer ' + accessJwt },
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
              results[target] = { ok: false, error: target + ' publish failed: ' + errText.slice(0, 100) };
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
            results[target] = { ok: false, error: target + ' not supported' };
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

export async function handleEngage(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
  try {
    const body: Record<string, string | undefined> = await request.json() as any;
    const action = body.action ?? '';
    const postId = body.postId ?? '';
    const protocol = body.protocol ?? '';
    const auth = body.auth as Record<string, string> | undefined;

    if (!action || !postId || !protocol) {
      return jsonResponse({ error: 'action, postId, protocol required' }, 400);
    }

    switch (protocol) {
      case 'nostr': {
        // Nostr reaction via signed event
        results: { nostr: 'Reaction signing requires user key — coming soon' };
        break;
      }
      case 'mastodon': {
        // Mastodon like/repost via GtSClient
        const instance = auth?.mastodon_instance || 'https://social.degenfeed.xyz';
        const token = body.authToken as string || auth?.mastodon || '';
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
