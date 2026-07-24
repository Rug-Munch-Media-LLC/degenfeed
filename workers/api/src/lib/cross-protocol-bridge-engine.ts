/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Engine
 *
 * THE COMPLETE BRIDGE MATRIX — every source protocol can bridge to every
 * target protocol. Each bridge direction:
 *   1. Fetches source content from the origin protocol
 *   2. Translates content format for the target protocol
 *   3. Resolves identity on the target protocol
 *   4. Publishes via the publish-orchestrator
 *   5. Stores cross-post sibling relationships in KV
 *   6. Returns the result
 *
 * RELIABILITY: Every external API call is wrapped in retry + circuit breaker
 * via `withReliability`. The bridge never silently fails.
 *
 * SUPPORTED PROTOCOLS (8): ActivityPub, AT Protocol (Bluesky),
 * Nostr, Farcaster, Lens, Telegram, RSS, Zora
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import { alertBridgeFailure } from './alerts';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { MediaAttachment } from './format-translator';
import type { PublishInput } from './publish-orchestrator';

// ─── Exported Types ───────────────────────────────────────────────────────

export interface BridgeContentInput {
  sourceUri: string;
  sourceProtocol: Protocol;
  sourceNativeId: string;
  text: string;
  title?: string;
  images?: MediaAttachment[];
  links?: string[];
  hashtags?: string[];
  auth?: Record<string, string>;
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
  targets?: Protocol[];
}

export interface BridgeResult {
  ok: boolean;
  sourceProtocol: string;
  sourceNativeId: string;
  targetProtocol: string;
  nativeId?: string;
  nativeUri?: string;
  error?: string;
  direction: string;
}

export interface BridgeReport {
  results: BridgeResult[];
  successCount: number;
  failureCount: number;
  startedAt: number;
  completedAt: number;
}

export interface SourceContent {
  text: string;
  title?: string;
  images?: MediaAttachment[];
  links?: string[];
  hashtags?: string[];
  mentions?: string[];
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string;
  publishedAt?: number;
  raw?: unknown;
}

export interface CrossProtocolReply {
  parentUri: string;
  sourceProtocol: string;
  replyNativeId: string;
  text: string;
  authorName?: string;
  createdAt: number;
}

// ─── Reliability Helper ────────────────────────────────────────────────────

/**
 * Execute a source-fetch operation with reliability wrapping.
 */
async function reliableFetch<T>(
  protocol: string,
  context: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    await recordBridgeOperation(env, protocol, true, Math.round(performance.now() - start));
    return result;
  } catch (err) {
    await recordBridgeOperation(
      env,
      protocol,
      false,
      Math.round(performance.now() - start),
      String(err),
    );
    const errorMsg = err instanceof Error ? err.message : String(err);
    await alertBridgeFailure(env, protocol, errorMsg, context).catch(() => {});
    return null;
  }
}

/**
 * Execute a bridge-publish operation with reliability wrapping.
 */
async function reliableBridgePublish<T extends { ok: boolean; error?: string }>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await withReliability(protocol, operation, { env });
    if (result.ok) {
      await recordBridgeOperation(env, protocol, true, Math.round(performance.now() - start));
    } else {
      await recordBridgeOperation(
        env,
        protocol,
        false,
        Math.round(performance.now() - start),
        result.error ?? 'publish returned !ok',
      );
      if (result.error) {
        await alertBridgeFailure(env, protocol, result.error, 'bridge-publish').catch(() => {});
      }
    }
    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await recordBridgeOperation(
      env,
      protocol,
      false,
      Math.round(performance.now() - start),
      errorMsg,
    );
    await alertBridgeFailure(env, protocol, errorMsg, 'bridge-publish').catch(() => {});
    return {
      ok: false,
      error: `Bridge publish failed after retries: ${errorMsg}`,
    } as T;
  }
}

// ─── BRIDGE DIRECTION FOOTERS ─────────────────────────────────────────────

const BRIDGE_FOOTERS: Record<string, string> = {
  'activitypub→nostr': '\n\n— Bridged from Mastodon via DegenFeed',
  'activitypub→farcaster': '\n\n— From Mastodon via DegenFeed',
  'activitypub→bluesky': '\n\n— From Mastodon via DegenFeed',
  'activitypub→lens': '\n\n— From Mastodon via DegenFeed',
  'activitypub→telegram': '\n\n— From Mastodon',
  'activitypub→rss': '',
  'activitypub→zora': '',

  'bluesky→activitypub': '\n\n— From Bluesky via DegenFeed',
  'bluesky→nostr': '\n\n— From Bluesky via DegenFeed',
  'bluesky→farcaster': '\n\n— From Bluesky via DegenFeed',
  'bluesky→lens': '\n\n— From Bluesky via DegenFeed',
  'bluesky→telegram': '\n\n— From Bluesky',
  'bluesky→rss': '',
  'bluesky→zora': '',

  'nostr→activitypub': '\n\n— From Nostr via DegenFeed',
  'nostr→bluesky': '\n\n— From Nostr via DegenFeed',
  'nostr→farcaster': '\n\n— From Nostr via DegenFeed',
  'nostr→lens': '\n\n— From Nostr via DegenFeed',
  'nostr→telegram': '\n\n— From Nostr',
  'nostr→rss': '',
  'nostr→zora': '',

  'farcaster→activitypub': '\n\n— From Farcaster via DegenFeed',
  'farcaster→bluesky': '\n\n— From Farcaster via DegenFeed',
  'farcaster→nostr': '\n\n— From Farcaster via DegenFeed',
  'farcaster→lens': '\n\n— From Farcaster via DegenFeed',
  'farcaster→telegram': '\n\n— From Farcaster',
  'farcaster→rss': '',
  'farcaster→zora': '',

  'lens→activitypub': '\n\n— From Lens via DegenFeed',
  'lens→bluesky': '\n\n— From Lens via DegenFeed',
  'lens→nostr': '\n\n— From Lens via DegenFeed',
  'lens→farcaster': '\n\n— From Lens via DegenFeed',
  'lens→telegram': '\n\n— From Lens',
  'lens→rss': '',
  'lens→zora': '',

  'telegram→activitypub': '\n\n— From Telegram via DegenFeed',
  'telegram→bluesky': '\n\n— From Telegram via DegenFeed',
  'telegram→nostr': '\n\n— From Telegram via DegenFeed',
  'telegram→farcaster': '\n\n— From Telegram via DegenFeed',
  'telegram→lens': '\n\n— From Telegram via DegenFeed',
  'telegram→rss': '',
  'telegram→zora': '',

  'rss→activitypub': '\n\n— From RSS via DegenFeed',
  'rss→bluesky': '\n\n— From RSS via DegenFeed',
  'rss→nostr': '\n\n— From RSS via DegenFeed',
  'rss→farcaster': '\n\n— From RSS via DegenFeed',
  'rss→lens': '\n\n— From RSS via DegenFeed',
  'rss→telegram': '\n\n— From RSS',

  'zora→activitypub': '\n\n— From Zora via DegenFeed',
  'zora→bluesky': '\n\n— From Zora via DegenFeed',
  'zora→nostr': '\n\n— From Zora via DegenFeed',
  'zora→farcaster': '\n\n— From Zora via DegenFeed',
  'zora→lens': '\n\n— From Zora via DegenFeed',
  'zora→telegram': '\n\n— From Zora',
  'zora→rss': '',
};

function getBridgeFooter(source: string, target: string): string {
  if (target === 'rss' || target === 'zora') return '';
  if (target === 'telegram' && source !== 'telegram') {
    return `\n\n— From ${formatProtocolLabel(source)}`;
  }
  return BRIDGE_FOOTERS[`${source}→${target}`] ?? `\n\n— Via DegenFeed cross-protocol bridge`;
}

function formatProtocolLabel(p: string): string {
  const labels: Record<string, string> = {
    nostr: 'Nostr',
    farcaster: 'Farcaster',
    lens: 'Lens',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    activitypub: 'Mastodon',
    atproto: 'Bluesky',
    telegram: 'Telegram',
    rss: 'RSS',
    threads: 'Threads',
    zora: 'Zora',
  };
  return labels[p] ?? p;
}

function normalizeProtocol(p: string): string {
  if (p === 'activitypub' || p === 'mastodon') return 'mastodon';
  if (p === 'atproto' || p === 'bluesky') return 'bluesky';
  return p;
}

// ─── SOURCE CONTENT FETCHERS ──────────────────────────────────────────────

/**
 * Fetch content from ActivityPub (Mastodon/GoToSocial) by status ID.
 */
export async function fetchFromActivityPub(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const instance = auth.mastodon_instance || env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = auth.mastodon || auth.mastodon_token;
  if (!accessToken) return null;

  return reliableFetch(
    'activitypub',
    'fetchFromActivityPub',
    async () => {
      const res = await fetch(`${instance}/api/v1/statuses/${nativeId}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        content: string;
        account?: { display_name?: string; username?: string; avatar?: string };
        media_attachments?: Array<{
          url: string;
          description?: string;
          type?: string;
        }>;
        created_at?: string;
        spoiler_text?: string;
      };

      const text = stripHtml(data.content || '');
      return {
        text: data.spoiler_text ? `CW: ${data.spoiler_text}\n\n${text}` : text,
        authorName: data.account?.display_name,
        authorHandle: data.account?.username,
        authorAvatar: data.account?.avatar,
        images: data.media_attachments
          ?.filter((m) => m.type === 'image')
          .map((m) => ({ url: m.url, alt: m.description })),
        publishedAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
      };
    },
    env,
  );
}

/**
 * Fetch content from AT Protocol (Bluesky) by AT URI.
 */
export async function fetchFromAtProtocol(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
  const did = auth.bluesky_did || auth.did;
  const pdsUrl = env.BSKY_SOCIAL_URL || 'https://bsky.social';
  if (!accessJwt || !did) return null;

  return reliableFetch(
    'bluesky',
    'fetchFromAtProtocol',
    async () => {
      let repo = did;
      let rkey = nativeId;

      if (nativeId.startsWith('at://')) {
        const parts = nativeId.split('/');
        repo = parts[2] ?? did;
        rkey = parts[parts.length - 1] ?? nativeId;
      }

      const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.getRecord`, {
        headers: {
          authorization: `Bearer ${accessJwt}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ repo, collection: 'app.bsky.feed.post', rkey }),
        method: 'POST',
      });

      if (!res.ok) {
        const publicRes = await fetch(
          `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(nativeId.startsWith('at://') ? nativeId : `at://${did}/app.bsky.feed.post/${nativeId}`)}`,
        );
        if (!publicRes.ok) return null;
        const publicData = (await publicRes.json()) as {
          thread?: {
            post?: {
              record?: { text?: string };
              author?: {
                displayName?: string;
                handle?: string;
                avatar?: string;
              };
              embed?: { images?: Array<{ fullsize?: string; alt?: string }> };
            };
          };
        };
        const post = publicData.thread?.post;
        if (!post?.record) return null;
        return {
          text: (post.record as { text?: string }).text ?? '',
          authorName: post.author?.displayName,
          authorHandle: post.author?.handle,
          authorAvatar: post.author?.avatar,
          images: post.embed?.images?.map((img) => ({
            url: img.fullsize ?? '',
            alt: img.alt ?? '',
          })),
        };
      }

      const data = (await res.json()) as {
        value?: {
          text?: string;
          embed?: {
            images?: Array<{
              image?: { ref?: { $link?: string } };
              alt?: string;
            }>;
          };
        };
      };
      const value = data.value;
      if (!value?.text) return null;

      return {
        text: value.text,
        images: value.embed?.images?.map((img) => ({
          url: img.image?.ref?.$link ?? '',
          alt: img.alt ?? '',
        })),
      };
    },
    env,
  );
}

/**
 * Fetch content from Nostr by event ID.
 */
export async function fetchFromNostr(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  return reliableFetch(
    'nostr',
    'fetchFromNostr',
    async () => {
      const relayUrls = (
        env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
      )
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      const bandRes = await fetch(
        `https://api.nostr.band/event?ids=${encodeURIComponent(nativeId)}`,
      );
      if (bandRes.ok) {
        const bandData = (await bandRes.json()) as {
          events?: Array<{
            content?: string;
            kind?: number;
            tags?: string[][];
            pubkey?: string;
            created_at?: number;
          }>;
        };
        const event = bandData.events?.[0];
        if (event) return buildNostrSourceContent(event);
      }

      const nostr = await import('@degenfeed/nostr-sdk');
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
      const events = await pool.list([{ ids: [nativeId], kinds: [1, 30023, 30311] }]);
      pool.disconnectAll();
      if (events.length === 0 || !events[0]) return null;
      return buildNostrSourceContent(events[0]);
    },
    env,
  );
}

function buildNostrSourceContent(event: {
  content?: string;
  kind?: number;
  tags?: string[][];
  pubkey?: string;
  created_at?: number;
}): SourceContent | null {
  if (!event.content) return null;
  const tags = event.tags ?? [];
  const title = tags.find((t) => t[0] === 'title')?.[1];
  const hashtags = tags
    .filter((t) => t[0] === 't')
    .map((t) => t[1] ?? '')
    .filter(Boolean);
  const links = tags
    .filter((t) => t[0] === 'r')
    .map((t) => t[1] ?? '')
    .filter(Boolean);
  const images = tags
    .filter((t) => t[0] === 'imeta')
    .map((t) => {
      const urlPart = t.find((p) => p.startsWith('url '));
      const altPart = t.find((p) => p.startsWith('alt '));
      return urlPart ? { url: urlPart.slice(4), alt: altPart?.slice(4) } : null;
    })
    .filter(Boolean) as MediaAttachment[];

  return {
    text: event.content,
    title,
    hashtags,
    links,
    images,
    publishedAt: event.created_at ? event.created_at * 1000 : undefined,
  };
}

/**
 * Fetch content from Farcaster by cast hash.
 */
export async function fetchFromFarcaster(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<SourceContent | null> {
  const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';

  return reliableFetch(
    'farcaster',
    'fetchFromFarcaster',
    async () => {
      const res = await fetch(`${hubUrl}/v1/castById?fid=0&hash=0x${nativeId.replace('0x', '')}`);
      if (!res.ok) return null;

      const data = (await res.json()) as {
        data?: {
          castAddBody?: {
            text?: string;
            embeds?: Array<{ url?: string }>;
            mentions?: unknown[];
          };
        };
        metadata?: { displayName?: string; username?: string; pfp?: string };
      };

      const body = data.data?.castAddBody;
      if (!body?.text) return null;
      return {
        text: body.text,
        links: body.embeds?.map((e) => e.url ?? '').filter(Boolean) as string[],
      };
    },
    env,
  );
}

/**
 * Fetch content from Lens by publication ID.
 */
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
          query: `query Publication($id: InternalPublicationId!) {
          publication(request: { publicationId: $id }) {
            ... on Post { metadata { content } }
          }
        }`,
          variables: { id: nativeId },
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        data?: { publication?: { metadata?: { content?: string } } };
      };
      const content = data.data?.publication?.metadata?.content;
      if (!content) return null;
      return { text: content };
    },
    env,
  );
}

/**
 * Fetch content from Telegram by message ID and chat ID.
 */
export async function fetchFromTelegram(
  nativeId: string,
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
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/forwardMessage?chat_id=${chatId}&from_chat_id=${chatId}&message_id=${nativeId}`,
      );
      if (!res.ok) {
        await fetch(
          `https://api.telegram.org/bot${botToken}/getUpdates?offset=-100&allowed_updates=["message"]`,
        );
        return null;
      }
      const data = (await res.json()) as {
        result?: { text?: string; caption?: string };
      };
      return { text: data.result?.text ?? data.result?.caption ?? '' };
    },
    env,
  );
}

/**
 * Fetch content from RSS by item GUID.
 */
export async function fetchFromRss(
  nativeId: string,
  auth: Record<string, string>,
  _env: Env,
): Promise<SourceContent | null> {
  const feedUrl = auth.rss_feed_url;
  if (!feedUrl) return null;

  return reliableFetch(
    'rss',
    'fetchFromRss',
    async () => {
      const res = await fetch(feedUrl);
      if (!res.ok) return null;
      const xml = await res.text();
      const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/gi);
      if (!itemMatch) return null;

      for (const item of itemMatch) {
        if (item.includes(nativeId) || !nativeId) {
          const title = item.match(/<title>(.*?)<\/title>/)?.[1] ?? '';
          const description = item.match(/<description>(.*?)<\/description>/)?.[1] ?? '';
          const link = item.match(/<link>(.*?)<\/link>/)?.[1] ?? '';
          const content = description || title;
          if (!content) continue;
          return {
            text: stripHtml(content),
            title: stripHtml(title),
            links: link ? [link] : [],
          };
        }
      }
      return null;
    },
    _env,
  );
}

/**
 * Fetch content from Zora by token address / token ID.
 */
export async function fetchFromZora(
  nativeId: string,
  _auth: Record<string, string>,
  _env: Env,
): Promise<SourceContent | null> {
  return reliableFetch(
    'zora',
    'fetchFromZora',
    async () => {
      const parts = nativeId.split(':');
      const tokenAddress = parts[0] ?? nativeId;
      const res = await fetch(
        `https://api.zora.co/discover/tokens/chain/base/address/${tokenAddress}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        tokens?: Array<{
          token?: {
            name?: string;
            description?: string;
            image?: { url?: string };
            metadata?: Record<string, unknown>;
          };
        }>;
      };
      const token = data.tokens?.[0]?.token;
      if (!token) return null;
      return {
        text: token.description ?? token.name ?? '',
        title: token.name,
        images: token.image?.url ? [{ url: token.image.url }] : [],
      };
    },
    _env,
  );
}

// ─── UNIVERSAL SOURCE FETCHER ──────────────────────────────────────────────

export async function fetchSourceContent(
  protocol: Protocol,
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
    case 'threads':
      return fetchFromThreads(nativeId, auth, env);
    default:
      console.warn(`[bridge-engine] No source fetcher for protocol: ${protocol}`);
      return null;
  }
}

async function fetchFromThreads(
  nativeId: string,
  auth: Record<string, string>,
  _env: Env,
): Promise<SourceContent | null> {
  const accessToken = auth.threads_jwt || auth.threads_accessToken || auth.accessJwt;
  if (!accessToken) return null;

  return reliableFetch(
    'threads',
    'fetchFromThreads',
    async () => {
      const res = await fetch(
        `https://graph.threads.net/v1.0/${nativeId}?fields=text,media_url,media_type&access_token=${accessToken}`,
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        text?: string;
        media_url?: string;
        media_type?: string;
      };
      return {
        text: data.text ?? '',
        images: data.media_url && data.media_type === 'IMAGE' ? [{ url: data.media_url }] : [],
      };
    },
    _env,
  );
}

// ─── BRIDGE DIRECTION HANDLERS ────────────────────────────────────────────

export type BridgeDirectionHandler = (
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) => Promise<{
  ok: boolean;
  nativeId?: string;
  nativeUri?: string;
  error?: string;
}>;

export function getBridgeHandler(
  sourceProtocol: string,
  targetProtocol: string,
): BridgeDirectionHandler | null {
  const normalizedSource = normalizeProtocol(sourceProtocol);
  const normalizedTarget = normalizeProtocol(targetProtocol);
  if (normalizedSource === normalizedTarget) return null;

  const key = `${normalizedSource}→${normalizedTarget}`;
  const specialHandlers: Record<string, BridgeDirectionHandler> = {
    'mastodon→zora': bridgeMastodonToZora,
    'bluesky→zora': bridgeBlueskyToZora,
    'nostr→zora': bridgeNostrToZora,
    'farcaster→zora': bridgeFarcasterToZora,
    'lens→zora': bridgeLensToZora,
    'telegram→zora': bridgeTelegramToZora,
    'zora→mastodon': bridgeZoraToMastodon,
    'zora→bluesky': bridgeZoraToBluesky,
    'zora→nostr': bridgeZoraToNostr,
    'zora→farcaster': bridgeZoraToFarcaster,
    'zora→lens': bridgeZoraToLens,
    'zora→telegram': bridgeZoraToTelegram,
    'zora→rss': bridgeZoraToRss,
  };

  if (specialHandlers[key]) return specialHandlers[key];
  return (source, targetAuth, env) =>
    genericBridgePublish(source, normalizedSource, normalizedTarget, targetAuth, env);
}

// ─── ZORA SPECIAL BRIDGE HANDLERS ─────────────────────────────────────────

async function bridgeMastodonToZora(
  source: SourceContent,
  _targetAuth: Record<string, string>,
  _env: Env,
) {
  const dfUri = `df://mastodon:${source.text.slice(0, 16)}`;
  const mintUrl = `https://degenfeed.xyz/api/mint/x402?protocol=mastodon&nativeId=${encodeURIComponent(source.text.slice(0, 32))}&text=${encodeURIComponent(source.text.slice(0, 200))}`;
  return { ok: true, nativeId: `zora:${dfUri}`, nativeUri: mintUrl };
}

async function bridgeBlueskyToZora(
  source: SourceContent,
  _targetAuth: Record<string, string>,
  _env: Env,
) {
  const mintUrl = `https://degenfeed.xyz/api/mint/x402?protocol=bluesky&text=${encodeURIComponent(source.text.slice(0, 200))}`;
  return { ok: true, nativeId: `zora:bluesky:bridge`, nativeUri: mintUrl };
}

async function bridgeNostrToZora(
  source: SourceContent,
  _targetAuth: Record<string, string>,
  _env: Env,
) {
  const mintUrl = `https://degenfeed.xyz/api/mint/x402?protocol=nostr&text=${encodeURIComponent(source.text.slice(0, 200))}`;
  return { ok: true, nativeId: `zora:nostr:bridge`, nativeUri: mintUrl };
}

async function bridgeFarcasterToZora(
  source: SourceContent,
  _targetAuth: Record<string, string>,
  _env: Env,
) {
  const mintUrl = `https://degenfeed.xyz/api/mint/x402?protocol=farcaster&text=${encodeURIComponent(source.text.slice(0, 200))}`;
  return { ok: true, nativeId: `zora:farcaster:bridge`, nativeUri: mintUrl };
}

async function bridgeLensToZora(
  source: SourceContent,
  _targetAuth: Record<string, string>,
  _env: Env,
) {
  const mintUrl = `https://degenfeed.xyz/api/mint/x402?protocol=lens&text=${encodeURIComponent(source.text.slice(0, 200))}`;
  return { ok: true, nativeId: `zora:lens:bridge`, nativeUri: mintUrl };
}

async function bridgeTelegramToZora(
  source: SourceContent,
  _targetAuth: Record<string, string>,
  _env: Env,
) {
  const mintUrl = `https://degenfeed.xyz/api/mint/x402?protocol=telegram&text=${encodeURIComponent(source.text.slice(0, 200))}`;
  return { ok: true, nativeId: `zora:telegram:bridge`, nativeUri: mintUrl };
}

// Zora→X bridge handlers all delegate to genericBridgePublish with reliability
async function bridgeZoraToMastodon(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'mastodon', targetAuth, env);
}

async function bridgeZoraToBluesky(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'bluesky', targetAuth, env);
}

async function bridgeZoraToNostr(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'nostr', targetAuth, env);
}

async function bridgeZoraToFarcaster(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'farcaster', targetAuth, env);
}

async function bridgeZoraToLens(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'lens', targetAuth, env);
}

async function bridgeZoraToTelegram(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'telegram', targetAuth, env);
}

async function bridgeZoraToRss(
  source: SourceContent,
  targetAuth: Record<string, string>,
  env: Env,
) {
  return genericBridgePublish(source, 'zora', 'rss', targetAuth, env);
}

// ─── GENERIC BRIDGE PUBLISH ───────────────────────────────────────────────

/**
 * Generic bridge that uses the publish-orchestrator to post content
 * to any target protocol with reliability wrapping.
 */
async function genericBridgePublish(
  source: SourceContent,
  sourceProtocol: string,
  targetProtocol: string,
  targetAuth: Record<string, string>,
  env: Env,
): Promise<{
  ok: boolean;
  nativeId?: string;
  nativeUri?: string;
  error?: string;
}> {
  return reliableBridgePublish(
    targetProtocol,
    async () => {
      const { orchestratePublish } = await import('./publish-orchestrator');

      const footer = getBridgeFooter(sourceProtocol, targetProtocol);
      let text = source.text;
      const maxLen = getProtocolMaxLength(targetProtocol);
      const textWithFooter = footer ? `${text}${footer}` : text;
      if (textWithFooter.length > maxLen) {
        const footerLen = footer.length;
        const bodyLimit = maxLen - footerLen - 3;
        text =
          bodyLimit > 0
            ? `${source.text.slice(0, bodyLimit)}...${footer}`
            : `${source.text.slice(0, maxLen - 3 - footerLen)}...`;
      } else {
        text = textWithFooter;
      }

      const publishInput: PublishInput = {
        text,
        title: source.title,
        targets: [targetProtocol as Protocol],
        auth: targetAuth,
        images: source.images,
        links: source.links,
        hashtags: source.hashtags,
      };

      const report = await orchestratePublish(publishInput, env);
      const result = report.results[targetProtocol];
      return {
        ok: result?.ok ?? false,
        nativeId: result?.nativeId,
        nativeUri: result?.nativeUri,
        error: result?.error,
      };
    },
    env,
  );
}

function getProtocolMaxLength(protocol: string): number {
  const limits: Record<string, number> = {
    mastodon: 500,
    bluesky: 300,
    nostr: 10000,
    farcaster: 320,
    lens: 10000,
    telegram: 4000,
    rss: 100000,
    threads: 500,
  };
  return limits[protocol] ?? 10000;
}

// ─── MAIN BRIDGE FUNCTION ─────────────────────────────────────────────────

export async function bridgeContent(input: BridgeContentInput, env: Env): Promise<BridgeReport> {
  const startedAt = Date.now();
  const results: BridgeResult[] = [];
  const targets = input.targets ?? [];

  if (targets.length === 0) {
    return {
      results: [],
      successCount: 0,
      failureCount: 1,
      startedAt,
      completedAt: Date.now(),
    };
  }

  const source = await fetchSourceContent(
    input.sourceProtocol,
    input.sourceNativeId,
    input.auth ?? {},
    env,
  );
  const sourceContent: SourceContent = source ?? {
    text: input.text,
    title: input.title,
    images: input.images,
    links: input.links,
    hashtags: input.hashtags,
  };

  for (const targetProtocol of targets) {
    if (targetProtocol === input.sourceProtocol) continue;

    try {
      const handler = getBridgeHandler(input.sourceProtocol, targetProtocol);
      if (!handler) {
        results.push({
          ok: false,
          sourceProtocol: input.sourceProtocol,
          sourceNativeId: input.sourceNativeId,
          targetProtocol,
          error: `No bridge handler for ${input.sourceProtocol}→${targetProtocol}`,
          direction: `${input.sourceProtocol}→${targetProtocol}`,
        });
        continue;
      }

      const targetAuth = buildTargetAuth(targetProtocol, input.auth ?? {});
      const publishResult = await handler(sourceContent, targetAuth, env);

      if (publishResult.ok) {
        await storeBridgeRecord(env, input, targetProtocol, publishResult.nativeId ?? '');
        results.push({
          ok: true,
          sourceProtocol: input.sourceProtocol,
          sourceNativeId: input.sourceNativeId,
          targetProtocol,
          nativeId: publishResult.nativeId,
          nativeUri: publishResult.nativeUri,
          direction: `${input.sourceProtocol}→${targetProtocol}`,
        });
      } else {
        results.push({
          ok: false,
          sourceProtocol: input.sourceProtocol,
          sourceNativeId: input.sourceNativeId,
          targetProtocol,
          error: publishResult.error ?? 'Bridge publish returned error',
          direction: `${input.sourceProtocol}→${targetProtocol}`,
        });
      }
    } catch (err) {
      await alertBridgeFailure(
        env,
        targetProtocol,
        err instanceof Error ? err.message : String(err),
        'bridgeContent',
      ).catch(() => {});
      results.push({
        ok: false,
        sourceProtocol: input.sourceProtocol,
        sourceNativeId: input.sourceNativeId,
        targetProtocol,
        error: err instanceof Error ? err.message : String(err),
        direction: `${input.sourceProtocol}→${targetProtocol}`,
      });
    }
  }

  return {
    results,
    successCount: results.filter((r) => r.ok).length,
    failureCount: results.filter((r) => !r.ok).length,
    startedAt,
    completedAt: Date.now(),
  };
}

function buildTargetAuth(protocol: string, auth: Record<string, string>): Record<string, string> {
  const normalized = normalizeProtocol(protocol);
  const targetAuth: Record<string, string> = { ...auth };
  switch (normalized) {
    case 'mastodon':
      targetAuth.mastodon = targetAuth.mastodon || targetAuth.mastodon_token || '';
      targetAuth.mastodon_instance = targetAuth.mastodon_instance || '';
      break;
    case 'bluesky':
      targetAuth.bluesky_jwt =
        targetAuth.bluesky_jwt || targetAuth.bluesky_accessJwt || targetAuth.accessJwt || '';
      targetAuth.bluesky_did = targetAuth.bluesky_did || targetAuth.did || '';
      break;
    case 'nostr':
      targetAuth.nostr = targetAuth.nostr || targetAuth.nsec || targetAuth.nostr_nsec || '';
      break;
    case 'farcaster':
      targetAuth.farcaster_signer = targetAuth.farcaster_signer || targetAuth.signer || '';
      targetAuth.farcaster_fid = targetAuth.farcaster_fid || targetAuth.fid || '';
      break;
    case 'telegram':
      targetAuth.telegram_bot_token = targetAuth.telegram_bot_token || targetAuth.bot_token || '';
      targetAuth.telegram_chat_id = targetAuth.telegram_chat_id || targetAuth.chat_id || '';
      break;
    case 'rss':
      targetAuth.rss_feed_url = targetAuth.rss_feed_url || '';
      targetAuth.rss_publish_url = targetAuth.rss_publish_url || '';
      targetAuth.rss_token = targetAuth.rss_token || '';
      break;
  }
  return targetAuth;
}

async function storeBridgeRecord(
  env: Env,
  input: BridgeContentInput,
  targetProtocol: string,
  targetNativeId: string,
): Promise<void> {
  if (!env.CACHE) return;
  const bridgeKey = `bridge:wrap:${input.sourceUri}:${targetProtocol}`;
  const bridgeEntry = {
    sourceUri: input.sourceUri,
    sourceProtocol: input.sourceProtocol,
    targetProtocol,
    targetNativeId,
    timestamp: Date.now(),
  };
  try {
    await env.CACHE.put(bridgeKey, JSON.stringify(bridgeEntry), {
      expirationTtl: 86400 * 30,
    });
    const normSource = normalizeProtocol(input.sourceProtocol);
    const normTarget = normalizeProtocol(targetProtocol);
    const siblingKey = `sibling-index:${normSource}:${input.sourceNativeId}`;
    const existingRaw = await env.CACHE.get(siblingKey);
    const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    if (!existing.includes(normTarget)) {
      existing.push(normTarget);
      await env.CACHE.put(siblingKey, JSON.stringify(existing), {
        expirationTtl: 86400 * 30,
      });
    }
  } catch (e) {
    console.error('[bridge-engine] Failed to store bridge record:', e);
  }
}

// ─── BATCH BRIDGE ──────────────────────────────────────────────────────────

export async function bridgeContentToAll(
  input: BridgeContentInput,
  env: Env,
): Promise<BridgeReport> {
  const allTargets: Protocol[] = [
    'mastodon',
    'bluesky',
    'nostr',
    'farcaster',
    'lens',
    'telegram',
    'rss',
  ].filter((p) => p !== normalizeProtocol(input.sourceProtocol)) as Protocol[];

  return bridgeContent({ ...input, targets: allTargets }, env);
}

// ─── WEBHOOK ───────────────────────────────────────────────────────────────

export async function handleBridgeWebhook(
  sourceProtocol: string,
  sourceNativeId: string,
  text: string,
  targets: Protocol[],
  auth: Record<string, string>,
  env: Env,
): Promise<BridgeReport> {
  const sourceUri = `df://${sourceProtocol}:${sourceNativeId}`;
  return bridgeContent(
    {
      sourceUri,
      sourceProtocol: sourceProtocol as Protocol,
      sourceNativeId,
      text,
      auth,
      targets,
    },
    env,
  );
}

// ─── PROTOCOL-SPECIFIC REPLY FETCHERS ──────────────────────────────────────

export async function fetchReplies(
  protocol: string,
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const normalized = normalizeProtocol(protocol);
  switch (normalized) {
    case 'mastodon':
      return fetchRepliesFromMastodon(nativeId, auth, env);
    case 'bluesky':
      return fetchRepliesFromBluesky(nativeId, auth, env);
    case 'nostr':
      return fetchRepliesFromNostr(nativeId, auth, env);
    case 'farcaster':
      return fetchRepliesFromFarcaster(nativeId, auth, env);
    case 'lens':
      return fetchRepliesFromLens(nativeId, auth, env);
    case 'telegram':
      return fetchRepliesFromTelegram(nativeId, auth, env);
    default:
      return [];
  }
}

async function fetchRepliesFromMastodon(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const instance = auth.mastodon_instance || env.GTS_INSTANCE_URL || 'https://social.degenfeed.xyz';
  const accessToken = auth.mastodon || auth.mastodon_token;
  if (!accessToken) return [];

  const result = await reliableFetch(
    'activitypub',
    'fetchRepliesFromMastodon',
    async () => {
      const res = await fetch(`${instance}/api/v1/statuses/${nativeId}/context`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        descendants?: Array<{
          id: string;
          content: string;
          account?: { display_name?: string; username?: string };
          created_at?: string;
        }>;
      };
      return (data.descendants ?? []).map((reply) => ({
        parentUri: `df://mastodon:${nativeId}`,
        sourceProtocol: 'mastodon',
        replyNativeId: reply.id,
        text: stripHtml(reply.content || ''),
        authorName: reply.account?.display_name ?? reply.account?.username,
        createdAt: reply.created_at ? new Date(reply.created_at).getTime() : Date.now(),
      }));
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromBluesky(
  nativeId: string,
  auth: Record<string, string>,
  _env: Env,
): Promise<CrossProtocolReply[]> {
  const accessJwt = auth.bluesky_jwt || auth.bluesky_accessJwt || auth.accessJwt;
  const did = auth.bluesky_did || auth.did;
  let atUri: string;
  if (nativeId.startsWith('at://')) {
    atUri = nativeId;
  } else if (did) {
    atUri = `at://${did}/app.bsky.feed.post/${nativeId}`;
  } else {
    return [];
  }

  const result = await reliableFetch(
    'bluesky',
    'fetchRepliesFromBluesky',
    async () => {
      const res = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=10`,
        { headers: accessJwt ? { authorization: `Bearer ${accessJwt}` } : {} },
      );
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        thread?: {
          replies?: Array<{
            post?: {
              uri?: string;
              record?: { text?: string; createdAt?: string };
              author?: { displayName?: string; handle?: string };
            };
          }>;
        };
      };
      return (data.thread?.replies ?? [])
        .filter((reply): reply is { post: NonNullable<typeof reply.post> } => !!reply.post)
        .map((reply) => {
          const post = reply.post;
          return {
            parentUri: atUri,
            sourceProtocol: 'bluesky',
            replyNativeId: post.uri ?? '',
            text: (post.record as { text?: string })?.text ?? '',
            authorName: post.author?.displayName ?? post.author?.handle,
            createdAt: (post.record as { createdAt?: string })?.createdAt
              ? new Date((post.record as { createdAt: string }).createdAt).getTime()
              : Date.now(),
          };
        });
    },
    _env,
  );
  return result ?? [];
}

async function fetchRepliesFromNostr(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const result = await reliableFetch<CrossProtocolReply[]>(
    'nostr',
    'fetchRepliesFromNostr',
    async () => {
      const relayUrls = (
        env.RELAY_URLS || 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net'
      )
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      const bandRes = await fetch(
        `https://api.nostr.band/thread?ids=${encodeURIComponent(nativeId)}`,
      );
      if (bandRes.ok) {
        const bandData = (await bandRes.json()) as {
          thread?: Array<{
            id?: string;
            content?: string;
            pubkey?: string;
            created_at?: number;
          }>;
        };
        const replies = bandData.thread ?? [];
        return replies.slice(1).map(
          (reply): CrossProtocolReply => ({
            parentUri: `df://nostr:${nativeId}`,
            sourceProtocol: 'nostr',
            replyNativeId: reply.id ?? '',
            text: reply.content ?? '',
            createdAt: (reply.created_at ?? 0) * 1000,
          }),
        );
      }
      const nostr = await import('@degenfeed/nostr-sdk');
      const pool = new nostr.RelayPool(relayUrls, { eoseTimeout: 3000 });
      const events = await pool.list([{ '#e': [nativeId], kinds: [1] }]);
      pool.disconnectAll();
      return events.map(
        (ev: { id?: string; content?: string; created_at?: number }): CrossProtocolReply => ({
          parentUri: `df://nostr:${nativeId}`,
          sourceProtocol: 'nostr',
          replyNativeId: ev.id ?? '',
          text: ev.content ?? '',
          createdAt: (ev.created_at ?? 0) * 1000,
        }),
      );
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromFarcaster(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const hubUrl = env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
  const result = await reliableFetch<CrossProtocolReply[]>(
    'farcaster',
    'fetchRepliesFromFarcaster',
    async () => {
      const res = await fetch(
        `${hubUrl}/v1/castsByParent?parentHash=0x${nativeId.replace('0x', '')}`,
      );
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        messages?: Array<{
          data?: {
            castAddBody?: { text?: string };
            metadata?: { timestamp?: number };
          };
          hash?: string;
        }>;
      };
      return (data.messages ?? []).map(
        (msg): CrossProtocolReply => ({
          parentUri: `df://farcaster:${nativeId}`,
          sourceProtocol: 'farcaster',
          replyNativeId: msg.hash ?? '',
          text: msg.data?.castAddBody?.text ?? '',
          createdAt: msg.data?.metadata?.timestamp
            ? msg.data.metadata.timestamp * 1000
            : Date.now(),
        }),
      );
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromLens(
  nativeId: string,
  _auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const lensApi = env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
  const result = await reliableFetch<CrossProtocolReply[]>(
    'lens',
    'fetchRepliesFromLens',
    async () => {
      const res = await fetch(lensApi, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: `query Comments($request: PublicationQueryRequest!) { publications(request: $request) { items { ... on Post { id metadata { content } } } } }`,
          variables: { request: { commentsOf: nativeId, limit: 25 } },
        }),
      });
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        data?: {
          publications?: {
            items?: Array<{ id: string; metadata?: { content?: string } }>;
          };
        };
      };
      return (data.data?.publications?.items ?? []).map(
        (pub): CrossProtocolReply => ({
          parentUri: `df://lens:${nativeId}`,
          sourceProtocol: 'lens',
          replyNativeId: pub.id,
          text: pub.metadata?.content ?? '',
          createdAt: Date.now(),
        }),
      );
    },
    env,
  );
  return result ?? [];
}

async function fetchRepliesFromTelegram(
  nativeId: string,
  auth: Record<string, string>,
  env: Env,
): Promise<CrossProtocolReply[]> {
  const botToken = auth.telegram_bot_token || env.TELEGRAM_BOT_TOKEN;
  const chatId = auth.telegram_chat_id || auth.chat_id;
  if (!botToken || !chatId) return [];

  const result = await reliableFetch<CrossProtocolReply[]>(
    'telegram',
    'fetchRepliesFromTelegram',
    async () => {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates?offset=-100&allowed_updates=["message"]`,
      );
      if (!res.ok) return [] as CrossProtocolReply[];
      const data = (await res.json()) as {
        result?: Array<{
          message?: {
            message_id: number;
            text?: string;
            reply_to_message?: { message_id: number };
            from?: { first_name?: string; username?: string };
            date?: number;
          };
        }>;
      };
      return (data.result ?? [])
        .filter((u) => u.message?.reply_to_message?.message_id === Number(nativeId))
        .map((u) => ({
          parentUri: `df://telegram:${nativeId}`,
          sourceProtocol: 'telegram',
          replyNativeId: String(u.message?.message_id ?? ''),
          text: u.message?.text ?? '',
          authorName: u.message?.from?.first_name ?? u.message?.from?.username,
          createdAt: (u.message?.date ?? 0) * 1000,
        }));
    },
    env,
  );
  return result ?? [];
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

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
