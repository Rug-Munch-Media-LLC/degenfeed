/**
 * Thread/reply view — fetch replies for a post from its native protocol.
 *
 * GET /api/feed/post/:id/replies
 */

import type { UnifiedPost } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handlePostReplies(
  request: Request,
  env: Env,
  postId: string,
): Promise<Response> {
  const decoded = decodeURIComponent(postId);
  const colon = decoded.indexOf(':');
  if (colon === -1) return jsonResponse({ error: 'Invalid post ID format (protocol:id)' }, 400);

  const protocol = decoded.slice(0, colon);
  const nativeId = decoded.slice(colon + 1);
  const limit = Math.min(Number(new URL(request.url).searchParams.get('limit')) || 20, 50);

  try {
    let replies: UnifiedPost[] = [];

    switch (protocol) {
      case 'nostr': {
        const mod = await import('@degenfeed/nostr-sdk');
        const pool = new mod.RelayPool(['wss://relay.damus.io', 'wss://nos.lol'], {
          eoseTimeout: 4000,
        });
        const events = await pool.list({ kinds: [1], '#e': [nativeId], limit: 50 }, 4000);
        const { enrichPostNiches } = await import('@degenfeed/feed-core');
        const { buildUnifiedPost } = await import('@degenfeed/feed-core');
        replies = events.map(
          (ev: {
            id: string;
            pubkey: string;
            created_at: number;
            kind: number;
            tags: string[][];
            content: string;
          }) =>
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
                  displayName: ev.pubkey.slice(0, 12),
                  bio: '',
                  avatarUrl: '',
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
        pool.disconnectAll();
        break;
      }

      case 'mastodon': {
        const instance = env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
        const contextRes = await fetch(`${instance}/api/v1/statuses/${nativeId}/context`, {
          headers: { 'user-agent': 'DegenFeed/0.1' },
        });
        if (contextRes.ok) {
          const ctx = (await contextRes.json()) as {
            descendants?: Array<Record<string, unknown>>;
          };
          const { enrichPostNiches } = await import('@degenfeed/feed-core');
          const { buildUnifiedPost } = await import('@degenfeed/feed-core');
          replies = (ctx.descendants ?? []).slice(0, limit).map((d: Record<string, unknown>) => {
            const acct = d.account as Record<string, string> | undefined;
            return enrichPostNiches(
              buildUnifiedPost({
                protocol: 'mastodon',
                nativeId: d.id as string,
                author: {
                  id: `mastodon:${acct?.id ?? ''}`,
                  primary: {
                    protocol: 'mastodon' as const,
                    id: acct?.id ?? '',
                  },
                  handles: {
                    nostr: null,
                    farcaster: null,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: acct?.acct ?? null,
                  },
                  displayName: (acct?.display_name as string) || (acct?.username as string) || '',
                  bio: '',
                  avatarUrl: (acct?.avatar as string) || '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: {},
                },
                text: (d.content as string)?.replace(/<[^>]*>/g, '') ?? '',
                createdAt: new Date(d.created_at as string).getTime(),
                metrics: {
                  likes: (d.favourites_count as number) ?? 0,
                  reposts: (d.reblogs_count as number) ?? 0,
                  replies: (d.replies_count as number) ?? 0,
                  quotes: 0,
                },
                raw: d,
              }),
            );
          });
        }
        break;
      }

      case 'farcaster': {
        const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
        const res = await fetch(`${hubUrl}/v1/castsByParent?hash=${nativeId}&pageSize=${limit}`, {
          headers: {
            'user-agent': 'DegenFeed/0.1',
            accept: 'application/json',
          },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            messages?: Array<{
              data: { timestamp: number; castAddBody?: { text?: string } };
              hash: string;
            }>;
          };
          const { enrichPostNiches } = await import('@degenfeed/feed-core');
          const { buildUnifiedPost } = await import('@degenfeed/feed-core');
          replies = (data.messages ?? []).slice(0, limit).map((m) => {
            const ts = (m.data.timestamp + 1609459200) * 1000;
            return enrichPostNiches(
              buildUnifiedPost({
                protocol: 'farcaster',
                nativeId: m.hash,
                author: {
                  id: 'farcaster:0',
                  primary: { protocol: 'farcaster' as const, id: '0' },
                  handles: {
                    nostr: null,
                    farcaster: null,
                    lens: null,
                    bluesky: null,
                    threads: null,
                    rss: null,
                    mastodon: null,
                  },
                  displayName: 'Farcaster user',
                  bio: '',
                  avatarUrl: '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: {},
                },
                text: m.data.castAddBody?.text ?? '',
                createdAt: Number.isNaN(ts) ? Date.now() : ts,
                metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
                raw: m,
              }),
            );
          });
        }
        break;
      }

      case 'bluesky': {
        const bskyUrl = env.BSKY_PUBLIC_URL || 'https://public.api.bsky.app';
        const threadRes = await fetch(
          `${bskyUrl}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(nativeId)}&depth=1`,
          { headers: { 'user-agent': 'DegenFeed/0.1' } },
        );
        if (threadRes.ok) {
          const thread = (await threadRes.json()) as {
            thread?: {
              replies?: Array<{
                post: {
                  uri: string;
                  cid: string;
                  record: { text: string; createdAt: string };
                  author: {
                    did: string;
                    handle: string;
                    displayName?: string;
                    avatar?: string;
                  };
                  likeCount?: number;
                  repostCount?: number;
                  replyCount?: number;
                };
              }>;
            };
          };
          const { enrichPostNiches } = await import('@degenfeed/feed-core');
          const { buildUnifiedPost } = await import('@degenfeed/feed-core');
          replies = (thread.thread?.replies ?? []).slice(0, limit).map((r) => {
            const p = r.post;
            return enrichPostNiches(
              buildUnifiedPost({
                protocol: 'bluesky',
                nativeId: p.uri,
                author: {
                  id: `bluesky:${p.author.did}`,
                  primary: { protocol: 'bluesky' as const, id: p.author.did },
                  handles: {
                    nostr: null,
                    farcaster: null,
                    lens: null,
                    bluesky: p.author.handle,
                    threads: null,
                    rss: null,
                    mastodon: null,
                  },
                  displayName: p.author.displayName || p.author.handle,
                  bio: '',
                  avatarUrl: p.author.avatar || '',
                  verified: [],
                  followerCount: 0,
                  followingCount: 0,
                  links: [],
                  keys: { did: p.author.did },
                },
                text: p.record.text,
                createdAt: new Date(p.record.createdAt).getTime(),
                metrics: {
                  likes: p.likeCount ?? 0,
                  reposts: p.repostCount ?? 0,
                  replies: p.replyCount ?? 0,
                  quotes: 0,
                },
                raw: p,
              }),
            );
          });
        }
        break;
      }

      default:
        return jsonResponse({ error: `Replies not supported for ${protocol}` }, 400);
    }

    return jsonResponse({
      data: replies.slice(0, limit),
      meta: { total: replies.length, protocol },
    });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Failed to fetch replies' }, 502);
  }
}
