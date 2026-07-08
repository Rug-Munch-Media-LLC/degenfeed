/**
 * Runtime schema guards for provider API responses.
 *
 * Every `fetchRemote` / `fetchJson` call in feed-providers returns
 * external JSON that can change shape at any time. These guards validate
 * the received payload before it enters the rest of the pipeline, so a
 * breaking API change produces a loud error ("missing field X on Y")
 * instead of a silent feed outage.
 *
 * Each guard is a TypeScript type predicate — if it returns true, the
 * runtime value satisfies the compile-time interface.
 */

// ─── Bluesky ─────────────────────────────────────────────────────

interface BskyAuthor {
  did?: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
}

interface BskyPostRecord {
  text?: string;
  createdAt?: string;
  embed?: Record<string, unknown>;
  reply?: { parent?: { uri?: string }; root?: { uri?: string } };
}

interface BskyPostView {
  uri?: string;
  cid?: string;
  author?: BskyAuthor;
  record?: BskyPostRecord;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt?: string;
}

export function isBlueskyPostView(obj: unknown): obj is BskyPostView {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return typeof p.uri === 'string' && typeof p.cid === 'string' && p.author != null;
}

export function isBlueskyFeedViewArray(obj: unknown): obj is { feed?: { post?: BskyPostView }[] } {
  if (!obj || typeof obj !== 'object') return false;
  const data = obj as Record<string, unknown>;
  return data.feed !== undefined;
}

// ─── Mastodon (GotoSocial) ───────────────────────────────────────

interface GtSAccount {
  id?: string;
  username?: string;
  acct?: string;
  display_name?: string;
  avatar?: string;
}

interface GtSStatus {
  id?: string;
  created_at?: string;
  content?: string;
  visibility?: string;
  sensitive?: boolean;
  media_attachments?: Array<{
    type?: string;
    url?: string;
  }>;
  tags?: Array<{ name?: string }>;
  reblogs_count?: number;
  favourites_count?: number;
  replies_count?: number;
  url?: string;
  in_reply_to_id?: string | null;
  account?: GtSAccount;
  card?: Record<string, unknown>;
}

export function isMastodonStatus(obj: unknown): obj is GtSStatus {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return typeof s.id === 'string' && typeof s.content === 'string' && s.account != null;
}

export function isMastodonStatusArray(obj: unknown): obj is GtSStatus[] {
  return Array.isArray(obj);
}
// ─── Nostr ────────────────────────────────────────────────────────

interface NostrEventPartial {
  id?: unknown;
  pubkey?: unknown;
  kind?: unknown;
}

export function isNostrEvent(obj: unknown): obj is NostrEventPartial {
  if (!obj || typeof obj !== 'object') return false;
  const e = obj as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.pubkey === 'string' && typeof e.kind === 'number';
}

// ─── Farcaster ────────────────────────────────────────────────────

interface HubCast {
  hash?: string;
  data?: {
    castAddBody?: {
      text?: string;
      embeds?: Array<{ url?: string }>;
      parentCastId?: { hash?: string; fid?: number };
    };
    timestamp?: number;
  };
}

export function isHubCast(obj: unknown): obj is HubCast {
  if (!obj || typeof obj !== 'object') return false;
  const c = obj as Record<string, unknown>;
  return typeof c.hash === 'string' && c.data != null;
}

// ─── Lens ─────────────────────────────────────────────────────────

interface LensPublication {
  id?: string;
  metadata?: {
    content?: string;
    description?: string;
    name?: string;
  };
  createdAt?: string;
  by?: {
    id?: string;
    handle?: string;
    metadata?: {
      displayName?: string;
      picture?: string;
      bio?: string;
    };
  };
  stats?: {
    totalAmountOfMirrors?: number;
    totalAmountOfCollects?: number;
    totalAmountOfComments?: number;
    totalUpvotes?: number;
  };
}

export function isLensPublication(obj: unknown): obj is LensPublication {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return typeof p.id === 'string';
}

// ─── Threads ──────────────────────────────────────────────────────

interface ThreadsPost {
  id?: string;
  text?: string;
  url?: string;
  author?: string;
  authorName?: string;
  authorAvatar?: string;
  createdAt?: number;
  image?: string;
  likes?: number;
  replies?: number;
  reposts?: number;
}

export function isThreadsPost(obj: unknown): obj is ThreadsPost {
  if (!obj || typeof obj !== 'object') return false;
  const p = obj as Record<string, unknown>;
  return typeof p.id === 'string' && typeof p.text === 'string';
}
