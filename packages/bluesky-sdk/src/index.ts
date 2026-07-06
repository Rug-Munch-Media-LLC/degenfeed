import { buildUnifiedPost } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';
export const BSKY_SOCIAL_URL = 'https://bsky.social';
export const DEFAULT_USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

export const CURATED_BSKY_ACTORS = [
  'jay.bsky.social',
  'naval.bsky.social',
  'balajis.com',
  'vitalik.eth.xyz',
  'a16z.com',
  'coinbase.com',
  'solana.com',
  'joe.bsky.social',
  'shipyard.bsky.social',
  'dappgem.bsky.social',
  'defi.bsky.social',
  'mert.bsky.social',
  'ansem.bsky.social',
  'blknoiz06.bsky.social',
];

export interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

export interface BskyPostView {
  uri: string;
  cid: string;
  author: BskyAuthor;
  record: {
    text: string;
    createdAt: string;
    embed?: {
      type: string;
      external?: { uri: string };
      images?: { image: { ref: string }; alt: string }[];
    };
    reply?: { parent: { uri: string }; root: { uri: string } };
  };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt: string;
}

export interface BskyProfile {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
}

export class BskyClient {
  private pdsUrl: string;
  private accessJwt: string | null = null;
  private userAgent: string;

  constructor(pdsUrl: string = BSKY_PUBLIC_URL, userAgent: string = DEFAULT_USER_AGENT) {
    this.pdsUrl = pdsUrl;
    this.userAgent = userAgent;
  }

  setAuth(accessJwt: string): void {
    this.accessJwt = accessJwt;
  }

  private async xrpc(endpoint: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${this.pdsUrl}${endpoint}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept: 'application/json',
    };
    if (this.accessJwt) headers.authorization = `Bearer ${this.accessJwt}`;
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`XRPC error: ${res.status} ${res.statusText}`);
    return res.json();
  }

  async getTimeline(
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: BskyPostView[]; cursor?: string }> {
    const params: Record<string, string> = { limit: String(limit) };
    if (cursor) params.cursor = cursor;
    const data = (await this.xrpc('/xrpc/app.bsky.feed.getTimeline', params)) as {
      feed: { post: BskyPostView }[];
      cursor?: string;
    };
    return {
      posts: (data.feed ?? []).map((f) => f.post),
      cursor: data.cursor,
    };
  }

  async getAuthorFeed(
    actor: string,
    limit = 50,
    cursor?: string,
  ): Promise<{ posts: BskyPostView[]; cursor?: string }> {
    const params: Record<string, string> = { actor, limit: String(limit) };
    if (cursor) params.cursor = cursor;
    const data = (await this.xrpc('/xrpc/app.bsky.feed.getAuthorFeed', params)) as {
      feed: { post: BskyPostView }[];
      cursor?: string;
    };
    return {
      posts: (data.feed ?? []).map((f) => f.post),
      cursor: data.cursor,
    };
  }

  async getActorFeeds(actors: string[], limitPerActor = 15): Promise<BskyPostView[]> {
    const results = await Promise.allSettled(
      actors.map((actor) => this.getAuthorFeed(actor, limitPerActor)),
    );
    const posts: BskyPostView[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') posts.push(...r.value.posts);
    }
    return posts;
  }

  async resolveHandle(handle: string): Promise<string> {
    const data = (await this.xrpc('/xrpc/com.atproto.identity.resolveHandle', {
      handle,
    })) as { did: string };
    return data.did;
  }

  async getProfile(actor: string): Promise<BskyProfile> {
    return (await this.xrpc('/xrpc/app.bsky.actor.getProfile', { actor })) as BskyProfile;
  }

  async searchActorsTypeahead(query: string, limit = 25): Promise<{ actors: BskyAuthor[] }> {
    const data = (await this.xrpc('/xrpc/app.bsky.actor.searchActorsTypeahead', {
      q: query,
      limit: String(limit),
    })) as { actors: BskyAuthor[] };
    return { actors: data.actors ?? [] };
  }

  authorToIdentity(author: BskyAuthor): UnifiedIdentity {
    return {
      id: `bluesky:${author.did}`,
      primary: { protocol: 'bluesky', id: author.did },
      handles: {
        nostr: null,
        farcaster: null,
        lens: null,
        bluesky: author.handle,
        threads: null,
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
      keys: { did: author.did },
    };
  }

  profileToIdentity(profile: BskyProfile): UnifiedIdentity {
    return {
      id: `bluesky:${profile.did}`,
      primary: { protocol: 'bluesky', id: profile.did },
      handles: {
        nostr: null,
        farcaster: null,
        lens: null,
        bluesky: profile.handle,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: profile.displayName || profile.handle,
      bio: profile.description || '',
      avatarUrl: profile.avatar || '',
      verified: [],
      followerCount: profile.followersCount ?? 0,
      followingCount: profile.followsCount ?? 0,
      links: [],
      keys: { did: profile.did },
    };
  }

  postToUnifiedPost(post: BskyPostView, author?: UnifiedIdentity): UnifiedPost {
    const identity = author ?? this.authorToIdentity(post.author);
    return buildUnifiedPost({
      protocol: 'bluesky',
      nativeId: post.uri,
      author: identity,
      text: post.record.text,
      parentNativeId: post.record.reply?.parent.uri,
      rootNativeId: post.record.reply?.root.uri,
      createdAt: new Date(post.record.createdAt).getTime(),
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

  async like(uri: string, cid: string, actorDid: string): Promise<void> {
    await this.createRecord(actorDid, 'app.bsky.feed.like', {
      subject: { uri, cid },
      createdAt: new Date().toISOString(),
    });
  }

  async unlike(uri: string, actorDid: string): Promise<void> {
    await this.deleteRecord(actorDid, 'app.bsky.feed.like', uri);
  }

  async repost(uri: string, cid: string, actorDid: string): Promise<void> {
    await this.createRecord(actorDid, 'app.bsky.feed.repost', {
      subject: { uri, cid },
      createdAt: new Date().toISOString(),
    });
  }

  async unrepost(uri: string, actorDid: string): Promise<void> {
    await this.deleteRecord(actorDid, 'app.bsky.feed.repost', uri);
  }

  async reply(
    parentUri: string,
    parentCid: string,
    actorDid: string,
    text: string,
    rootUri?: string,
    rootCid?: string,
  ): Promise<void> {
    await this.createRecord(actorDid, 'app.bsky.feed.post', {
      text,
      createdAt: new Date().toISOString(),
      reply: {
        root: { uri: rootUri ?? parentUri, cid: rootCid ?? parentCid },
        parent: { uri: parentUri, cid: parentCid },
      },
    });
  }

  private async createRecord(
    repo: string,
    collection: string,
    record: Record<string, unknown>,
  ): Promise<void> {
    if (!this.accessJwt) throw new Error('Not authenticated');
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        authorization: `Bearer ${this.accessJwt}`,
      },
      body: JSON.stringify({ repo, collection, record }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Bluesky createRecord failed: ${errText.slice(0, 100)}`);
    }
  }

  private async deleteRecord(repo: string, collection: string, uri: string): Promise<void> {
    if (!this.accessJwt) throw new Error('Not authenticated');
    const parts = uri.split('/');
    const rkey = parts[parts.length - 1] ?? '';
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.repo.deleteRecord`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': this.userAgent,
        authorization: `Bearer ${this.accessJwt}`,
      },
      body: JSON.stringify({ repo, collection, rkey }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Bluesky deleteRecord failed: ${errText.slice(0, 100)}`);
    }
  }
}
