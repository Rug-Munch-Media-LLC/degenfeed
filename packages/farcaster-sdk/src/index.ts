/**
 * @degenfeed/farcaster-sdk
 *
 * Farcaster protocol client. Communicates with Farcaster Hubs via gRPC
 * (or REST fallback) for reading/writing casts, follows, and profiles.
 *
 * All posts normalize to @degenfeed/types `UnifiedPost`.
 *
 * ## Architecture
 *
 *   HubClient.connect(hubUrl) → HubClient
 *     .getCastsByFid(fid, pageSize) → UnifiedPost[]
 *     .getFeed(fid, pageSize)       → UnifiedPost[] (following feed)
 *     .publishCast(text, embeds)    → UnifiedPost
 *     .publishReaction(castHash, type) → void
 *     .getProfile(fid)              → UnifiedIdentity
 *
 * Free Hubs:
 *   - hub.farcaster.standardcrypto.vc:2281 (read-only)
 *   - hub-grpc.pinata.cloud (read-write with key)
 *
 * TODO(v1):
 *   - Implement @farcaster/hub-web gRPC-web client
 *   - Add signer key management
 *   - Add reaction and follow helpers
 *   - Add frame validation
 */

import { buildUnifiedPost, emptyIdentity, emptyMetrics } from '@degenfeed/feed-core';
import type { Protocol, UnifiedIdentity, UnifiedPost } from '@degenfeed/types';

export type { Protocol, UnifiedIdentity, UnifiedPost };

// ─── Placeholder hub URL ────────────────────────────────────────────────

export const DEFAULT_HUB_URL = 'https://hub.farcaster.standardcrypto.vc:2281';

// ─── Farcaster-specific types ──────────────────────────────────────────

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

// ─── Hub client ─────────────────────────────────────────────────────────

export class HubClient {
  private baseUrl: string;

  constructor(hubUrl: string = DEFAULT_HUB_URL) {
    this.baseUrl = hubUrl.replace(/\/$/, '');
  }

  /** Fetch casts by FID. Falls back to REST API. */
  async getCastsByFid(fid: number, limit = 50): Promise<FarcasterCast[]> {
    const url = `${this.baseUrl}/v1/castsByFid?fid=${fid}&pageSize=${limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Hub error: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as {
      messages: {
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
      }[];
    };
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

  /** Normalize a FarcasterCast to UnifiedPost. */
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
}

export { buildUnifiedPost, emptyIdentity, emptyMetrics };
