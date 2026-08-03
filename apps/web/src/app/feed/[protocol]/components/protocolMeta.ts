'use client';

/**
 * @degenfeed/web — Protocol metadata helpers
 *
 * Shared per-protocol presentation data for the /feed/[protocol] pages:
 * labels, colors, icons, native-app URLs, and per-post metadata extractors.
 * All extractors are defensive — they read protocol-native `raw` payloads
 * that vary by provider and return null when a field is absent.
 */

import type { UnifiedPost } from '@degenfeed/types';

export interface ProtocolInfo {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Protocol-native noun for a single post (note, cast, toot, …) */
  postNoun: string;
  /** Verb for a like/favorite/upvote/zap action */
  likeVerb: string;
  /** Verb for a repost/boost/recast/mirror action */
  repostVerb: string;
}

export const PROTOCOL_INFO: Record<string, ProtocolInfo> = {
  nostr: {
    id: 'nostr',
    label: 'Nostr',
    icon: '⚡',
    color: '#8e30eb',
    postNoun: 'note',
    likeVerb: 'Zap',
    repostVerb: 'Repost',
  },
  farcaster: {
    id: 'farcaster',
    label: 'Farcaster',
    icon: '◈',
    color: '#8a63d2',
    postNoun: 'cast',
    likeVerb: 'Like',
    repostVerb: 'Recast',
  },
  bluesky: {
    id: 'bluesky',
    label: 'Bluesky',
    icon: '☁',
    color: '#1185fe',
    postNoun: 'post',
    likeVerb: 'Like',
    repostVerb: 'Repost',
  },
  lens: {
    id: 'lens',
    label: 'Lens',
    icon: '◎',
    color: '#abfe2c',
    postNoun: 'publication',
    likeVerb: 'React',
    repostVerb: 'Mirror',
  },
  mastodon: {
    id: 'mastodon',
    label: 'Mastodon',
    icon: '🐘',
    color: '#6364ff',
    postNoun: 'toot',
    likeVerb: 'Favourite',
    repostVerb: 'Boost',
  },
  matrix: {
    id: 'matrix',
    label: 'Matrix',
    icon: '🧩',
    color: '#0dbd8b',
    postNoun: 'message',
    likeVerb: 'React',
    repostVerb: 'Share',
  },
  xmpp: {
    id: 'xmpp',
    label: 'XMPP',
    icon: '✉',
    color: '#0022ff',
    postNoun: 'message',
    likeVerb: 'Like',
    repostVerb: 'Share',
  },
  lemmy: {
    id: 'lemmy',
    label: 'Lemmy',
    icon: '🗣',
    color: '#2d9cdb',
    postNoun: 'post',
    likeVerb: 'Upvote',
    repostVerb: 'Boost',
  },
  reddit: {
    id: 'reddit',
    label: 'Reddit',
    icon: '🔴',
    color: '#ff4500',
    postNoun: 'post',
    likeVerb: 'Upvote',
    repostVerb: 'Share',
  },
  rss: {
    id: 'rss',
    label: 'RSS/News',
    icon: '📰',
    color: '#ffa500',
    postNoun: 'article',
    likeVerb: 'Like',
    repostVerb: 'Share',
  },
  threads: {
    id: 'threads',
    label: 'Threads',
    icon: '⊞',
    color: '#888',
    postNoun: 'thread',
    likeVerb: 'Like',
    repostVerb: 'Repost',
  },
  pixelfed: {
    id: 'pixelfed',
    label: 'Pixelfed',
    icon: '📷',
    color: '#f9a825',
    postNoun: 'photo',
    likeVerb: 'Favourite',
    repostVerb: 'Boost',
  },
  peertube: {
    id: 'peertube',
    label: 'PeerTube',
    icon: '🎬',
    color: '#f1680d',
    postNoun: 'video',
    likeVerb: 'Like',
    repostVerb: 'Share',
  },
};

export function getProtocolInfo(protocol: string): ProtocolInfo {
  return (
    PROTOCOL_INFO[protocol] ?? {
      id: protocol,
      label: protocol.charAt(0).toUpperCase() + protocol.slice(1),
      icon: '●',
      color: '#666',
      postNoun: 'post',
      likeVerb: 'Like',
      repostVerb: 'Repost',
    }
  );
}

export function getProtocolColor(protocol: string): string {
  return getProtocolInfo(protocol).color;
}

/** Shorten a long hex/pubkey/DID for display: keep head + tail. */
export function shortId(id: string | null | undefined, head = 8, tail = 6): string {
  if (!id) return '';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** Extract a hostname from a URL-like string (or raw host/instance field). */
export function hostFrom(value: string | null | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    return url.hostname;
  } catch {
    const cleaned = value.replace(/^https?:\/\//, '').split('/')[0] ?? '';
    return cleaned;
  }
}

/** Strip a protocol: prefix from a post id to get the native id. */
export function nativeIdOf(post: UnifiedPost): string {
  return post.id.replace(
    /^(nostr:|farcaster:|lens:|bluesky:|mastodon:|reddit:|rss:|threads:|lemmy:|pixelfed:|peertube:)/,
    '',
  );
}

/** Encode a hex pubkey to npub (lazy — loads @noble/bech32 only when needed). */
async function encodeNpub(hexPubkey: string): Promise<string> {
  try {
    const { npubEncode } = await import('@degenfeed/nostr-sdk');
    return npubEncode(hexPubkey);
  } catch {
    return `npub…${hexPubkey.slice(-6)}`;
  }
}

/** Native-app permalink for a post, per protocol. Returns null when unknown. */
export async function nativeAppUrl(post: UnifiedPost): Promise<string | null> {
  const raw = (post.raw ?? {}) as Record<string, unknown>;
  const nativeId = nativeIdOf(post);
  const author = post.author;
  const handle = author.handles?.[post.protocol] ?? author.handles?.nostr ?? '';
  switch (post.protocol) {
    case 'nostr': {
      const pubkey = (raw.pubkey as string) || author.id.replace(/^nostr:/, '');
      if (!pubkey) return null;
      return `https://njump.me/${await encodeNpub(pubkey)}`;
    }
    case 'farcaster': {
      const hash = (raw.hash as string) || nativeId.replace(/^neynar:/, '');
      const username = raw.author?.username || handle;
      if (hash && username) return `https://warpcast.com/${username}/${hash.slice(2, 12)}`;
      return hash ? `https://warpcast.com/~/conversations/${hash}` : null;
    }
    case 'bluesky': {
      const uri = (raw.uri as string) || '';
      const rkey = uri.split('/').pop();
      const h = raw.author?.handle || handle;
      return h && rkey ? `https://bsky.app/profile/${h}/post/${rkey}` : null;
    }
    case 'lens': {
      const id = (raw.id as string) || nativeId;
      return id ? `https://hey.xyz/posts/${id}` : null;
    }
    case 'mastodon': {
      const url = (raw.url as string) || (raw.uri as string) || '';
      return url || null;
    }
    case 'lemmy': {
      const apId = (raw.post?.ap_id as string) || '';
      return apId || null;
    }
    case 'reddit': {
      const subreddit = raw.subreddit as string | undefined;
      const permalink = raw.permalink as string | undefined;
      if (permalink) return `https://reddit.com${permalink}`;
      if (subreddit) return `https://reddit.com/r/${subreddit}/comments/${nativeId}`;
      return null;
    }
    case 'rss': {
      const link = post.embeds.find((e) => e.kind === 'link')?.url;
      return link || null;
    }
    default:
      return null;
  }
}

/** Whether the post raw payload carries a Farcaster frame URL. */
export function hasFarcasterFrame(post: UnifiedPost): boolean {
  if (post.protocol !== 'farcaster') return false;
  const raw = (post.raw ?? {}) as Record<string, unknown>;
  const embeds: Array<{ url?: string }> = raw.embeds ?? [];
  return embeds.some((e) => typeof e.url === 'string' && e.url.length > 0);
}

export interface ProtocolMetaChips {
  label: string;
  value: string;
  title?: string;
  accent?: boolean;
}

/**
 * Extract protocol-native metadata chips for a post.
 * Returns an array of { label, value } pairs for the per-protocol card strip.
 */
export async function extractProtocolMeta(post: UnifiedPost): Promise<ProtocolMetaChips[]> {
  const raw = (post.raw ?? {}) as Record<string, unknown>;
  const author = post.author;
  const handle = author.handles?.[post.protocol] ?? '';

  switch (post.protocol) {
    case 'nostr': {
      const chips: ProtocolMetaChips[] = [];
      const pubkey = (raw.pubkey as string) || author.id.replace(/^nostr:/, '');
      if (pubkey && pubkey.length === 64) {
        const npub = await encodeNpub(pubkey);
        chips.push({ label: 'npub', value: shortId(npub, 12, 8), title: npub });
      }
      const relay = post.id.split('@').pop();
      if (relay && relay.length > 0 && relay !== post.id) {
        chips.push({ label: 'relay', value: relay, title: relay });
      }
      const nip05 =
        (author.handles as Record<string, string | null> | undefined)?.nip05 ||
        (raw.tags ?? []).find((t: string[]) => t[0] === 'nip05')?.[1];
      if (nip05) {
        chips.push({ label: 'NIP-05', value: nip05, title: `Verified: ${nip05}`, accent: true });
      }
      const zaps = (post.metrics as { zaps?: number }).zaps ?? 0;
      if (zaps > 0) chips.push({ label: 'zaps', value: `${zaps}`, accent: true });
      return chips;
    }
    case 'farcaster': {
      const chips: ProtocolMetaChips[] = [];
      const fid = raw.author?.fid ?? author.keys?.fid ?? author.id.replace(/^farcaster:/, '');
      if (fid != null && fid !== '') {
        chips.push({ label: 'FID', value: String(fid), title: `Farcaster ID ${fid}` });
      }
      const reactions = raw.reactions ?? {};
      const likes = typeof reactions.likes_count === 'number' ? reactions.likes_count : 0;
      const recasts = typeof reactions.recasts_count === 'number' ? reactions.recasts_count : 0;
      const replies = typeof raw.replies?.count === 'number' ? raw.replies.count : 0;
      if (likes > 0) chips.push({ label: 'likes', value: String(likes) });
      if (recasts > 0) chips.push({ label: 'recasts', value: String(recasts) });
      if (replies > 0) chips.push({ label: 'replies', value: String(replies) });
      if (hasFarcasterFrame(post)) {
        chips.push({ label: 'frame', value: 'Open', accent: true });
      }
      return chips;
    }
    case 'bluesky': {
      const chips: ProtocolMetaChips[] = [];
      const did = raw.author?.did || author.id.replace(/^bluesky:/, '');
      if (did) chips.push({ label: 'DID', value: shortId(did, 12, 8), title: did });
      const pds = hostFrom(handle);
      if (pds) chips.push({ label: 'PDS', value: pds, title: `Origin PDS: ${pds}` });
      if (typeof raw.replyCount === 'number' && raw.replyCount > 0)
        chips.push({ label: 'replies', value: String(raw.replyCount) });
      if (typeof raw.quoteCount === 'number' && raw.quoteCount > 0)
        chips.push({ label: 'quotes', value: String(raw.quoteCount) });
      return chips;
    }
    case 'lens': {
      const chips: ProtocolMetaChips[] = [];
      const username = raw.author_username || handle;
      if (username) {
        chips.push({
          label: 'handle',
          value: username.startsWith('@') ? username : `@${username}`,
          title: `Lens handle: ${username}`,
        });
      }
      const mirrors = Number(raw.stats_reposts) || 0;
      const comments = Number(raw.stats_comments) || 0;
      const collects = Number(raw.stats_reactions) || 0;
      if (mirrors > 0) chips.push({ label: 'mirrors', value: String(mirrors) });
      if (comments > 0) chips.push({ label: 'comments', value: String(comments) });
      if (collects > 0) chips.push({ label: 'collects', value: String(collects), accent: true });
      return chips;
    }
    case 'mastodon': {
      const chips: ProtocolMetaChips[] = [];
      const acct = raw.account?.acct || handle;
      const instance = hostFrom(raw.uri || raw.url || '');
      if (acct) {
        const full = acct.includes('@') ? acct : instance ? `${acct}@${instance}` : acct;
        chips.push({
          label: 'author',
          value: `@${full}`,
          title: `Federated identity: @${full}`,
        });
      }
      if (typeof raw.favourites_count === 'number' && raw.favourites_count > 0)
        chips.push({ label: 'favourites', value: String(raw.favourites_count) });
      if (typeof raw.reblogs_count === 'number' && raw.reblogs_count > 0)
        chips.push({ label: 'boosts', value: String(raw.reblogs_count) });
      if (raw.sensitive === true) {
        chips.push({
          label: 'CW',
          value: raw.spoiler_text || 'sensitive',
          accent: true,
          title: 'Content warning — sensitive media',
        });
      }
      return chips;
    }
    case 'lemmy': {
      const chips: ProtocolMetaChips[] = [];
      const community = raw.community?.name ?? raw.community?.title;
      if (community) {
        chips.push({
          label: 'community',
          value: `c/${community}`,
          title: `Community: ${raw.community?.title ?? community}`,
        });
      }
      const instance = hostFrom(raw.community?.actor_id || raw.post?.ap_id || '');
      if (instance) chips.push({ label: 'instance', value: instance });
      const upvotes = raw.counts?.upvotes ?? 0;
      const downvotes = raw.counts?.downvotes ?? 0;
      if (upvotes > 0 || downvotes > 0) {
        chips.push({ label: 'upvotes', value: `▲ ${upvotes}` });
        if (downvotes > 0) chips.push({ label: 'downvotes', value: `▼ ${downvotes}` });
      }
      return chips;
    }
    case 'reddit': {
      const chips: ProtocolMetaChips[] = [];
      const subreddit = raw.subreddit as string | undefined;
      if (subreddit) {
        chips.push({
          label: 'subreddit',
          value: `r/${subreddit}`,
          title: `r/${subreddit}`,
        });
      }
      const score = Number(raw.score) || post.metrics.likes || 0;
      const comments = Number(raw.num_comments) || post.metrics.replies || 0;
      if (score > 0) chips.push({ label: 'score', value: String(score) });
      if (comments > 0) chips.push({ label: 'comments', value: String(comments) });
      return chips;
    }
    case 'rss': {
      const chips: ProtocolMetaChips[] = [];
      const feedUrl = raw.feedUrl as string | undefined;
      const domain = hostFrom(feedUrl || (post.embeds.find((e) => e.kind === 'link')?.url ?? ''));
      if (domain) chips.push({ label: 'source', value: domain, title: domain });
      const feedLabel = raw.feedLabel as string | undefined;
      if (feedLabel) chips.push({ label: 'feed', value: feedLabel, title: feedLabel });
      if (post.createdAt) {
        chips.push({
          label: 'published',
          value: new Date(post.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          }),
        });
      }
      return chips;
    }
    default:
      return [];
  }
}
