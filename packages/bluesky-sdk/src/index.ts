import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity };

export const BSKY_PUBLIC_URL = 'https://public.api.bsky.app';
export const BSKY_SOCIAL_URL = 'https://bsky.social';
export const PDS_DEGENFEED_URL = 'https://pds.degenfeed.xyz';
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

// ──────────────────────────────────────────────────────
// PDS Write Adapter — session, account, content, interaction
// ──────────────────────────────────────────────────────

export interface ProfileViewDetailed {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  banner?: string;
  followersCount?: number;
  followsCount?: number;
  postsCount?: number;
  joinedAt?: string;
  indexedAt?: string;
  createdAt?: string;
  viewer?: {
    muted?: boolean;
    blockedBy?: boolean;
    following?: string;
    followedBy?: string;
  };
  labels?: Array<{ src: string; uri: string; cid: string; val: string; cts: string }>;
}

export type BlobRef = {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
};

export class PdsClient {
  private pdsUrl: string;
  private accessJwt: string | null = null;
  private refreshJwt: string | null = null;
  private did: string | null = null;
  private userAgent: string;

  constructor(pdsUrl: string = PDS_DEGENFEED_URL, userAgent: string = DEFAULT_USER_AGENT) {
    this.pdsUrl = pdsUrl;
    this.userAgent = userAgent;
  }

  get isAuthenticated(): boolean {
    return this.accessJwt !== null;
  }

  get currentDid(): string | null {
    return this.did;
  }

  // ── Session ────────────────────────────────────────────

  async createSession(
    identifier: string,
    password: string,
  ): Promise<{ accessJwt: string; refreshJwt: string; did: string; handle: string }> {
    const res = await this.request('POST', '/xrpc/com.atproto.server.createSession', {
      identifier,
      password,
    });
    const data = (await res.json()) as {
      accessJwt: string;
      refreshJwt: string;
      did: string;
      handle: string;
    };
    this.accessJwt = data.accessJwt;
    this.refreshJwt = data.refreshJwt;
    this.did = data.did;
    return data;
  }

  async refreshSession(): Promise<void> {
    if (!this.refreshJwt) throw new Error('No refresh token available');
    const res = await fetch(`${this.pdsUrl}/xrpc/com.atproto.server.refreshSession`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.refreshJwt}`,
        'user-agent': this.userAgent,
      },
    });
    if (!res.ok) {
      this.accessJwt = null;
      this.refreshJwt = null;
      this.did = null;
      const errText = await res.text().catch(() => '');
      throw new Error(`Session refresh failed: ${errText.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      accessJwt: string;
      refreshJwt: string;
      did: string;
      handle: string;
    };
    this.accessJwt = data.accessJwt;
    this.refreshJwt = data.refreshJwt;
    this.did = data.did;
  }

  // ── Account Management ─────────────────────────────────

  async createAccount(opts: {
    handle: string;
    email: string;
    password: string;
    inviteCode?: string;
    recoveryKey?: string;
  }): Promise<{ accessJwt: string; refreshJwt: string; did: string; handle: string }> {
    const body: Record<string, string> = {
      handle: opts.handle,
      email: opts.email,
      password: opts.password,
    };
    if (opts.inviteCode) body.inviteCode = opts.inviteCode;
    if (opts.recoveryKey) body.recoveryKey = opts.recoveryKey;

    const res = await this.request('POST', '/xrpc/com.atproto.server.createAccount', body);
    const data = (await res.json()) as {
      accessJwt: string;
      refreshJwt: string;
      did: string;
      handle: string;
    };
    this.accessJwt = data.accessJwt;
    this.refreshJwt = data.refreshJwt;
    this.did = data.did;
    return data;
  }

  async createInviteCode(opts: { useCount: number; forAccount?: string }): Promise<string> {
    const body: Record<string, unknown> = { useCount: opts.useCount };
    if (opts.forAccount) body.forAccount = opts.forAccount;
    const res = await this.request('POST', '/xrpc/com.atproto.server.createInviteCode', body);
    const data = (await res.json()) as { code: string };
    return data.code;
  }

  // ── Content Publishing ─────────────────────────────────

  async uploadBlob(data: Uint8Array, opts: { encoding: string }): Promise<{ blob: BlobRef }> {
    const res = await this.request('POST', '/xrpc/com.atproto.repo.uploadBlob', undefined, {
      contentType: opts.encoding,
      rawBody: data,
    });
    return res.json() as Promise<{ blob: BlobRef }>;
  }

  async createPost(opts: {
    text: string;
    facets?: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; [key: string]: unknown }>;
    }>;
    embed?: {
      $type: 'app.bsky.embed.images';
      images: Array<{
        image: BlobRef;
        alt: string;
      }>;
    };
    langs?: string[];
    reply?: {
      root: { uri: string; cid: string };
      parent: { uri: string; cid: string };
    };
    createdAt?: string;
  }): Promise<{ uri: string; cid: string }> {
    if (!this.did) throw new Error('Not authenticated — call createSession or createAccount first');

    const record: Record<string, unknown> = {
      text: opts.text,
      createdAt: opts.createdAt ?? new Date().toISOString(),
    };
    if (opts.facets && opts.facets.length > 0) record.facets = opts.facets;
    if (opts.embed) record.embed = opts.embed;
    if (opts.langs && opts.langs.length > 0) record.langs = opts.langs;
    if (opts.reply) record.reply = opts.reply;

    const res = await this.request('POST', '/xrpc/com.atproto.repo.createRecord', {
      repo: this.did,
      collection: 'app.bsky.feed.post',
      record,
    });
    const result = (await res.json()) as { uri: string; cid: string };
    return result;
  }

  async createPostWithImages(opts: {
    text: string;
    images: Array<{ data: Uint8Array; mimeType: string; alt: string }>;
    langs?: string[];
  }): Promise<{ uri: string; cid: string }> {
    if (!this.did) throw new Error('Not authenticated');

    // Bluesky allows up to 4 images per post
    const images = opts.images.slice(0, 4);

    // Upload all blobs in parallel
    const uploaded = await Promise.all(
      images.map((img) =>
        this.uploadBlob(img.data, { encoding: img.mimeType }).then((result) => ({
          image: result.blob,
          alt: img.alt,
        })),
      ),
    );

    return this.createPost({
      text: opts.text,
      embed: {
        $type: 'app.bsky.embed.images',
        images: uploaded,
      },
      langs: opts.langs,
    });
  }

  // ── Interactions ───────────────────────────────────────

  async like(subject: { uri: string; cid: string }): Promise<{ uri: string; cid: string }> {
    if (!this.did) throw new Error('Not authenticated');
    const res = await this.request('POST', '/xrpc/com.atproto.repo.createRecord', {
      repo: this.did,
      collection: 'app.bsky.feed.like',
      record: {
        subject,
        createdAt: new Date().toISOString(),
      },
    });
    return (await res.json()) as { uri: string; cid: string };
  }

  async repost(subject: { uri: string; cid: string }): Promise<{ uri: string; cid: string }> {
    if (!this.did) throw new Error('Not authenticated');
    const res = await this.request('POST', '/xrpc/com.atproto.repo.createRecord', {
      repo: this.did,
      collection: 'app.bsky.feed.repost',
      record: {
        subject,
        createdAt: new Date().toISOString(),
      },
    });
    return (await res.json()) as { uri: string; cid: string };
  }

  async reply(
    parent: { uri: string; cid: string },
    root: { uri: string; cid: string },
    text: string,
  ): Promise<{ uri: string; cid: string }> {
    if (!this.did) throw new Error('Not authenticated');
    const res = await this.request('POST', '/xrpc/com.atproto.repo.createRecord', {
      repo: this.did,
      collection: 'app.bsky.feed.post',
      record: {
        text,
        reply: { root, parent },
        createdAt: new Date().toISOString(),
      },
    });
    return (await res.json()) as { uri: string; cid: string };
  }

  async follow(did: string): Promise<{ uri: string; cid: string }> {
    if (!this.did) throw new Error('Not authenticated');
    const res = await this.request('POST', '/xrpc/com.atproto.repo.createRecord', {
      repo: this.did,
      collection: 'app.bsky.graph.follow',
      record: {
        subject: did,
        createdAt: new Date().toISOString(),
      },
    });
    return (await res.json()) as { uri: string; cid: string };
  }

  // ── Profile ────────────────────────────────────────────

  async updateProfile(opts: {
    displayName?: string;
    description?: string;
    avatar?: { data: Uint8Array; mimeType: string };
    banner?: { data: Uint8Array; mimeType: string };
  }): Promise<void> {
    if (!this.did) throw new Error('Not authenticated');

    const record: Record<string, unknown> = {};
    record.$type = 'app.bsky.actor.profile';

    if (opts.displayName !== undefined) record.displayName = opts.displayName;
    if (opts.description !== undefined) record.description = opts.description;

    if (opts.avatar) {
      const uploaded = await this.uploadBlob(opts.avatar.data, {
        encoding: opts.avatar.mimeType,
      });
      record.avatar = uploaded.blob;
    }

    if (opts.banner) {
      const uploaded = await this.uploadBlob(opts.banner.data, {
        encoding: opts.banner.mimeType,
      });
      record.banner = uploaded.blob;
    }

    await this.request('POST', '/xrpc/com.atproto.repo.putRecord', {
      repo: this.did,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record,
    });
  }

  async getProfile(actor: string): Promise<ProfileViewDetailed> {
    const res = await this.request(
      'GET',
      `/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`,
    );
    return res.json() as Promise<ProfileViewDetailed>;
  }

  // ── Utility ────────────────────────────────────────────

  async healthCheck(): Promise<{ version: string }> {
    const res = await fetch(`${this.pdsUrl}/xrpc/_health`, {
      headers: { 'user-agent': this.userAgent },
    });
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json() as Promise<{ version: string }>;
  }

  private authHeaders(): Record<string, string> {
    return this.accessJwt ? { authorization: `Bearer ${this.accessJwt}` } : {};
  }

  /**
   * Core HTTP request with JWT auto-refresh (on 401) and rate-limit retry (on 429).
   */
  private async request(
    method: string,
    path: string,
    body?: unknown,
    opts?: { contentType?: string; rawBody?: Uint8Array },
  ): Promise<Response> {
    const url = path.startsWith('http') ? path : `${this.pdsUrl}${path}`;
    const headers: Record<string, string> = {
      ...this.authHeaders(),
      'user-agent': this.userAgent,
    };

    const hasBody = body !== undefined || opts?.rawBody !== undefined;

    if (opts?.contentType) {
      headers['content-type'] = opts.contentType;
    } else if (hasBody && !opts?.rawBody) {
      headers['content-type'] = 'application/json';
    }

    // Copy Uint8Array to a plain ArrayBuffer to satisfy TypeScript's BlobPart types
    const requestBody: BodyInit | undefined =
      opts?.rawBody !== undefined
        ? (() => {
            const src = opts.rawBody;
            const copy = new ArrayBuffer(src.byteLength);
            new Uint8Array(copy).set(src);
            return new Blob([copy]);
          })()
        : body !== undefined
          ? JSON.stringify(body)
          : undefined;

    let res: Response;
    try {
      res = await fetch(url, { method, headers, body: requestBody });
    } catch (err) {
      throw new Error(`PDS network error: ${(err as Error).message}`);
    }

    // ── Auto-refresh on 401 ──────────────────────────────
    if (res.status === 401 && this.refreshJwt) {
      try {
        await this.refreshSession();
      } catch {
        throw new Error('Session expired and refresh failed');
      }
      headers.authorization = `Bearer ${this.accessJwt}`;
      try {
        res = await fetch(url, { method, headers, body: requestBody });
      } catch (err) {
        throw new Error(`PDS network error after refresh: ${(err as Error).message}`);
      }
    }

    // ── Rate-limit retry on 429 ──────────────────────────
    if (res.status === 429) {
      const retryAfter = Math.min(parseInt(res.headers.get('retry-after') ?? '1', 10) || 1, 30);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      try {
        res = await fetch(url, { method, headers, body: requestBody });
      } catch (err) {
        throw new Error(`PDS network error after 429 retry: ${(err as Error).message}`);
      }
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`PDS error ${res.status}: ${errText.slice(0, 300)}`);
    }

    return res;
  }
}
