import { type BskyAuthor, BskyClient, type BskyPostView } from '@degenfeed/bluesky-sdk';
import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost, BskyPostView };

export const THREADS_PUBLIC_URL = 'https://public.threads.net';
export const THREADS_PDS_URL = 'https://threads.net';

export const CURATED_THREADS_HANDLES = [
  'threads',
  'mosseri',
  'zuck',
  'meta',
  'instagram',
  'mkobach',
  'alexandermuessig',
  'crypto',
  'ethereum',
  'solana',
];

export interface ThreadsPostView extends BskyPostView {
  carouselMedia?: {
    images: { url: string; alt: string }[];
  }[];
  poll?: {
    options: { label: string; count: number }[];
    expiry: string;
  };
}

export class ThreadsClient {
  private bsky: BskyClient;
  private writeClient: BskyClient;

  constructor(pdsUrl: string = THREADS_PUBLIC_URL) {
    this.bsky = new BskyClient(pdsUrl);
    this.writeClient = new BskyClient(THREADS_PDS_URL);
  }

  setAuth(accessJwt: string): void {
    this.bsky.setAuth(accessJwt);
    this.writeClient.setAuth(accessJwt);
  }

  like(uri: string, cid: string, actorDid: string): Promise<void> {
    return this.writeClient.like(uri, cid, actorDid);
  }

  unlike(uri: string, actorDid: string): Promise<void> {
    return this.writeClient.unlike(uri, actorDid);
  }

  repost(uri: string, cid: string, actorDid: string): Promise<void> {
    return this.writeClient.repost(uri, cid, actorDid);
  }

  unrepost(uri: string, actorDid: string): Promise<void> {
    return this.writeClient.unrepost(uri, actorDid);
  }

  reply(
    parentUri: string,
    parentCid: string,
    actorDid: string,
    text: string,
    rootUri?: string,
    rootCid?: string,
  ): Promise<void> {
    return this.writeClient.reply(parentUri, parentCid, actorDid, text, rootUri, rootCid);
  }

  async getTimeline(
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: ThreadsPostView[]; cursor?: string }> {
    return this.bsky.getTimeline(limit, cursor) as Promise<{
      posts: ThreadsPostView[];
      cursor?: string;
    }>;
  }

  async getAuthorFeed(
    actor: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: ThreadsPostView[]; cursor?: string }> {
    return this.bsky.getAuthorFeed(actor, limit, cursor) as Promise<{
      posts: ThreadsPostView[];
      cursor?: string;
    }>;
  }

  async getAuthorFeeds(handles: string[], limitPerHandle = 10): Promise<ThreadsPostView[]> {
    const results = await Promise.allSettled(
      handles.map(async (handle) => {
        try {
          const did = await this.resolveHandle(handle);
          const feed = await this.getAuthorFeed(did, limitPerHandle);
          return feed.posts;
        } catch {
          return [];
        }
      }),
    );
    const posts: ThreadsPostView[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') posts.push(...r.value);
    }
    return posts;
  }

  async getPost(uri: string): Promise<ThreadsPostView> {
    const url = new URL(`${THREADS_PUBLIC_URL}/xrpc/app.bsky.feed.getPostThread`);
    url.searchParams.set('uri', uri);
    url.searchParams.set('depth', '0');
    const res = await fetch(url.toString(), {
      headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
    });
    if (!res.ok) throw new Error(`Threads API error: ${res.status}`);
    const json = (await res.json()) as { thread: { post: ThreadsPostView } };
    return json.thread.post;
  }

  async resolveHandle(handle: string): Promise<string> {
    const normalized = handle.replace(/^@/, '').replace(/\.threads\.net$/, '');
    const url = new URL(`${THREADS_PUBLIC_URL}/xrpc/com.atproto.identity.resolveHandle`);
    url.searchParams.set('handle', `${normalized}.threads.net`);
    const res = await fetch(url.toString(), {
      headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
    });
    if (!res.ok) throw new Error(`Failed to resolve Threads handle: ${res.status}`);
    const json = (await res.json()) as { did: string };
    return json.did;
  }

  async getProfile(did: string): Promise<{
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
    banner?: string;
    followersCount?: number;
    followsCount?: number;
    postsCount?: number;
  }> {
    const url = new URL(`${THREADS_PUBLIC_URL}/xrpc/app.bsky.actor.getProfile`);
    url.searchParams.set('actor', did);
    const res = await fetch(url.toString(), {
      headers: { 'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)' },
    });
    if (!res.ok) throw new Error(`Threads profile error: ${res.status}`);
    return res.json() as Promise<{
      did: string;
      handle: string;
      displayName?: string;
      description?: string;
      avatar?: string;
      banner?: string;
      followersCount?: number;
      followsCount?: number;
      postsCount?: number;
    }>;
  }

  authorToIdentity(author: BskyAuthor): UnifiedIdentity {
    return {
      id: `threads:${author.did}`,
      primary: { protocol: 'threads', id: author.did },
      handles: {
        nostr: null,
        farcaster: null,
        lens: null,
        bluesky: null,
        threads: author.handle,
        rss: null,
        mastodon: null,
      },
      displayName: author.displayName || author.handle,
      bio: '',
      avatarUrl: author.avatar || '',
      verified: [],
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { threadsDid: author.did },
    };
  }

  postToUnifiedPost(post: ThreadsPostView, author?: UnifiedIdentity): UnifiedPost {
    const identity = author ?? this.authorToIdentity(post.author);
    const embeds: { kind: 'image' | 'link'; url: string; meta?: Record<string, unknown> }[] = [];
    if (post.carouselMedia) {
      for (const item of post.carouselMedia) {
        for (const img of item.images) {
          embeds.push({ kind: 'image', url: img.url });
        }
      }
    }
    if (post.record.embed?.external) {
      embeds.push({
        kind: 'link',
        url: post.record.embed.external.uri,
        meta: { title: post.record.embed.external.uri },
      });
    }
    if (post.record.embed?.images) {
      for (const img of post.record.embed.images) {
        embeds.push({ kind: 'image', url: `https://threads.net${img.image.ref}` });
      }
    }

    return buildUnifiedPost({
      protocol: 'threads' as Protocol,
      nativeId: post.uri,
      author: identity,
      text: post.record.text,
      parentNativeId: post.record.reply?.parent.uri,
      rootNativeId: post.record.reply?.root.uri,
      createdAt: new Date(post.record.createdAt).getTime(),
      embeds,
      metrics: {
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
        quotes: 0,
      },
      viewer: { liked: false, reposted: false },
      raw: post,
    });
  }
}
