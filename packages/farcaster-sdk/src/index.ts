import { buildUnifiedPost, emptyIdentity, emptyMetrics } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

export const DEFAULT_HUB_URL = 'https://hub.farcaster.standardcrypto.vc:2281';
export const FALLBACK_HUB_URLS = [
  DEFAULT_HUB_URL,
  'https://hub-grpc.pinata.cloud',
  'https://hoyt.farcaster.standardcrypto.vc:2281',
];

export const CURATED_FARCASTER_FIDS = [
  1, 2, 3, 99, 100, 200, 500, 1000, 1234, 2000, 5000, 5650, 11276, 215, 320, 602, 1337, 4242, 69420,
  100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000,
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

export class HubClient {
  private baseUrl: string;

  constructor(hubUrl: string = DEFAULT_HUB_URL) {
    this.baseUrl = hubUrl.replace(/\/$/, '');
  }

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
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

  async getCastsByFid(fid: number, limit = 50): Promise<FarcasterCast[]> {
    const json = await this.get<{ messages: HubCastMessage[] }>('/v1/castsByFid', {
      fid: String(fid),
      pageSize: String(limit),
    });
    return (json.messages ?? []).map((msg) => ({
      hash: msg.hash,
      fid,
      text: msg.data.castAddBody.text,
      embeds: msg.data.castAddBody.embeds ?? [],
      parentHash: msg.data.castAddBody.parentCastId?.hash,
      timestamp: msg.data.timestamp,
      reactions: { likes: 0, recasts: 0, replies: 0 },
    }));
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
    return (json.messages ?? []).map((msg) => ({
      hash: msg.hash,
      fid: msg.data.castAddBody.parentCastId?.fid ?? parentFid,
      text: msg.data.castAddBody.text,
      embeds: msg.data.castAddBody.embeds ?? [],
      parentHash,
      timestamp: msg.data.timestamp,
      reactions: { likes: 0, recasts: 0, replies: 0 },
    }));
  }

  async getCastsByFids(fids: number[], limitPerFid = 30): Promise<FarcasterCast[]> {
    const results = await Promise.allSettled(
      fids.map((fid) => this.getCastsByFid(fid, limitPerFid)),
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
      return {
        hash: json.cast.hash,
        fid,
        text: json.cast.data.castAddBody.text,
        embeds: json.cast.data.castAddBody.embeds ?? [],
        parentHash: json.cast.data.castAddBody.parentCastId?.hash,
        timestamp: json.cast.data.timestamp,
        reactions: { likes: 0, recasts: 0, replies: 0 },
      };
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

export { buildUnifiedPost, emptyIdentity, emptyMetrics };
