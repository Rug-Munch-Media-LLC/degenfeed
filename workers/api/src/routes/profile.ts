/**
 * Cross-platform identity profile — resolve a handle across all protocols.
 *
 * GET /api/identity/profile?handle=vitalik.eth
 * GET /api/identity/profile?handle=npub1...
 *
 * Returns merged identity with all linked accounts + recent posts from each.
 */

import type { UnifiedPost } from '@degenfeed/types';
import { type Env, jsonResponse } from '../index';

interface LinkedAccount {
  protocol: string;
  id: string;
  handle: string;
  displayName?: string;
  avatarUrl?: string;
}

export async function handleIdentityProfile(request: Request, env: Env): Promise<Response> {
  const handle = new URL(request.url).searchParams.get('handle');
  if (!handle) return jsonResponse({ error: 'handle required' }, 400);

  const cacheKey = `profile:${encodeURIComponent(handle)}`;
  try {
    const cached = await env.CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached));
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  const linked: LinkedAccount[] = [];
  const posts: UnifiedPost[] = [];

  try {
    const { resolveHandle } = await import('@degenfeed/identity');

    if (handle.includes('@') && !handle.startsWith('@') && !handle.startsWith('npub')) {
      const result = await resolveHandle(handle);
      if (result) {
        linked.push({
          protocol: result.protocol,
          id: result.id,
          handle: result.handle || handle,
        });
      }
    }

    if (handle.startsWith('npub1')) {
      linked.push({
        protocol: 'nostr',
        id: handle,
        handle: handle.slice(0, 12),
      });
      try {
        const mod = await import('@degenfeed/nostr-sdk');
        const hex = mod.npubDecode(handle);
        const pool = new mod.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
          eoseTimeout: 3000,
        });
        const metaEvents = await pool.list({ kinds: [0], authors: [hex], limit: 1 }, 3000);
        if (metaEvents.length > 0) {
          try {
            const meta = JSON.parse(metaEvents[0]?.content ?? '{}') as Record<string, string>;
            if (meta.name || meta.display_name) {
              linked[0]!.displayName = meta.display_name || meta.name;
            }
            if (meta.picture) linked[0]!.avatarUrl = meta.picture;
            if (meta.nip05) {
              linked.push({
                protocol: 'nostr',
                id: meta.nip05,
                handle: meta.nip05,
              });
            }
          } catch {
            /* KV operation failed -- non-critical, continue */
          }
        }
        const noteEvents = await pool.list({ kinds: [1], authors: [hex], limit: 5 }, 3000);
        const { buildUnifiedPost, enrichPostNiches } = await import('@degenfeed/feed-core');
        for (const ev of noteEvents) {
          posts.push(
            enrichPostNiches(
              buildUnifiedPost({
                protocol: 'nostr',
                nativeId: ev.id,
                author: {
                  id: `nostr:${ev.pubkey}`,
                  primary: { protocol: 'nostr' as const, id: ev.pubkey },
                  handles: {
                    nostr: ev.pubkey.slice(0, 12),
                    farcaster: null,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: null,
                  },
                  displayName: linked[0]?.displayName || ev.pubkey.slice(0, 12),
                  bio: '',
                  avatarUrl: linked[0]?.avatarUrl || '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: { nostrPubkey: ev.pubkey },
                },
                text: ev.content,
                createdAt: ev.created_at * 1000,
                metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                raw: ev,
              }),
            ),
          );
        }
        pool.disconnectAll();
      } catch {
        /* KV operation failed -- non-critical, continue */
      }
    }

    if (/^\d+$/.test(handle)) {
      const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.pinata.cloud';
      try {
        const res = await fetch(`${hubUrl}/v1/userDataByFid?fid=${handle}`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            messages?: Array<{
              data: { userDataBody: { type: string; value: string } };
            }>;
          };
          const profile: Record<string, string> = {};
          for (const msg of data.messages ?? []) {
            const body = msg.data?.userDataBody;
            if (body?.type === 'USER_DATA_TYPE_USERNAME') profile.username = body.value;
            else if (body?.type === 'USER_DATA_TYPE_DISPLAY') profile.displayName = body.value;
            else if (body?.type === 'USER_DATA_TYPE_PFP') profile.pfp = body.value;
          }
          linked.push({
            protocol: 'farcaster',
            id: handle,
            handle: profile.username || `FID ${handle}`,
            displayName: profile.displayName,
            avatarUrl: profile.pfp,
          });
        }
      } catch {
        /* KV operation failed -- non-critical, continue */
      }
    }
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  const response = {
    handle,
    linkedAccounts: linked,
    totalLinked: linked.length,
    recentPosts: posts.slice(0, 10),
    fetchedAt: Date.now(),
  };

  try {
    await env.CACHE?.put(cacheKey, JSON.stringify(response), {
      expirationTtl: 300,
    });
  } catch {
    /* KV operation failed -- non-critical, continue */
  }

  return jsonResponse(response);
}
