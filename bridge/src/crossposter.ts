/**
 * DegenFeed Cross-Poster v3
 *
 * Cross-platform posting engine — configurable source→target pairs with:
 *   - Transform pipelines per pair
 *   - Per-target rate limiting
 *   - Failure tracking with backoff
 *   - Configurable polling intervals per source
 *
 * Current pairs:
 *   - GoToSocial (ActivityPub) → Nostr Relay (WebSocket)
 *   - GoToSocial → Bluesky (AT Protocol via PDS)
 *   - GoToSocial → PeerTube (video announcements)
 *   - GoToSocial → Farcaster (Hubble self-hosted)
 *   - GoToSocial → Lens (Lens API)
 *   - GoToSocial → Pixelfed (photo cross-posts)
 *   - GoToSocial → WriteFreely (long posts as blog)
 *   - Pixelfed → Mastodon (new photo announcements)
 *   - Lemmy → Nostr (announce hot posts)
 *
 * The cross-poster polls source protocols and publishes formatted
 * content to target protocols using the configured transforms.
 */

import type { UnifiedPost } from './server/types';

// ─── Types ──────────────────────────────────────────────────────────────

export type ProtocolName =
  | 'mastodon'
  | 'nostr'
  | 'bluesky'
  | 'peertube'
  | 'lemmy'
  | 'farcaster'
  | 'lens'
  | 'pixelfed'
  | 'writefreely'
  | 'podcast-episode'; // Podcast-to-protocol bridge

export interface CrossPairConfig {
  /** Unique pair ID */
  id: string;
  /** Source protocol */
  source: ProtocolName;
  /** Target protocols */
  targets: ProtocolName[];
  /** Whether this pair is enabled */
  enabled: boolean;
  /** Polling interval in ms (default: 60000) */
  pollIntervalMs?: number;
  /** Rate limit: max posts per window */
  rateLimit?: {
    maxPosts: number;
    windowMs: number;
  };
  /** Source-specific connection info */
  sourceConfig: Record<string, string>;
  /** Per-target configuration */
  targetConfigs: Record<string, Record<string, string>>;
  /** Content filter (return false to skip) */
  contentFilter?: (post: UnifiedPost) => boolean;
}

export interface TransformResult {
  /** Whether the transform succeeded */
  success: boolean;
  /** The content to publish (protocol-specific format) */
  payload?: unknown;
  /** Error message if failed */
  error?: string;
}

export interface PublishResult {
  success: boolean;
  target: ProtocolName;
  latencyMs: number;
  error?: string;
  retryable: boolean;
}

export interface PairStats {
  id: string;
  source: string;
  targets: string;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  rateLimitRemaining: number;
  enabled: boolean;
}

// ─── Rate Limiter ───────────────────────────────────────────────────────

class RateLimiter {
  private windows = new Map<string, number[]>();

  /** Check if an action is allowed for a given key */
  allow(key: string, maxPosts: number, windowMs: number): boolean {
    const now = Date.now();
    let timestamps = this.windows.get(key);

    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Prune old entries
    const cutoff = now - windowMs;
    const active = timestamps.filter((t) => t > cutoff);
    this.windows.set(key, active);

    if (active.length >= maxPosts) return false;

    active.push(now);
    return true;
  }

  /** Get remaining capacity for a key */
  remaining(key: string, maxPosts: number, windowMs: number): number {
    const now = Date.now();
    const timestamps = this.windows.get(key) || [];
    const cutoff = now - windowMs;
    const active = timestamps.filter((t) => t > cutoff);
    return Math.max(0, maxPosts - active.length);
  }

  /** Reset rate limiter for a key */
  reset(key: string): void {
    this.windows.delete(key);
  }
}

// ─── Failure Tracker ────────────────────────────────────────────────────

interface FailureRecord {
  consecutiveFailures: number;
  lastError: string | null;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  backoffUntil: number | null;
  totalAttempts: number;
  totalSuccesses: number;
  totalFailures: number;
}

class FailureTracker {
  private records = new Map<string, FailureRecord>();

  /** Record a successful attempt */
  recordSuccess(pairId: string, target: string): void {
    const key = `${pairId}:${target}`;
    const record = this.getOrCreate(key);
    record.consecutiveFailures = 0;
    record.lastSuccessAt = Date.now();
    record.lastAttemptAt = Date.now();
    record.totalAttempts++;
    record.totalSuccesses++;
    record.backoffUntil = null;
  }

  /** Record a failed attempt */
  recordFailure(pairId: string, target: string, error: string): void {
    const key = `${pairId}:${target}`;
    const record = this.getOrCreate(key);
    record.consecutiveFailures++;
    record.lastError = error;
    record.lastAttemptAt = Date.now();
    record.totalAttempts++;
    record.totalFailures++;

    // Exponential backoff: 30s, 1m, 2m, 4m, 8m, 16m, 32m, 1h
    const backoffMs = Math.min(
      30_000 * 2 ** (record.consecutiveFailures - 1),
      3_600_000, // max 1 hour
    );
    record.backoffUntil = Date.now() + backoffMs;
  }

  /** Check if we should attempt (not in backoff) */
  shouldAttempt(pairId: string, target: string): boolean {
    const key = `${pairId}:${target}`;
    const record = this.records.get(key);
    if (!record) return true;
    if (!record.backoffUntil) return true;
    return Date.now() >= record.backoffUntil;
  }

  /** Get stats for a pair */
  getStats(pairId: string, target: string): FailureRecord | null {
    return this.records.get(`${pairId}:${target}`) || null;
  }

  /** Get combined stats for a pair across all targets */
  getPairStats(pairId: string): {
    totalAttempts: number;
    totalSuccesses: number;
    totalFailures: number;
    lastAttemptAt: number | null;
    lastSuccessAt: number | null;
    lastError: string | null;
    consecutiveFailures: number;
  } {
    let totalAttempts = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let lastAttemptAt: number | null = null;
    let lastSuccessAt: number | null = null;
    let lastError: string | null = null;
    let consecutiveFailures = 0;

    for (const [key, record] of this.records) {
      if (key.startsWith(`${pairId}:`)) {
        totalAttempts += record.totalAttempts;
        totalSuccesses += record.totalSuccesses;
        totalFailures += record.totalFailures;
        if (record.lastAttemptAt && (!lastAttemptAt || record.lastAttemptAt > lastAttemptAt))
          lastAttemptAt = record.lastAttemptAt;
        if (record.lastSuccessAt && (!lastSuccessAt || record.lastSuccessAt > lastSuccessAt))
          lastSuccessAt = record.lastSuccessAt;
        if (record.lastError) lastError = record.lastError;
        consecutiveFailures = Math.max(consecutiveFailures, record.consecutiveFailures);
      }
    }

    return {
      totalAttempts,
      totalSuccesses,
      totalFailures,
      lastAttemptAt,
      lastSuccessAt,
      lastError,
      consecutiveFailures,
    };
  }

  private getOrCreate(key: string): FailureRecord {
    let record = this.records.get(key);
    if (!record) {
      record = {
        consecutiveFailures: 0,
        lastError: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        backoffUntil: null,
        totalAttempts: 0,
        totalSuccesses: 0,
        totalFailures: 0,
      };
      this.records.set(key, record);
    }
    return record;
  }
}

// ─── Transform Pipeline ─────────────────────────────────────────────────

type TransformFunction = (
  post: UnifiedPost,
  target: ProtocolName,
) => TransformResult | Promise<TransformResult>;

/**
 * Default transforms per target.
 * Each transform converts a UnifiedPost into the target protocol's format.
 */
const TRANSFORMS: Record<string, TransformFunction> = {
  /**
   * Transform for Nostr: create NIP-01 event
   */
  nostr: (post: UnifiedPost): TransformResult => {
    const now = Math.floor(Date.now() / 1000);
    const content = post.text
      ? `${post.text}\n\n— originally from ${post.protocol}`
      : `Cross-posted from ${post.protocol}`;

    return {
      success: true,
      payload: {
        kind: 1,
        content,
        created_at: Math.floor(post.createdAt / 1000) || now,
        tags: [
          ['t', 'degenfeed'],
          ['t', 'crosspost'],
          ['r', post.protocol],
          ['proxy', post.id, post.protocol],
        ],
      },
    };
  },

  /**
   * Transform for Bluesky: create app.bsky.feed.post record
   * with proper AT Protocol facet byte-offset annotations.
   *
   * Facets are generated for:
   *   - URLs (http/https) → app.bsky.richtext.facet#link
   *   - @mentions → app.bsky.richtext.facet#mention
   *   - #hashtags → app.bsky.richtext.facet#tag
   */
  bluesky: (post: UnifiedPost): TransformResult => {
    const text = `${post.text}\n\n[Originally from ${post.protocol}]`;
    const encoder = new TextEncoder();
    const facets: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; uri?: string; tag?: string; did?: string }>;
    }> = [];

    // Parse text for URLs, @mentions, and #hashtags with correct byte offsets
    const textForRegex = text;

    // Pattern 1: URLs
    const urlRegex = /https?:\/\/[^\s<>"']+(?:\/[^\s<>"']*)?/g;
    for (const match of textForRegex.matchAll(urlRegex)) {
      const url = match[0];
      const byteStart = encoder.encode(textForRegex.slice(0, match.index)).byteLength;
      const byteEnd = byteStart + encoder.encode(url).byteLength;
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
      });
    }

    // Pattern 2: @mentions (e.g., @user, @user@domain)
    const mentionRegex = /@([a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9_.-]+)*)/g;
    for (const match of textForRegex.matchAll(mentionRegex)) {
      const mention = match[0];
      const byteStart = encoder.encode(textForRegex.slice(0, match.index)).byteLength;
      const byteEnd = byteStart + encoder.encode(mention).byteLength;
      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: mention.includes('@') ? `at://${mention.slice(1)}` : undefined,
          },
        ],
      });
    }

    // Pattern 3: #hashtags
    const hashtagRegex = /#([a-zA-Z0-9_\u0080-\uFFFF-]+)/g;
    for (const match of textForRegex.matchAll(hashtagRegex)) {
      const tag = match[0];
      const tagName = match[1];
      const byteStart = encoder.encode(textForRegex.slice(0, match.index)).byteLength;
      const byteEnd = byteStart + encoder.encode(tag).byteLength;
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: tagName }],
      });
    }

    return {
      success: true,
      payload: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date(post.createdAt).toISOString(),
        facets: facets.length > 0 ? facets : undefined,
      },
    };
  },

  /**
   * Transform for PeerTube: create video announcement
   * Only works for posts that are actually PeerTube video embeds
   */
  peertube: (post: UnifiedPost): TransformResult => {
    const videoEmbed = post.embeds.find((e) => e.kind === 'video');
    if (!videoEmbed) {
      return { success: false, error: 'No video embed to announce' };
    }

    const duration = Number(videoEmbed.meta?.duration) || 0;
    const durationStr = duration > 0 ? ` (${Math.floor(duration / 60)}m ${duration % 60}s)` : '';

    return {
      success: true,
      payload: {
        text: `📹 New video${durationStr}: ${post.text.slice(0, 200)}\n\nWatch: ${videoEmbed.url}`,
        tags: ['degenfeed', 'video', 'peertube', post.protocol],
      },
    };
  },

  /**
   * Transform for Farcaster: create cast
   */
  farcaster: (post: UnifiedPost): TransformResult => {
    const text =
      post.text.length > 320
        ? `${post.text.slice(0, 300)}...\n\n[Cross-posted from ${post.protocol}]`
        : `${post.text}\n\n[Cross-posted from ${post.protocol}]`;

    return {
      success: true,
      payload: { text, embeds: post.embeds.map((e) => ({ url: e.url })) },
    };
  },

  /**
   * Transform for Lens: create Lens publication
   */
  lens: (post: UnifiedPost): TransformResult => {
    const text =
      post.text.length > 5000
        ? `${post.text.slice(0, 4980)}...\n\n[Cross-posted from ${post.protocol}]`
        : `${post.text}\n\n[Cross-posted from ${post.protocol}]`;

    return {
      success: true,
      payload: { text, embeds: post.embeds.map((e) => ({ url: e.url })) },
    };
  },

  /**
   * Transform for Mastodon: create status
   */
  mastodon: (post: UnifiedPost): TransformResult => {
    const text = `${post.text}\n\n(from ${post.protocol})`;

    return {
      success: true,
      payload: { status: text, visibility: 'public' },
    };
  },

  /**
   * Transform for Pixelfed: photo cross-post
   * Only works if post has image embeds
   */
  pixelfed: (post: UnifiedPost): TransformResult => {
    const imageEmbeds = post.embeds.filter((e) => e.kind === 'image' && e.url);
    if (imageEmbeds.length === 0) {
      return { success: false, error: 'No images to cross-post to Pixelfed' };
    }

    const attribution = post.text
      ? `${post.text}\n\n— ${post.author.displayName} (${post.protocol})`
      : `Photo from ${post.author.displayName} (${post.protocol})`;

    // Pixelfed max caption length is 500 chars
    const caption = attribution.length > 497 ? `${attribution.slice(0, 494)}...` : attribution;

    return {
      success: true,
      payload: {
        caption,
        images: imageEmbeds.slice(0, 4).map((e) => e.url),
        visibility: 'public',
        protocol: post.protocol,
        authorName: post.author.displayName,
      },
    };
  },

  /**
   * Transform for WriteFreely: long-form blog cross-post
   * Only posts content that's substantial enough for a blog (>= 100 chars)
   */
  writefreely: (post: UnifiedPost): TransformResult => {
    const text = post.text || '';
    if (text.length < 20) {
      return { success: false, error: 'Content too short for blog post' };
    }

    const firstLine = text.split('\n')[0] || '';
    const title =
      firstLine.length > 0 ? firstLine.slice(0, 120) : `Post from ${post.author.displayName}`;

    const body = `${text}\n\n— *Originally posted on ${post.protocol} by ${post.author.displayName}*`;
    const truncatedBody = body.length > 500000 ? `${body.slice(0, 499990)}\n\n[truncated]` : body;

    return {
      success: true,
      payload: {
        title,
        body: truncatedBody,
        tags: [...post.niches, post.protocol, 'degenfeed', 'crosspost'],
        protocol: post.protocol,
      },
    };
  },

  /**
   * Podcast-to-Nostr transform: creates a kind 1 event with audio link
   */
  'podcast-nostr': (post: UnifiedPost): TransformResult => {
    const audioEmbed = post.embeds.find((e) => e.kind === 'audio' || e.kind === 'video');
    const audioUrl = audioEmbed?.url || '';
    const duration = Number(audioEmbed?.meta?.duration) || 0;
    const durStr = duration > 0 ? ` (${Math.floor(Number(duration) / 60)}m)` : '';

    const episodeUrl = post.embeds.find((e) => e.meta?.type === 'episode')?.url || '';

    const content = `${post.text}${durStr}\n\n${audioUrl ? `🎧 ${audioUrl}` : ''}`;

    return {
      success: true,
      payload: {
        kind: 1,
        content,
        created_at: Math.floor(post.createdAt / 1000) || Math.floor(Date.now() / 1000),
        tags: [
          ['t', 'podcast'],
          ['r', audioUrl],
          ...(episodeUrl ? [['r', episodeUrl] as [string, string]] : []),
          ['proxy', post.id, 'degenfeed-podcast'],
          ['m', 'audio/mpeg'],
        ],
      },
    };
  },

  /**
   * Podcast-to-Farcaster transform: creates a cast with audio embed
   */
  'podcast-farcaster': (post: UnifiedPost): TransformResult => {
    const text = post.text.length > 300 ? `${post.text.slice(0, 297)}...` : post.text;

    const embeds = post.embeds
      .filter((e) => e.kind === 'audio' || e.kind === 'video' || e.meta?.type === 'episode')
      .map((e) => ({ url: e.url }));

    return {
      success: true,
      payload: { text, embeds },
    };
  },

  /**
   * Podcast-to-Bluesky transform: creates post with audio link
   */
  'podcast-bluesky': (post: UnifiedPost): TransformResult => {
    const audioEmbed = post.embeds.find((e) => e.kind === 'audio' || e.kind === 'video');
    const audioUrl = audioEmbed?.url || '';
    const episodeUrl = post.embeds.find((e) => e.meta?.type === 'episode')?.url || '';

    const text = `${post.text}\n\n🎧 ${audioUrl}${episodeUrl ? `\n🔗 ${episodeUrl}` : ''}`;
    const encoder = new TextEncoder();

    const facets: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; uri?: string; tag?: string; did?: string }>;
    }> = [];

    // Add correct byte-offset facet for audio URL
    if (audioUrl) {
      const audioIndex = text.indexOf(audioUrl);
      if (audioIndex !== -1) {
        const byteStart = encoder.encode(text.slice(0, audioIndex)).byteLength;
        const byteEnd = byteStart + encoder.encode(audioUrl).byteLength;
        facets.push({
          index: { byteStart, byteEnd },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: audioUrl }],
        });
      }
    }

    // Add correct byte-offset facet for episode URL
    if (episodeUrl) {
      const epIndex = text.indexOf(episodeUrl);
      if (epIndex !== -1) {
        const byteStart = encoder.encode(text.slice(0, epIndex)).byteLength;
        const byteEnd = byteStart + encoder.encode(episodeUrl).byteLength;
        facets.push({
          index: { byteStart, byteEnd },
          features: [{ $type: 'app.bsky.richtext.facet#link', uri: episodeUrl }],
        });
      }
    }

    // Parse text for @mentions and #hashtags in the podcast text
    const textForRegex = text;

    // @mentions
    const mentionRegex = /@([a-zA-Z0-9_.-]+(?:@[a-zA-Z0-9_.-]+)*)/g;
    for (const match of textForRegex.matchAll(mentionRegex)) {
      const mention = match[0];
      const byteStart = encoder.encode(textForRegex.slice(0, match.index)).byteLength;
      const byteEnd = byteStart + encoder.encode(mention).byteLength;
      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did: mention.includes('@') ? `at://${mention.slice(1)}` : undefined,
          },
        ],
      });
    }

    // #hashtags
    const hashtagRegex = /#([a-zA-Z0-9_\u0080-\uFFFF-]+)/g;
    for (const match of textForRegex.matchAll(hashtagRegex)) {
      const tag = match[0];
      const tagName = match[1];
      const byteStart = encoder.encode(textForRegex.slice(0, match.index)).byteLength;
      const byteEnd = byteStart + encoder.encode(tag).byteLength;
      facets.push({
        index: { byteStart, byteEnd },
        features: [{ $type: 'app.bsky.richtext.facet#tag', tag: tagName }],
      });
    }

    return {
      success: true,
      payload: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date().toISOString(),
        facets: facets.length > 0 ? facets : undefined,
      },
    };
  },

  /**
   * Podcast-to-Mastodon transform: creates toot with audio link
   */
  'podcast-mastodon': (post: UnifiedPost): TransformResult => {
    const audioEmbed = post.embeds.find((e) => e.kind === 'audio' || e.kind === 'video');
    const audioUrl = audioEmbed?.url || '';
    const episodeUrl = post.embeds.find((e) => e.meta?.type === 'episode')?.url || '';

    const status = `${post.text}\n\n🎧 ${audioUrl}${episodeUrl ? `\n🔗 ${episodeUrl}` : ''}`;

    return {
      success: true,
      payload: { status, visibility: 'public' },
    };
  },
};

// ─── Publishers ─────────────────────────────────────────────────────────

async function publishToNostrRelay(_payload: unknown): Promise<boolean> {
  const relayUrl = process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:32768';
  try {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(relayUrl);
        const timer = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.addEventListener('open', () => {
          ws.send(JSON.stringify(['EVENT', _payload]));
        });

        ws.addEventListener('message', (event: MessageEvent) => {
          try {
            const msg = JSON.parse(event.data as string);
            if (msg[0] === 'OK') {
              clearTimeout(timer);
              ws.close();
              resolve(msg[1] === true || typeof msg[1] === 'string');
            }
          } catch {
            // ignore
          }
        });

        ws.addEventListener('error', () => {
          clearTimeout(timer);
          resolve(false);
        });

        ws.addEventListener('close', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

async function publishToBluesky(_payload: unknown): Promise<boolean> {
  const pdsUrl = process.env.ATPROTO_PDS_URL || 'https://bsky.social';
  const jwt = process.env.BLUESKY_CROSSPOST_JWT || '';
  const did = process.env.BLUESKY_CROSSPOST_DID || '';

  if (!jwt || !did) return false;
  const payload = _payload as Record<string, unknown>;

  try {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record: payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function publishToPeerTube(payload: unknown): Promise<boolean> {
  const ptBase = process.env.PEERTUBE_BASE_URL || 'http://127.0.0.1:9011';
  const token = process.env.PEERTUBE_ACCESS_TOKEN || '';
  const { text, tags } = payload as { text: string; tags: string[] };

  if (!token) return false;

  try {
    const res = await fetch(`${ptBase}/api/v1/videos/announce`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text, tags }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function publishToFarcaster(_payload: unknown): Promise<boolean> {
  const fid = process.env.FARCASTER_BOT_FID;
  const signerKey = process.env.FARCASTER_BOT_SIGNER_KEY;
  const hubUrl = process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281';
  const payload = _payload as { text: string; embeds?: Array<{ url: string }> };

  if (!fid || !signerKey) {
    // console.log('[crossposter] Farcaster: missing FARCASTER_BOT_FID or FARCASTER_BOT_SIGNER_KEY');
    return false;
  }

  // Farcaster has a 320 character limit per cast
  const truncatedText =
    payload.text.length > 320 ? `${payload.text.slice(0, 317)}...` : payload.text;

  try {
    const { buildFarcasterCastMessage } = await import('@degenfeed/farcaster-sdk');
    const castResult = buildFarcasterCastMessage({
      signerKeyHex: signerKey,
      fid: Number(fid),
      text: truncatedText,
    });

    if (!castResult.ok || !castResult.messageHex) {
      // console.log(`[crossposter] ✗ Failed to build Farcaster cast: ${castResult.error}`);
      return false;
    }

    const bodyBytes = new Uint8Array(
      castResult.messageHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) ?? [],
    );
    const res = await fetch(`${hubUrl}/v1/submitMessage`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/octet-stream',
        'user-agent': 'DegenFeed/1.0',
      },
      body: bodyBytes,
    });

    if (res.ok) {
      // console.log(`[crossposter] ✓ Farcaster cast submitted to Hubble`);
      return true;
    }

    return false;
  } catch {
    // console.log(`[crossposter] ✗ Farcaster error: ${(err as Error).message}`);
    return false;
  }
}

async function publishToLens(_payload: unknown): Promise<boolean> {
  const lensApiUrl = process.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql';
  const accessToken = process.env.LENS_ACCESS_TOKEN || '';
  const profileId = process.env.LENS_PROFILE_ID || '';
  const payload = _payload as { text: string; embeds?: Array<{ url: string }> };

  if (!accessToken || !profileId) {
    // console.log('[crossposter] Lens: missing LENS_ACCESS_TOKEN or LENS_PROFILE_ID');
    return false;
  }

  // Lens has a 5000 character limit per publication
  const truncatedText =
    payload.text.length > 5000 ? `${payload.text.slice(0, 4997)}...` : payload.text;

  try {
    const res = await fetch(lensApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: `mutation CreatePost($request: CreatePublicPostRequest!) {
          createPost(request: $request) {
            ... on Post { id }
          }
        }`,
        variables: {
          request: {
            profileId,
            contentURI: `data:text/plain,${encodeURIComponent(truncatedText)}`,
          },
        },
      }),
    });

    if (res.ok) {
      // console.log(`[crossposter] ✓ Lens post successful`);
      return true;
    }

    return false;
  } catch {
    // console.log(`[crossposter] ✗ Lens error: ${(err as Error).message}`);
    return false;
  }
}

async function publishToMastodon(payload: unknown): Promise<boolean> {
  const instance = process.env.MASTODON_INSTANCE || 'https://social.degenfeed.xyz';
  const token = process.env.MASTODON_ACCESS_TOKEN || '';
  const { status, visibility } = payload as { status: string; visibility: string };

  if (!token) return false;

  try {
    const res = await fetch(`${instance}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status, visibility: visibility || 'public' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Publish to Pixelfed: download images and post with caption.
 * Uses the pixelfed-write provider for actual API calls.
 */
async function publishToPixelfed(_payload: unknown): Promise<boolean> {
  const payload = _payload as {
    caption: string;
    images: string[];
    visibility: string;
    protocol: string;
    authorName: string;
  };

  if (!payload.images || payload.images.length === 0) {
    // console.log('[crossposter] Pixelfed: no images in payload');
    return false;
  }

  try {
    const { publishUnifiedPost } = await import('./providers/pixelfed-write');

    // Build a minimal UnifiedPost-like structure
    const mockPost = {
      text: payload.caption,
      embeds: payload.images.map((url: string) => ({ kind: 'image', url, meta: {} })),
      protocol: payload.protocol || 'mastodon',
      author: {
        displayName: payload.authorName || 'Unknown',
        id: '',
        primary: { protocol: 'mastodon', id: '' },
        handles: {},
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      id: '',
      createdAt: Date.now(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: {},
      niches: [],
    };

    const result = await publishUnifiedPost(mockPost as UnifiedPost);
    if (result.ok) {
      // console.log(`[crossposter] ✓ Pixelfed: ${result.status?.url || 'ok'}`);
      return true;
    }
    // console.log(`[crossposter] ✗ Pixelfed: ${result.error}`);
    return false;
  } catch {
    // console.log(`[crossposter] ✗ Pixelfed error: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Publish to WriteFreely: create blog post from transformed payload.
 */
async function publishToWriteFreely(_payload: unknown): Promise<boolean> {
  const payload = _payload as {
    title: string;
    body: string;
    tags?: string[];
    protocol: string;
  };

  const token = process.env.WRITEFREELY_TOKEN || '';
  const alias = process.env.WRITEFREELY_ALIAS || 'degenfeed';

  if (!token) {
    // console.log('[crossposter] WriteFreely: missing WRITEFREELY_TOKEN');
    return false;
  }

  try {
    const { postToWriteFreely } = await import('./providers/writefreely-write');

    const result = await postToWriteFreely(payload.title, payload.body, token, alias, payload.tags);

    if (result.ok) {
      // console.log(`[crossposter] ✓ WriteFreely: ${result.post?.url || 'ok'}`);
      return true;
    }
    // console.log(`[crossposter] ✗ WriteFreely: ${result.error}`);
    return false;
  } catch {
    // console.log(`[crossposter] ✗ WriteFreely error: ${(err as Error).message}`);
    return false;
  }
}

// ─── Publisher lookup ───────────────────────────────────────────────────

const PUBLISHERS: Record<string, (payload: unknown) => Promise<boolean>> = {
  nostr: publishToNostrRelay,
  bluesky: publishToBluesky,
  peertube: publishToPeerTube,
  farcaster: publishToFarcaster,
  lens: publishToLens,
  mastodon: publishToMastodon,
  pixelfed: publishToPixelfed,
  writefreely: publishToWriteFreely,
};

// ─── Source Pollers ─────────────────────────────────────────────────────

async function fetchLatestGtsPost(): Promise<UnifiedPost | null> {
  const gtsBase = process.env.GTS_BASE_URL || 'http://127.0.0.1:8082';
  const clientId = process.env.GTS_CLIENT_ID || '';
  const clientSecret = process.env.GTS_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    // console.log('[crossposter] GTS: no credentials');
    return null;
  }

  try {
    const tokenRes = await fetch(`${gtsBase}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
        scope: 'read:statuses read:accounts read:timelines',
      }),
    });

    if (!tokenRes.ok) {
      // console.log('[crossposter] GTS token failed');
      return null;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return null;

    const res = await fetch(`${gtsBase}/api/v1/timelines/public?local=true&limit=1`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!res.ok) return null;

    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      account: { id: string; username: string; acct: string; display_name: string };
      media_attachments?: Array<{ type: string; url: string }>;
    }>;

    if (!raw.length) return null;

    const s = raw[0]!;
    return {
      id: `mastodon:${s.id}@social.degenfeed.xyz`,
      protocol: 'mastodon',
      author: {
        id: `mastodon:${s.account.id}`,
        primary: { protocol: 'mastodon', id: s.account.id },
        handles: { mastodon: s.account.acct },
        displayName: s.account.display_name || s.account.username,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: s.content.replace(/<[^>]*>/g, '').trim(),
      embeds: (s.media_attachments || []).map((m) => ({
        kind: m.type === 'video' ? ('video' as const) : ('image' as const),
        url: m.url,
        meta: {},
      })),
      createdAt: new Date(s.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: [],
    };
  } catch {
    // console.log('[crossposter] GTS fetch error:', (err as Error).message);
    return null;
  }
}

async function fetchLatestPixelfedPost(): Promise<UnifiedPost | null> {
  const pixelfedBase = process.env.PIXELFED_BASE_URL || 'http://127.0.0.1:8087';
  const token = process.env.PIXELFED_ACCESS_TOKEN || '';

  if (!token) {
    // console.log('[crossposter] Pixelfed: missing PIXELFED_ACCESS_TOKEN');
    return null;
  }

  try {
    const res = await fetch(`${pixelfedBase}/api/v1/timelines/public?local=true&limit=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      media_attachments?: Array<{ type: string; url: string; description?: string }>;
      account: { id: string; username: string; acct: string; display_name: string };
    }>;

    if (!raw.length) return null;

    const s = raw[0]!;
    return {
      id: `pixelfed:${s.id}@photos.degenfeed.xyz`,
      protocol: 'pixelfed',
      author: {
        id: `pixelfed:${s.account.id}`,
        primary: { protocol: 'pixelfed', id: s.account.id },
        handles: { pixelfed: s.account.acct },
        displayName: s.account.display_name || s.account.username,
        bio: '',
        avatarUrl: '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: s.content.replace(/<[^>]*>/g, '').trim(),
      embeds: (s.media_attachments || []).map((m) => ({
        kind: (m.type === 'video' ? 'video' : 'image') as 'image' | 'video',
        url: m.url,
        meta: { description: m.description || '' },
      })),
      createdAt: new Date(s.created_at).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: s,
      niches: [],
    };
  } catch {
    // console.log('[crossposter] Pixelfed fetch error:', (err as Error).message);
    return null;
  }
}

async function fetchLatestLemmyPost(): Promise<UnifiedPost | null> {
  const lemmyBase = process.env.LEMMY_BASE_URL || 'http://127.0.0.1:8536';

  try {
    const res = await fetch(`${lemmyBase}/api/v3/post/list?sort=New&limit=1&type_=Local`, {
      headers: { 'User-Agent': 'DegenFeed-CrossPoster/0.2' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      posts?: Array<{
        post: { id: number; name: string; body?: string; published: string; ap_id: string };
        creator?: { person: { id: number; name: string; display_name?: string; avatar?: string } };
        community?: { community: { id: number; name: string; title: string } };
      }>;
    };

    if (!data.posts?.length) return null;

    const pv = data.posts[0]!;
    return {
      id: `lemmy:${pv.post.id}`,
      protocol: 'lemmy',
      author: {
        id: `lemmy:${pv.creator?.person?.id || 0}`,
        primary: { protocol: 'lemmy', id: String(pv.creator?.person?.id || 0) },
        handles: { lemmy: pv.creator?.person?.name || 'unknown' },
        displayName: pv.creator?.person?.display_name || pv.creator?.person?.name || 'Unknown',
        bio: '',
        avatarUrl: pv.creator?.person?.avatar || '',
        followerCount: 0,
        followingCount: 0,
        links: [],
        keys: {},
      },
      text: pv.post.body ? `${pv.post.name}\n\n${pv.post.body}` : pv.post.name,
      embeds: [],
      createdAt: new Date(pv.post.published).getTime(),
      metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      engagement: {
        viewerLiked: false,
        viewerReposted: false,
        viewerBookmarked: false,
        raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
      },
      raw: pv,
      niches: [],
    };
  } catch {
    return null;
  }
}

// ─── Configuration ──────────────────────────────────────────────────────

const DEFAULT_CONFIG: CrossPairConfig[] = [
  {
    id: 'gts-to-nostr',
    source: 'mastodon',
    targets: ['nostr'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 10, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      nostr: { relayUrl: process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:32768' },
    },
  },
  {
    id: 'gts-to-bluesky',
    source: 'mastodon',
    targets: ['bluesky'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      bluesky: {
        pdsUrl: process.env.ATPROTO_PDS_URL || 'https://bsky.social',
      },
    },
  },
  {
    id: 'gts-to-peertube',
    source: 'mastodon',
    targets: ['peertube'],
    enabled: true,
    pollIntervalMs: 300000,
    rateLimit: { maxPosts: 2, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
    // Only announce posts that contain video embeds
    contentFilter: (post: UnifiedPost) => post.embeds.some((e) => e.kind === 'video'),
  },
  {
    id: 'gts-to-farcaster',
    source: 'mastodon',
    targets: ['farcaster'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      farcaster: {
        hubUrl: process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281',
        fid: process.env.FARCASTER_BOT_FID || '',
      },
    },
  },
  {
    id: 'gts-to-lens',
    source: 'mastodon',
    targets: ['lens'],
    enabled: true,
    pollIntervalMs: 60000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      lens: {
        apiUrl: process.env.LENS_API_URL || 'https://api-v2.lens.dev/graphql',
      },
    },
  },
  {
    id: 'gts-to-pixelfed',
    source: 'mastodon',
    targets: ['pixelfed'],
    enabled: true,
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 4, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
    // Only posts with images
    contentFilter: (post: UnifiedPost) => post.embeds.some((e) => e.kind === 'image'),
  },
  {
    id: 'gts-to-writefreely',
    source: 'mastodon',
    targets: ['writefreely'],
    enabled: true,
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 6, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
    // Only substantial text content
    contentFilter: (post: UnifiedPost) => (post.text?.length || 0) >= 100,
  },
  {
    id: 'pixelfed-to-mastodon',
    source: 'pixelfed',
    targets: ['mastodon'],
    enabled: true,
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 4, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      mastodon: {
        instance: process.env.MASTODON_INSTANCE || 'https://social.degenfeed.xyz',
      },
    },
  },
  {
    id: 'lemmy-to-nostr',
    source: 'lemmy',
    targets: ['nostr'],
    enabled: true,
    pollIntervalMs: 120000,
    rateLimit: { maxPosts: 5, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {},
  },

  // ─── Podcast-to-Protocol Bridge ──────────────────────────────
  {
    id: 'podcast-to-all',
    source: 'podcast-episode',
    targets: ['nostr', 'farcaster', 'bluesky', 'mastodon'],
    enabled: true,
    pollIntervalMs: 30000, // Poll every 30s for new episodes
    rateLimit: { maxPosts: 20, windowMs: 3600000 },
    sourceConfig: {},
    targetConfigs: {
      nostr: { relayUrl: process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:32768' },
      farcaster: {
        hubUrl: process.env.FARCASTER_BOT_HUB_URL || 'http://127.0.0.1:2281',
        fid: process.env.FARCASTER_BOT_FID || '',
      },
      bluesky: {
        pdsUrl: process.env.ATPROTO_PDS_URL || 'https://bsky.social',
        jwt: process.env.BLUESKY_CROSSPOST_JWT || '',
      },
      mastodon: {
        instance: process.env.MASTODON_INSTANCE || 'https://social.degenfeed.xyz',
        token: process.env.MASTODON_ACCESS_TOKEN || '',
      },
    },
  },
];

// ─── Core Engine ────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter();
const failureTracker = new FailureTracker();

/**
 * Podcast episode poller: fetches latest published episodes from our store
 * and returns them as UnifiedPost for cross-posting.
 */
async function fetchLatestPodcastEpisode(): Promise<UnifiedPost | null> {
  try {
    // Try to fetch from the bridge's podcast store via API
    const res = await fetch('http://127.0.0.1:8787/api/podcast/trending?limit=5', {  // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        episodes: Array<{
          id: string;
          title: string;
          description: string;
          audioUrl: string;
          duration: number;
          publishedAt?: number;
          podcast?: {
            id: string;
            title: string;
            hostName: string;
            hostAddress: string;
            coverUrl?: string;
          };
        }>;
      };

      if (!data.episodes?.length) return null;

      // Get the most recently published episode we haven't seen
      const sorted = data.episodes.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
      const latest = sorted[0];
      if (!latest) return null;

      const lastId = lastSeenIds.get('podcast-to-all');
      if (latest.id === lastId) return null;

      return {
        id: `podcast:${latest.id}`,
        protocol: 'castopod',
        author: {
          id: `podcast:${latest.podcast?.hostAddress || 'host'}`,
          primary: {
            protocol: 'castopod',
            id: latest.podcast?.hostAddress || latest.podcast?.hostName || 'host',
          },
          handles: { castopod: latest.podcast?.hostName || null },
          displayName: latest.podcast?.hostName || 'Podcast Host',
          bio: '',
          avatarUrl: latest.podcast?.coverUrl || '',
          followerCount: 0,
          followingCount: 0,
          links: [],
          keys: {},
        },
        text: `🎙 ${latest.title}\n\n${latest.description?.slice(0, 300) || ''}`,
        embeds: [
          {
            kind: 'audio',
            url: latest.audioUrl,
            meta: { duration: latest.duration, type: 'episode' },
          },
          {
            kind: 'link',
            url: `https://app.degenfeed.xyz/podcasts/${latest.podcast?.id || latest.id}`,
            meta: { type: 'episode', podcastTitle: latest.podcast?.title || '' },
          },
        ],
        createdAt: latest.publishedAt || Date.now(),
        metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        engagement: {
          viewerLiked: false,
          viewerReposted: false,
          viewerBookmarked: false,
          raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
        },
        raw: latest,
        niches: ['podcast', 'audio'],
      };
    }
  } catch {
    // Podcast API unavailable — nothing to cross-post
  }
  return null;
}

/** Source pollers by protocol */
const SOURCE_POLLERS: Record<string, () => Promise<UnifiedPost | null>> = {
  mastodon: fetchLatestGtsPost,
  lemmy: fetchLatestLemmyPost,
  pixelfed: fetchLatestPixelfedPost,
  'podcast-episode': fetchLatestPodcastEpisode,
};

/** Last seen post ID per source */
const lastSeenIds = new Map<string, string>();

/**
 * Cross-post a single post from a source to all configured targets.
 */
export async function crossPost(
  post: UnifiedPost,
  config: CrossPairConfig,
): Promise<{
  success: boolean;
  results: PublishResult[];
}> {
  const results: PublishResult[] = [];

  for (const target of config.targets) {
    // Rate limit check
    if (config.rateLimit) {
      const key = `${config.id}:${target}`;
      if (!rateLimiter.allow(key, config.rateLimit.maxPosts, config.rateLimit.windowMs)) {
        results.push({
          success: false,
          target,
          latencyMs: 0,
          error: 'Rate limited',
          retryable: false,
        });
        continue;
      }
    }

    // Check backoff
    if (!failureTracker.shouldAttempt(config.id, target)) {
      results.push({
        success: false,
        target,
        latencyMs: 0,
        error: 'Backoff active',
        retryable: true,
      });
      continue;
    }

    // Get transform — check for podcast-specific transform first
    const isPodcast = config.source === 'podcast-episode';
    const podcastKey = `podcast-${target}`;
    const transform =
      isPodcast && TRANSFORMS[podcastKey] ? TRANSFORMS[podcastKey] : TRANSFORMS[target];
    if (!transform) {
      results.push({
        success: false,
        target,
        latencyMs: 0,
        error: `No transform for target: ${target}`,
        retryable: false,
      });
      continue;
    }

    // Transform
    const startTime = Date.now();
    let transformResult: TransformResult;
    try {
      transformResult = await transform(post, target as ProtocolName);
    } catch (err) {
      transformResult = {
        success: false,
        error: `Transform error: ${(err as Error).message}`,
      };
    }

    if (!transformResult.success) {
      const latencyMs = Date.now() - startTime;
      const result: PublishResult = {
        success: false,
        target,
        latencyMs,
        error: transformResult.error || 'Transform failed',
        retryable: false,
      };
      results.push(result);
      failureTracker.recordFailure(config.id, target, result.error!);
      continue;
    }

    // Publish
    const publisher = PUBLISHERS[target];
    if (!publisher) {
      results.push({
        success: false,
        target,
        latencyMs: Date.now() - startTime,
        error: `No publisher for target: ${target}`,
        retryable: false,
      });
      continue;
    }

    try {
      const publishOk = await publisher(transformResult.payload);
      const latencyMs = Date.now() - startTime;

      if (publishOk) {
        results.push({ success: true, target, latencyMs, retryable: false });
        failureTracker.recordSuccess(config.id, target);
        // console.log(`[crossposter] ✓ ${config.id} → ${target} (${latencyMs}ms): ${post.id}`);
      } else {
        const result: PublishResult = {
          success: false,
          target,
          latencyMs,
          error: 'Publisher returned failure',
          retryable: true,
        };
        results.push(result);
        failureTracker.recordFailure(config.id, target, result.error!);
        // console.log(`[crossposter] ✗ ${config.id} → ${target}: publisher failed`);
      }
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const result: PublishResult = {
        success: false,
        target,
        latencyMs,
        error: (err as Error).message,
        retryable: true,
      };
      results.push(result);
      failureTracker.recordFailure(config.id, target, result.error!);
      // console.log(`[crossposter] ✗ ${config.id} → ${target}: ${(err as Error).message}`);
    }
  }

  const allOk = results.every((r) => r.success);
  return { success: allOk, results };
}

/**
 * Poll a single source and cross-post to all configured targets.
 */
async function pollSource(config: CrossPairConfig): Promise<void> {
  const poller = SOURCE_POLLERS[config.source];
  if (!poller) {
    // console.log(`[crossposter] No poller for source: ${config.source}`);
    return;
  }

  try {
    const post = await poller();
    if (!post) {
      // console.log(`[crossposter] ${config.id}: no new posts from ${config.source}`);
      return;
    }

    const lastId = lastSeenIds.get(config.id);
    if (post.id === lastId) {
      return; // Already cross-posted
    }

    // Apply content filter
    if (config.contentFilter && !config.contentFilter(post)) {
      // console.log(`[crossposter] ${config.id}: post filtered out`);
      return;
    }

    const { success } = await crossPost(post, config);

    if (success) {
      lastSeenIds.set(config.id, post.id);
      // console.log(`[crossposter] ${config.id}: all targets succeeded`);
    } else {
      //       console.log(
      //         `[crossposter] ${config.id}: some targets failed`,
      //       );
    }
  } catch {
    // console.log(`[crossposter] ${config.id}: poll error - ${(err as Error).message}`);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Start all cross-posting pairs.
 * Each pair runs on its own polling interval.
 */
export function startCrossPoster(customConfigs?: CrossPairConfig[]): Map<string, NodeJS.Timeout> {
  const configs = customConfigs || DEFAULT_CONFIG;
  const timers = new Map<string, NodeJS.Timeout>();

  for (const config of configs) {
    if (!config.enabled) {
      // console.log(`[crossposter] ${config.id}: disabled, skipping`);
      continue;
    }

    const interval = config.pollIntervalMs || 60000;
    //     console.log(
    //       `[crossposter] ${config.id}: ${config.source} → ${config.targets.join(', ')} every ${interval}ms`,
    //     );

    // Run immediately
    pollSource(config);

    // Then every interval
    const timer = setInterval(() => pollSource(config), interval);
    timers.set(config.id, timer);
  }

  return timers;
}

/**
 * Get cross-poster statistics for all configured pairs.
 */
export function getCrossPosterStats(configs?: CrossPairConfig[]): PairStats[] {
  const cfgs = configs || DEFAULT_CONFIG;
  return cfgs.map((config) => {
    const stats = failureTracker.getPairStats(config.id);
    return {
      id: config.id,
      source: config.source,
      targets: config.targets.join(', '),
      totalAttempts: stats.totalAttempts,
      totalSuccesses: stats.totalSuccesses,
      totalFailures: stats.totalFailures,
      lastAttemptAt: stats.lastAttemptAt,
      lastSuccessAt: stats.lastSuccessAt,
      lastError: stats.lastError,
      consecutiveFailures: stats.consecutiveFailures,
      rateLimitRemaining: config.rateLimit
        ? rateLimiter.remaining(config.id, config.rateLimit.maxPosts, config.rateLimit.windowMs)
        : -1,
      enabled: config.enabled,
    };
  });
}

/**
 * Stop all cross-poster timers.
 */
export function stopCrossPoster(timers: Map<string, NodeJS.Timeout>): void {
  for (const [_id, timer] of timers) {
    clearInterval(timer);
    // console.log(`[crossposter] ${_id}: stopped`);
  }
  timers.clear();
}

/**
 * Reset state for a specific pair or all pairs.
 */
export function resetCrossPosterState(pairId?: string): void {
  if (pairId) {
    lastSeenIds.delete(pairId);
    rateLimiter.reset(pairId);
  } else {
    lastSeenIds.clear();
  }
}
