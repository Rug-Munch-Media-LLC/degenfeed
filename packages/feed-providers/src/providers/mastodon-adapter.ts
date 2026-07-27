import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { buildUrl, DEFAULT_USER_AGENT, fetchJson } from '../utils';
export interface GtSAccount {
  id: string;
  username: string;
  acct: string;
  display_name: string;
  note: string;
  avatar: string;
  header: string;
  header_static: string;
  followers_count: number;
  following_count: number;
  fields: { name: string; value: string; verified_at: string | null }[];
}

export interface GtSCard {
  url: string;
  title: string;
  description: string;
  image: string | null;
}

export interface GtSMediaAttachment {
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
}

export interface GtSStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: 'public' | 'unlisted' | 'private' | 'direct';
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: GtSMediaAttachment[];
  tags: { name: string }[];
  reblogs_count: number;
  favourites_count: number;
  replies_count: number;
  url: string;
  in_reply_to_id: string | null;
  reblog: GtSStatus | null;
  card: GtSCard | null;
  account: GtSAccount;
  favourited?: boolean;
  reblogged?: boolean;
}

export function stripHtml(html: string): string {
  return html
    .replace(/\u003cbr\s*\/?\u003e/gi, '\n')
    .replace(/\u003c[^\u003e]*\u003e/g, ' ')
    .replace(/\u0026amp;/g, '\u0026')
    .replace(/\u0026lt;/g, '\u003c')
    .replace(/\u0026gt;/g, '\u003e')
    .replace(/\u0026quot;/g, '"')
    .replace(/\u0026#39;/g, "'")
    .replace(/\u0026nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function accountToIdentity(account: GtSAccount, instanceUrl: string): UnifiedIdentity {
  const hostname = new URL(instanceUrl).hostname;
  const handle = account.acct.includes('@') ? account.acct : `${account.acct}@${hostname}`;
  return {
    id: `mastodon:${account.id}@${hostname}`,
    primary: { protocol: 'mastodon', id: account.id },
    handles: {
      nostr: null,
      farcaster: null,
      lens: null,
      bluesky: null,
      threads: null,
      rss: null,
      mastodon: handle,
    },
    displayName: account.display_name || account.username,
    bio: stripHtml(account.note),
    avatarUrl: account.avatar,
    bannerUrl: account.header !== account.header_static ? account.header : undefined,
    verified: account.fields
      .filter((f) => f.verified_at)
      .map((f) => ({ protocol: 'mastodon' as Protocol, badge: f.name })),
    followerCount: account.followers_count,
    followingCount: account.following_count,
    links: account.fields.map((f) => ({ label: f.name, url: f.value })),
    keys: {},
  };
}

export function statusToUnifiedPost(status: GtSStatus, instanceUrl: string): UnifiedPost {
  const identity = accountToIdentity(status.account, instanceUrl);
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;
  const html = original.content || '';
  const text = stripHtml(html);

  const embeds: Embed[] = [];
  for (const media of original.media_attachments) {
    if (media.type === 'image' || media.type === 'gifv')
      embeds.push({ kind: 'image', url: media.url });
    else if (media.type === 'video') embeds.push({ kind: 'video', url: media.url });
  }
  if (original.card) {
    embeds.push({
      kind: 'link',
      url: original.card.url,
      meta: {
        title: original.card.title,
        description: original.card.description,
        image: original.card.image,
      },
    });
  }

  const finalText = original.spoiler_text ? `[CW: ${original.spoiler_text}]\n\n${text}` : text;
  const nativeId = isBoost ? `boost:${status.id}:${original.id}` : original.id;

  return buildUnifiedPost({
    protocol: 'mastodon',
    nativeId,
    author: identity,
    text: finalText,
    html,
    embeds,
    parentNativeId: original.in_reply_to_id ?? undefined,
    createdAt: new Date(original.created_at).getTime(),
    metrics: {
      likes: original.favourites_count ?? 0,
      reposts: original.reblogs_count ?? 0,
      replies: original.replies_count ?? 0,
      quotes: 0,
    },
    viewer: { liked: original.favourited ?? false, reposted: original.reblogged ?? false },
    raw: status,
  });
}

export async function fetchHashtagTimeline(
  instanceUrl: string,
  tag: string,
  limit: number,
): Promise<GtSStatus[]> {
  const url = buildUrl(instanceUrl, `/api/v1/timelines/tag/${encodeURIComponent(tag)}`, {
    limit: String(limit),
  });
  return fetchJson<GtSStatus[]>(url, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
}

export async function fetchPublicTimeline(
  instanceUrl: string,
  limit: number,
): Promise<GtSStatus[]> {
  const url = buildUrl(instanceUrl, '/api/v1/timelines/public', {
    limit: String(limit),
    local: 'true',
  });
  return fetchJson<GtSStatus[]>(url, { headers: { 'user-agent': DEFAULT_USER_AGENT } });
}

export interface MastodonProviderOptions {
  instanceUrl?: string;
  fallbackInstances?: string[];
}

// ─── Instance health scoring ─────────────────────────────────────────
// Tracks per-instance success/failure over the fetch window.
// Instances that respond quickly and return relevant content get
// higher weight in future fetches.

export interface InstanceHealth {
  url: string;
  successes: number;
  failures: number;
  avgLatencyMs: number;
  lastSuccess: number;
  lastFailure: number;
}

export const instanceHealth = new Map<string, InstanceHealth>();

export function recordInstanceSuccess(url: string, latencyMs: number): void {
  const existing = instanceHealth.get(url) ?? {
    url,
    successes: 0,
    failures: 0,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
  };
  existing.successes++;
  existing.avgLatencyMs =
    existing.successes === 1
      ? latencyMs
      : (existing.avgLatencyMs * (existing.successes - 1) + latencyMs) / existing.successes;
  existing.lastSuccess = Date.now();
  instanceHealth.set(url, existing);
}

export function recordInstanceFailure(url: string): void {
  const existing = instanceHealth.get(url) ?? {
    url,
    successes: 0,
    failures: 0,
    avgLatencyMs: 0,
    lastSuccess: 0,
    lastFailure: 0,
  };
  existing.failures++;
  existing.lastFailure = Date.now();
  instanceHealth.set(url, existing);
}

export function instanceHealthScore(url: string, defaultWeight: number): number {
  const h = instanceHealth.get(url);
  if (!h || h.successes + h.failures === 0) return defaultWeight;
  const successRate = h.successes / (h.successes + h.failures);
  // Penalize slow instances (>2s avg latency)
  const latencyPenalty = h.avgLatencyMs > 2000 ? 0.7 : h.avgLatencyMs > 1000 ? 0.85 : 1.0;
  return defaultWeight * successRate * latencyPenalty;
}

/** Return aggregated fediverse instance health for stats endpoints. */
export function getFediverseStats(): {
  instancesTracked: number;
  healthyInstances: number;
  totalRequests: number;
} {
  let totalRequests = 0;
  let healthyInstances = 0;
  for (const h of instanceHealth.values()) {
    totalRequests += h.successes + h.failures;
    if (h.successes > h.failures && h.avgLatencyMs < 3000) healthyInstances++;
  }
  return {
    instancesTracked: instanceHealth.size,
    healthyInstances,
    totalRequests,
  };
}

// ─── Misskey/Firefish API adapter ────────────────────────────────────
// Misskey has a limited Mastodon-compatible API. For richer access we
// call the native Misskey API (POST /api/notes/trending).
// Falls back gracefully to the Mastodon API if Misskey API is unavailable.

export interface MisskeyNote {
  id: string;
  text: string | null;
  createdAt: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    username: string;
    avatarUrl: string | null;
  };
  tags: string[];
  mentions: string[];
  files: Array<{ url: string; thumbnailUrl: string | null; type: string }>;
  renoteCount: number;
  repliesCount: number;
  reactionCount: number;
  uri: string | null;
  cw: string | null;
  visibility: 'public' | 'home' | 'followers' | 'specified';
}

export interface MisskeyNotesResponse {
  notes: MisskeyNote[];
}

export async function fetchMisskeyTrendingNotes(
  instanceUrl: string,
  limit: number,
): Promise<GtSStatus[]> {
  try {
    const res = await fetch(`${instanceUrl}/api/notes/trending`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({ limit: Math.min(limit, 30) }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MisskeyNotesResponse;
    const notes = data.notes ?? [];
    return notes.map(misskeyNoteToGtS);
  } catch {
    return [];
  }
}

export async function fetchMisskeyLocalTimeline(
  instanceUrl: string,
  limit: number,
): Promise<GtSStatus[]> {
  try {
    const res = await fetch(`${instanceUrl}/api/notes/local-timeline`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': DEFAULT_USER_AGENT,
      },
      body: JSON.stringify({ limit: Math.min(limit, 30), withFiles: false }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as MisskeyNote[];
    return data.map(misskeyNoteToGtS);
  } catch {
    return [];
  }
}

/** Convert a Misskey note to our internal GtSStatus shape. */
export function misskeyNoteToGtS(note: MisskeyNote): GtSStatus {
  const tags: { name: string }[] = note.tags.map((t) => ({ name: t }));
  return {
    id: `misskey:${note.id}`,
    uri: note.uri ?? `https://misskey.io/notes/${note.id}`,
    created_at: note.createdAt,
    content: note.text ?? '',
    visibility: note.visibility as GtSStatus['visibility'],
    sensitive: note.cw !== null,
    spoiler_text: note.cw ?? '',
    media_attachments: note.files.map((f) => ({
      type: (f.type.startsWith('image/')
        ? 'image'
        : f.type.startsWith('video/')
          ? 'video'
          : 'unknown') as GtSMediaAttachment['type'],
      url: f.url,
    })),
    tags,
    reblogs_count: note.renoteCount,
    favourites_count: note.reactionCount,
    replies_count: note.repliesCount,
    url: note.uri ?? `https://misskey.io/notes/${note.id}`,
    in_reply_to_id: null,
    reblog: null,
    card: null,
    account: {
      id: note.user.id,
      username: note.user.username,
      acct: note.user.username,
      display_name: note.user.name ?? note.user.username,
      note: '',
      avatar: note.user.avatarUrl ?? '',
      header: '',
      header_static: '',
      followers_count: 0,
      following_count: 0,
      fields: [],
    },
    favourited: false,
    reblogged: false,
  };
}
