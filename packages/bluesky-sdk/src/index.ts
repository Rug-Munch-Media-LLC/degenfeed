import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity };

export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';
export const BSKY_SOCIAL_URL = 'https://bsky.social';
export const DEFAULT_USER_AGENT = 'DegenFeed/0.1 (+https://degenfeed.xyz)';

export interface BskyAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
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
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new Error(`XRPC error: ${res.status} ${res.statusText}`);
    }
    return res.json();
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
