/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Source Content Fetchers
 *
 * Fetches content from each supported protocol for bridging.
 */

import type { Env } from '../types';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { SourceContent } from './bridge-types';

// ─── Reliability Helpers ───────────────────────────────────────────────

async function reliableFetch<T>(
  protocol: string,
  _context: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    recordBridgeOperation(env, protocol, true, performance.now() - start);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordBridgeOperation(env, protocol, false, performance.now() - start, errorMsg);
    return null;
  }
}

async function _reliableBridgePublish<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    recordBridgeOperation(env, protocol, true, performance.now() - start);
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordBridgeOperation(env, protocol, false, performance.now() - start, errorMsg);
    return null;
  }
}

// ─── ActivityPub (Mastodon) ───────────────────────────────────────────

export async function fetchFromActivityPub(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const instance =
    auth.mastodon_instance || env.GOTOSOCIAL_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = auth.mastodon || auth.mastodon_token;
  if (!accessToken) return null;

  return reliableFetch(
    'activitypub',
    'fetchFromActivityPub',
    async () => {
      const res = await fetch(`${instance}/api/v1/statuses/${nativeId}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`ActivityPub fetch failed: ${res.status}`);
      const data = (await res.json()) as {
        content?: string;
        account?: { display_name?: string };
        media_attachments?: Array<{ type?: string; url?: string }>;
        tags?: Array<{ name?: string }>;
      };
      const text = stripHtml(data.content || '');
      return {
        text,
        images: data.media_attachments
          ?.filter((m) => m.type === 'image')
          .map((m) => ({ url: m.url || '', alt: '' })),
        links: [],
        hashtags: data.tags?.map((t) => t.name || '').filter(Boolean) ?? [],
      };
    },
    env,
  );
}

// ─── AT Protocol (Bluesky) ────────────────────────────────────────────

export async function fetchFromAtProtocol(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
  const did = auth.bluesky_did || auth.did;
  const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';

  return reliableFetch(
    'atproto',
    'fetchFromAtProtocol',
    async () => {
      let repo = did || '';
      let collection = 'app.bsky.feed.post';
      let rkey = nativeId;
      const parts = nativeId.split('/');
      if (parts.length >= 3) {
        repo = (parts[0] || did)!;
        collection = parts[1] || collection;
        rkey = parts[2] || nativeId;
      }

      if (accessJwt && repo) {
        const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`, {
          headers: { authorization: `Bearer ${accessJwt}`, 'content-type': 'application/json' },
          body: JSON.stringify({ repo, collection, rkey }),
          method: 'POST',
        });
        if (res.ok) {
          const data = (await res.json()) as {
            value?: { text?: string; embed?: any; facets?: any[]; createdAt?: string };
          };
          if (data.value) {
            return { text: data.value.text || '', images: [], links: [], hashtags: [] };
          }
        }
      }

      // Public fallback
      const publicRes = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=at://${repo}/${collection}/${rkey}&depth=0`,
        {
          headers: { accept: 'application/json' },
        },
      );
      if (!publicRes.ok) throw new Error(`Bluesky public fetch failed: ${publicRes.status}`);
      const publicData = (await publicRes.json()) as {
        thread?: { post?: { record?: { text?: string }; embed?: any } };
      };
      const post = publicData.thread?.post;
      if (!post?.record) throw new Error('Bluesky post not found');
      return { text: post.record.text || '', images: [], links: [], hashtags: [] };
    },
    env,
  );
}

// ─── Nostr ────────────────────────────────────────────────────────────

export async function fetchFromNostr(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  return reliableFetch(
    'nostr',
    'fetchFromNostr',
    async () => {
      const relayUrls = (
        auth.nostr_relays ||
        env.NOSTR_RELAYS ||
        'wss://relay.damus.io,wss://nos.lol'
      )
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      // Try Bandada API first for speed
      const bandRes = await fetch(`https://api.bandada.com/api/v1/events?id=${nativeId}`);
      if (bandRes.ok) {
        const bandData = (await bandRes.json()) as {
          events?: Array<{ content?: string; tags?: string[][] }>;
        };
        const event = bandData.events?.[0];
        if (event) return buildNostrSourceContent(event);
      }
      // Fallback: Nostr SDK relay pool
      const nostr = await import('@degenfeed/nostr-sdk');
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
      const events = await pool.list([{ ids: [nativeId], kinds: [1, 30023, 30311] }]);
      const event = events?.[0];
      if (!event) throw new Error('Nostr event not found');
      return buildNostrSourceContent(event);
    },
    env,
  );
}

function buildNostrSourceContent(event: { content?: string; tags?: string[][] }): SourceContent {
  const tags = event.tags ?? [];
  const title = tags.find((t) => t[0] === 'title')?.[1];
  const hashtags = tags
    .filter((t) => t[0] === 't')
    .map((t) => t[1])
    .filter(Boolean) as string[];
  const links = tags
    .filter((t) => t[0] === 'r')
    .map((t) => t[1])
    .filter(Boolean) as string[];
  const images = tags
    .filter((t) => t[0] === 'imeta')
    .map((t) => {
      const urlPart = t.find((p) => p.startsWith('url '));
      const altPart = t.find((p) => p.startsWith('alt '));
      return { url: urlPart?.slice(4) || '', alt: altPart?.slice(4) || '' };
    })
    .filter((i) => i.url);
  return { text: event.content || '', title, images, links, hashtags };
}

// ─── Farcaster ────────────────────────────────────────────────────────

export async function fetchFromFarcaster(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const hubUrl = env.FARCASTER_HUB_URL || 'http://127.0.0.1:2281';
  return reliableFetch(
    'farcaster',
    'fetchFromFarcaster',
    async () => {
      const hexId = nativeId.replace('0x', '');
      const res = await fetch(`${hubUrl}/v1/castById?fid=0&hash=0x${hexId}`);
      if (!res.ok) throw new Error(`Farcaster fetch failed: ${res.status}`);
      const data = (await res.json()) as {
        data?: { castAddBody?: { text?: string; embeds?: Array<{ url?: string }> } };
      };
      const body = data.data?.castAddBody;
      if (!body) throw new Error('Farcaster cast not found');
      return {
        text: body.text || '',
        images: [],
        links: (body.embeds ?? []).map((e) => e.url || '').filter(Boolean),
        hashtags: [],
      };
    },
    env,
  );
}

// ─── Lens ─────────────────────────────────────────────────────────────

export async function fetchFromLens(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
  return reliableFetch(
    'lens',
    'fetchFromLens',
    async () => {
      const res = await fetch(lensApi, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `{ publication(request: { publicationId: "${nativeId}" }) { metadata { content } } }`,
        }),
      });
      if (!res.ok) throw new Error(`Lens fetch failed: ${res.status}`);
      const data = (await res.json()) as {
        data?: { publication?: { metadata?: { content?: string } } };
      };
      const content = data.data?.publication?.metadata?.content;
      if (!content) throw new Error('Lens publication not found');
      return { text: content, images: [], links: [], hashtags: [] };
    },
    env,
  );
}

// ─── Telegram ─────────────────────────────────────────────────────────

export async function fetchFromTelegram(
  _nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const botToken = auth.telegram_bot_token || env.TELEGRAM_BOT_TOKEN;
  const chatId = auth.telegram_chat_id || auth.chat_id;
  if (!botToken || !chatId) return null;

  return reliableFetch(
    'telegram',
    'fetchFromTelegram',
    async () => {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`);
      if (!res.ok) throw new Error(`Telegram fetch failed: ${res.status}`);
      const data = (await res.json()) as {
        ok?: boolean;
        result?: { bio?: string; description?: string };
      };
      return {
        text: data.result?.bio || data.result?.description || '',
        images: [],
        links: [],
        hashtags: [],
      };
    },
    env,
  );
}

// ─── RSS ──────────────────────────────────────────────────────────────

export async function fetchFromRss(
  _nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const feedUrl = auth.rss_feed_url;
  if (!feedUrl) return null;

  return reliableFetch(
    'rss',
    'fetchFromRss',
    async () => {
      const res = await fetch(feedUrl);
      if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
      const xml = await res.text();
      const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/gi);
      if (!itemMatch) throw new Error('No RSS items found');
      const item = itemMatch[0] || '';
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
      const description = item.match(/<description>(.*?)<\/description>/)?.[1] ?? '';
      const cleanDescription = stripHtml(description);
      return {
        text: cleanDescription || title,
        title: title || undefined,
        images: [],
        links: [],
        hashtags: [],
      };
    },
    env,
  );
}

// ─── Zora ─────────────────────────────────────────────────────────────

export async function fetchFromZora(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  return reliableFetch(
    'zora',
    'fetchFromZora',
    async () => {
      const res = await fetch(`https://api.zora.co/v2/collections?address=${nativeId}`, {
        headers: { 'content-type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Zora fetch failed: ${res.status}`);
      const data = (await res.json()) as {
        data?: { collections?: Array<{ name?: string; description?: string }> };
      };
      const collection = data.data?.collections?.[0];
      if (!collection) throw new Error('Zora collection not found');
      return {
        text: collection.description || collection.name || '',
        title: collection.name,
        images: [],
        links: [],
        hashtags: [],
      };
    },
    env,
  );
}

// ─── Main Fetch Dispatcher ────────────────────────────────────────────

export async function fetchSourceContent(
  protocol: string,
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const normalized = normalizeProtocol(protocol);
  switch (normalized) {
    case 'mastodon':
      return fetchFromActivityPub(nativeId, auth, env);
    case 'bluesky':
      return fetchFromAtProtocol(nativeId, auth, env);
    case 'nostr':
      return fetchFromNostr(nativeId, auth, env);
    case 'farcaster':
      return fetchFromFarcaster(nativeId, auth, env);
    case 'lens':
      return fetchFromLens(nativeId, auth, env);
    case 'telegram':
      return fetchFromTelegram(nativeId, auth, env);
    case 'rss':
      return fetchFromRss(nativeId, auth, env);
    case 'zora':
      return fetchFromZora(nativeId, auth, env);
    default:
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

function normalizeProtocol(p: string): string {
  if (p === 'activitypub' || p === 'mastodon') return 'mastodon';
  if (p === 'atproto' || p === 'bluesky') return 'bluesky';
  return p;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
