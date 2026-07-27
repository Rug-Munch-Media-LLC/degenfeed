/**
 * Runtime schema guards for provider API responses.
 *
 * Every `fetchJson` / `fetch` call in feed-providers returns
 * external JSON that can change shape at any time. These guards validate
 * the received payload before it enters the rest of the pipeline, so a
 * breaking API change produces a loud error instead of a silent feed outage.
 */

// ─── Generic helpers ──────────────────────────────────────────────

function isRecord(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number';
}

// ─── Nostr ────────────────────────────────────────────────────────

interface NostrEventRaw {
  id: unknown;
  pubkey: unknown;
  kind: unknown;
  content: unknown;
  created_at: unknown;
  tags: unknown;
  sig: unknown;
}

export function isNostrEvent(obj: unknown): obj is NostrEventRaw {
  if (!isRecord(obj)) return false;
  return (
    isString(obj.id) &&
    isString(obj.pubkey) &&
    isNumber(obj.kind) &&
    isString(obj.content) &&
    isNumber(obj.created_at) &&
    Array.isArray(obj.tags) &&
    isString(obj.sig)
  );
}

// ─── Bluesky (AT Protocol) ────────────────────────────────────────

interface BskyPostViewRaw {
  uri?: unknown;
  cid?: unknown;
  author?: unknown;
  record?: unknown;
  likeCount?: unknown;
  repostCount?: unknown;
  replyCount?: unknown;
  indexedAt?: unknown;
}

export function isBskyPostView(obj: unknown): obj is BskyPostViewRaw {
  if (!isRecord(obj)) return false;
  return isString(obj.uri) && isString(obj.cid);
}

export function isBskyFeedResponse(obj: unknown): obj is { feed?: unknown; cursor?: unknown } {
  if (!isRecord(obj)) return false;
  return obj.feed === undefined || Array.isArray(obj.feed);
}

// ─── Farcaster ────────────────────────────────────────────────────

interface FarcasterCastRaw {
  data?: unknown;
  hash?: unknown;
}

export function isFarcasterCast(obj: unknown): obj is FarcasterCastRaw {
  if (!isRecord(obj)) return false;
  return isString(obj.hash) && isRecord(obj.data);
}

// ─── Mastodon / GoToSocial ───────────────────────────────────────

interface GtSStatusRaw {
  id?: unknown;
  uri?: unknown;
  created_at?: unknown;
  content?: unknown;
  account?: unknown;
  tags?: unknown;
  media_attachments?: unknown;
}

export function isGtSStatus(obj: unknown): obj is GtSStatusRaw {
  if (!isRecord(obj)) return false;
  return isString(obj.id) && isString(obj.created_at);
}

export function isGtSStatusArray(obj: unknown): obj is GtSStatusRaw[] {
  return Array.isArray(obj) && obj.every((item) => isGtSStatus(item));
}

// ─── Reddit ──────────────────────────────────────────────────────

export function isRedditListing(obj: unknown): obj is { data?: { children?: unknown } } {
  if (!isRecord(obj)) return false;
  const data = obj.data;
  if (!isRecord(data)) return false;
  return data.children === undefined || Array.isArray(data.children);
}

// ─── Lens ────────────────────────────────────────────────────────

interface LensPostRaw {
  id?: unknown;
  metadata?: unknown;
  author?: unknown;
  createdAt?: unknown;
  stats?: unknown;
}

export function isLensPost(obj: unknown): obj is LensPostRaw {
  if (!isRecord(obj)) return false;
  return isString(obj.id);
}

export function isLensGqlResponse(obj: unknown): obj is { data?: unknown; errors?: unknown } {
  if (!isRecord(obj)) return false;
  return true;
}

// ─── Generic RSS item ────────────────────────────────────────────

export function isRssXmlString(obj: unknown): obj is string {
  return typeof obj === 'string' && obj.length > 0;
}

// ─── Generic feed response array ─────────────────────────────────

export function isArrayOf<T>(guard: (item: unknown) => item is T): (obj: unknown) => obj is T[] {
  return (obj: unknown): obj is T[] => Array.isArray(obj) && obj.every((item) => guard(item));
}
