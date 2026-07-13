import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

export { engageFarcaster } from './engage';
export type { Protocol, UnifiedIdentity };

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

  private async getOne<T>(path: string, params?: Record<string, string>): Promise<T> {
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
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new Error(`Hub error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async getUserNameProofByName(name: string): Promise<{ fid: number; name: string } | null> {
    try {
      const json = await this.getOne<{ fid: number; name: string }>('/v1/userNameProofByName', {
        name,
      });
      return json;
    } catch {
      return null;
    }
  }

  async getCastById(hash: string, fid: number): Promise<HubCastMessage | null> {
    try {
      const json = await this.getOne<{ cast: HubCastMessage }>('/v1/castById', {
        hash,
        fid: String(fid),
      });
      return json.cast ?? null;
    } catch {
      return null;
    }
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
