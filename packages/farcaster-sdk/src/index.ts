import type { Protocol, UnifiedIdentity } from '@degenfeed/types';

export type { BuildCastMessageOpts } from './engage';
export { buildFarcasterCastMessage, engageFarcaster } from './engage';
// ─── Frames v2 / Mini Apps ───────────────────────────────────────────────
export type {
  AccountAssociation,
  FrameActionBody,
  FrameConfig,
  FrameEmbed,
  FrameInteractionEvent,
  FrameManifest,
  FrameNotificationDetails,
  FrameResponse,
  FrameResponseButton,
  FrameResponseButtonAction,
  FrameResponseTransaction,
  FrameState,
  FrameTemplate,
  FrameTemplateField,
  FrameTemplateType,
  FrameWebhookEvent,
  FrameWebhookPayload,
  TriggerConfig,
} from './frames-v2';
export {
  advanceFrameState,
  buildFrameEmbed,
  buildFrameManifest,
  createFrameState,
  FRAME_TEMPLATES,
  generateFramesV2Html,
  renderFrameEmbedMetaTag,
  serializeFrameEmbed,
} from './frames-v2';
export type { Protocol, UnifiedIdentity };

/**
 * Hub URL resolution — env first, never a hardcoded localhost.
 *
 * The former default `http://127.0.0.1:2281` silently sent hub traffic to
 * the caller's own machine when no explicit URL was passed. Now:
 *   1. FARCASTER_HUB_URL (server) / NEXT_PUBLIC_FARCASTER_HUB_URL (client)
 *   2. explicit constructor argument
 *   3. otherwise HubClient throws — no silent localhost fallback.
 */
function resolveHubUrlFromEnv(): string | null {
  // Look `process` up on globalThis so this module stays isomorphic
  // (Node / Next.js / Cloudflare Workers / browser) without requiring
  // @types/node — a bare `process` identifier throws in runtimes that
  // don't define it, and the package must not depend on Node types.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const raw = proc?.env?.FARCASTER_HUB_URL ?? proc?.env?.NEXT_PUBLIC_FARCASTER_HUB_URL;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

/** Env-resolved hub URL, or null when unconfigured (no localhost default). */
export const DEFAULT_HUB_URL: string | null = resolveHubUrlFromEnv();

/** Public hubs used only when a caller explicitly opts into fallbacks. */
export const FALLBACK_HUB_URLS = [
  'https://hubble.degenfeed.xyz',
  'https://hub.farcaster.standardcrypto.vc:2281',
  'https://hub.pinata.cloud',
] as const;

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

  constructor(hubUrl?: string | null) {
    const resolved = hubUrl?.trim() || DEFAULT_HUB_URL;
    if (!resolved) {
      throw new Error(
        'Farcaster hub URL is not configured — set the FARCASTER_HUB_URL env var (or NEXT_PUBLIC_FARCASTER_HUB_URL) or pass an explicit hubUrl to HubClient. No localhost default is provided.',
      );
    }
    this.baseUrl = resolved.replace(/\/$/, '');
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
