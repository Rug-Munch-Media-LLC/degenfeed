/**
 * @degenfeed/web — /api/feed/mastodon
 *
 * Fetches the public timeline from the local GoToSocial instance
 * (http://127.0.0.1:8082) and returns it as UnifiedPost[] in the
 * format expected by ProtocolFeed / MastodonFeedClient.
 *
 * Environment overrides:
 *   MASTODON_INSTANCE_URL  — default: http://127.0.0.1:8082
 */

import { buildUnifiedPost, detectNiches } from '@degenfeed/feed-core';
import type { Embed, Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';
import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── Configuration ─────────────────────────────────────────────────────

const INSTANCE_URL =
  process.env.MASTODON_INSTANCE_URL ?? 'http://127.0.0.1:8082';

// ─── Types (minimal GtS/Mastodon response shape) ──────────────────────

interface GtSAccount {
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

interface GtSMediaAttachment {
  type: 'image' | 'video' | 'gifv' | 'audio' | 'unknown';
  url: string;
}

interface GtSCard {
  url: string;
  title: string;
  description: string;
  image: string | null;
}

interface GtSTag {
  name: string;
  url?: string;
}

interface GtSMention {
  url: string;
  acct: string;
  id: string;
  username: string;
}

interface GtSStatus {
  id: string;
  uri: string;
  created_at: string;
  content: string;
  visibility: string;
  sensitive: boolean;
  spoiler_text: string;
  media_attachments: GtSMediaAttachment[];
  tags: GtSTag[];
  mentions: GtSMention[];
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

// ─── Helpers ───────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function accountToIdentity(account: GtSAccount, instanceUrl: string): UnifiedIdentity {
  const hostname = new URL(instanceUrl).hostname;
  const handle = account.acct.includes('@') ? account.acct : `${account.acct}@${hostname}`;
  return {
    id: `mastodon:${account.id}@${hostname}`,
    primary: { protocol: 'mastodon' as Protocol, id: account.id },
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

function statusToUnifiedPost(status: GtSStatus, instanceUrl: string): UnifiedPost {
  const identity = accountToIdentity(status.account, instanceUrl);
  const original = status.reblog ?? status;
  const isBoost = status.reblog !== null;

  const rawHtml = original.content || '';
  const text = stripHtml(rawHtml);

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

  const finalText = original.spoiler_text
    ? `[CW: ${original.spoiler_text}]\n\n${text}`
    : text;
  const nativeId = isBoost ? `boost:${status.id}:${original.id}` : original.id;

  return buildUnifiedPost({
    protocol: 'mastodon',
    nativeId,
    author: identity,
    text: finalText,
    html: rawHtml,
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

// ─── Route Handler ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const limit = request.nextUrl.searchParams.get('limit') ?? '50';

    const res = await fetch(
      `${INSTANCE_URL}/api/v1/timelines/public?limit=${limit}&local=true`,
      {
        headers: {
          accept: 'application/json',
          'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        {
          data: [],
          meta: { errors: [`GTS API error: ${res.status} ${res.statusText}`] },
        },
        { status: 200 },
      );
    }

    const rawStatuses = (await res.json()) as GtSStatus[];

    if (!Array.isArray(rawStatuses)) {
      return NextResponse.json(
        { data: [], meta: { errors: ['GTS returned non-array response'] } },
        { status: 200 },
      );
    }

    const posts = rawStatuses.map((s) => statusToUnifiedPost(s, INSTANCE_URL));

    return NextResponse.json(
      {
        data: posts,
        meta: {
          total: posts.length,
          limit: Number(limit),
          fetchedAt: Date.now(),
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json(
      { data: [], meta: { errors: [message] } },
      { status: 200 },
    );
  }
}
