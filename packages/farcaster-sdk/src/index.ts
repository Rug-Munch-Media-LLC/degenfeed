import { buildUnifiedPost, emptyIdentity, emptyMetrics } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const DEFAULT_HUB_URL = 'https://hub.farcaster.standardcrypto.vc:2281';
export const FALLBACK_HUB_URLS = [
  DEFAULT_HUB_URL,
  'https://hoyt.farcaster.standardcrypto.vc:2281',
  'https://hub-grpc.pinata.cloud',
  'https://hub.pinata.cloud',
];

export const CURATED_FARCASTER_FIDS = [
  1, 2, 3, 99, 100, 200, 500, 1000, 1234, 2000, 5000, 5650, 11276, 215, 320, 602, 1337, 4242, 69420,
  100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1100000, 1200000,
  1300000, 1400000, 1500000,
];

export interface FarcasterCast {
  hash: string;
  fid: number;
  text: string;
  embeds: { url: string }[];
  parentHash?: string;
  parentFid?: number;
  timestamp: number;
  reactions: { likes: number; recasts: number; replies: number };
}

export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  pfp: string;
  followerCount: number;
  followingCount: number;
}

export interface HubCastMessage {
  data: {
    castAddBody: {
      text: string;
      embeds: { url: string }[];
      parentCastId?: { hash: string; fid: number };
      parentUrl?: string;
    };
    timestamp: number;
  };
  hash: string;
}

function hubTimestampToMs(ts: number): number {
  return (ts + 1609459200) * 1000;
}

export class HubClient {
  private baseUrl: string;
  private fallbackUrls: string[];

  constructor(hubUrl: string = DEFAULT_HUB_URL, fallbackUrls: string[] = FALLBACK_HUB_URLS) {
    this.baseUrl = hubUrl.replace(/\/$/, '');
    this.fallbackUrls = fallbackUrls.filter((u) => u !== hubUrl);
  }

  private async getOne<T>(
    baseUrl: string,
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`${baseUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
    });
    if (!res.ok) throw new Error(`Hub error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const urls = [this.baseUrl, ...this.fallbackUrls];
    let lastErr: Error | undefined;
    for (const base of urls) {
      try {
        return await this.getOne<T>(base, path, params);
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error('Farcaster hub request failed');
      }
    }
    throw lastErr ?? new Error('Farcaster hub request failed');
  }

  async getCastsByFid(fid: number, limit = 50): Promise<FarcasterCast[]> {
    const json = await this.get<{ messages: HubCastMessage[] }>('/v1/castsByFid', {
      fid: String(fid),
      pageSize: String(limit),
    });
    return (json.messages ?? []).map((msg) => this.hubMessageToCast(msg, fid));
  }

  private hubMessageToCast(msg: HubCastMessage, fid: number): FarcasterCast {
    return {
      hash: msg.hash,
      fid,
      text: msg.data.castAddBody.text,
      embeds: msg.data.castAddBody.embeds ?? [],
      parentHash: msg.data.castAddBody.parentCastId?.hash,
      timestamp: hubTimestampToMs(msg.data.timestamp),
      reactions: { likes: 0, recasts: 0, replies: 0 },
    };
  }

  async getCastsByParent(
    parentHash: string,
    parentFid: number,
    limit = 50,
  ): Promise<FarcasterCast[]> {
    const json = await this.get<{ messages: HubCastMessage[] }>('/v1/castsByParent', {
      parentHash,
      parentFid: String(parentFid),
      pageSize: String(limit),
    });
    return (json.messages ?? []).map((msg) => this.hubMessageToCast(msg, parentFid));
  }

  async getCastsByFids(fids: number[], limitPerFid = 30): Promise<FarcasterCast[]> {
    const results = await Promise.allSettled(
      fids.map(async (fid) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            return await this.getCastsByFid(fid, limitPerFid);
          } catch {
            await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          }
        }
        return [];
      }),
    );
    const casts: FarcasterCast[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') casts.push(...r.value);
    }
    return casts;
  }

  async getUserNameProofByName(name: string): Promise<{ fid: number; name: string } | null> {
    try {
      const json = await this.get<{ fid: number; name: string }>('/v1/userNameProofByName', {
        name,
      });
      return json;
    } catch {
      return null;
    }
  }

  async getCastById(hash: string, fid: number): Promise<FarcasterCast | null> {
    try {
      const json = await this.get<{ cast: HubCastMessage }>('/v1/castById', {
        hash,
        fid: String(fid),
      });
      if (!json.cast) return null;
      return this.hubMessageToCast(json.cast, fid);
    } catch {
      return null;
    }
  }

  castToUnifiedPost(cast: FarcasterCast, author?: UnifiedIdentity): UnifiedPost {
    return buildUnifiedPost({
      protocol: 'farcaster',
      nativeId: cast.hash,
      author: author ?? emptyIdentity(),
      text: cast.text,
      parentNativeId: cast.parentHash,
      createdAt: cast.timestamp,
      metrics: emptyMetrics(),
      viewer: { liked: false, reposted: false },
      raw: cast,
    });
  }

  profileToIdentity(profile: FarcasterProfile): UnifiedIdentity {
    return {
      id: `farcaster:${profile.fid}`,
      primary: { protocol: 'farcaster', id: String(profile.fid) },
      handles: {
        nostr: null,
        farcaster: profile.username,
        lens: null,
        bluesky: null,
        threads: null,
        rss: null,
        mastodon: null,
      },
      displayName: profile.displayName || profile.username || `fid:${profile.fid}`,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl || profile.pfp,
      verified: [],
      followerCount: profile.followerCount,
      followingCount: profile.followingCount,
      links: [],
      keys: { fid: profile.fid },
    };
  }

  async submitMessage(signedMessage: string | ArrayBuffer): Promise<void> {
    const res = await fetch(`${this.baseUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/0.1 (+https://degenfeed.xyz)',
      },
      body: signedMessage,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Farcaster Hub rejected: ${errText.slice(0, 100)}`);
    }
  }
}

export interface FarcasterFeedResult {
  posts: UnifiedPost[];
  notice?: string;
}

export async function fetchFarcasterCuratedFeed(
  hubUrl?: string,
  fids = CURATED_FARCASTER_FIDS,
  limitPerFid = 10,
): Promise<FarcasterFeedResult> {
  const client = new HubClient(hubUrl);
  try {
    const casts = await client.getCastsByFids(fids.slice(0, 20), limitPerFid);
    const profileCache = new Map<number, FarcasterProfile>();
    const posts: UnifiedPost[] = [];
    for (const cast of casts) {
      let profile = profileCache.get(cast.fid);
      if (!profile) {
        const proof = await client.getUserNameProofByName(String(cast.fid));
        profile = {
          fid: cast.fid,
          username: proof?.name ?? `fid:${cast.fid}`,
          displayName: proof?.name ?? `FID ${cast.fid}`,
          bio: '',
          avatarUrl: '',
          pfp: '',
          followerCount: 0,
          followingCount: 0,
        };
        profileCache.set(cast.fid, profile);
      }
      const author = client.profileToIdentity(profile);
      posts.push(client.castToUnifiedPost(cast, author));
    }
    return { posts };
  } catch {
    return {
      posts: [],
      notice:
        'Farcaster hubs are currently unreachable from this server. Curated Farcaster feed is unavailable.',
    };
  }
}

export { buildUnifiedPost, emptyIdentity, emptyMetrics };
