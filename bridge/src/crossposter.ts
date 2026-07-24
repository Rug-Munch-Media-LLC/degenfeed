/**
 * DegenFeed Cross-Poster v2
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
 *   - Lemmy → Nostr (announce hot posts)
 *
 * The cross-poster polls source protocols and publishes formatted
 * content to target protocols using the configured transforms.
 */

import type { UnifiedPost } from './server';

// ─── Types ──────────────────────────────────────────────────────────────

export type ProtocolName = 'mastodon' | 'nostr' | 'bluesky' | 'peertube' | 'lemmy' | 'farcaster';

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
      30_000 * Math.pow(2, record.consecutiveFailures - 1),
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

interface TransformFunction {
  (post: UnifiedPost, target: ProtocolName): TransformResult | Promise<TransformResult>;
}

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
   */
  bluesky: (post: UnifiedPost): TransformResult => {
    const text = `${post.text}\n\n[Originally from ${post.protocol}]`;
    const facets: Array<{
      index: { byteStart: number; byteEnd: number };
      features: Array<{ $type: string; uri?: string; tag?: string }>;
    }> = [];

    // Add link facets if there are embeds
    for (const embed of post.embeds) {
      if (embed.kind === 'link') {
        facets.push({
          index: {
            byteStart: 0,
            byteEnd: new TextEncoder().encode(text).byteLength,
          },
          features: [
            { $type: 'app.bsky.richtext.facet#link', uri: embed.url },
          ],
        });
      }
    }

    return {
      success: true,
      payload: {
        $type: 'app.bsky.feed.post',
        text,
        createdAt: new Date(post.createdAt).toISOString(),
        facets: facets.length > 0 ? facets : undefined,
        // In production, also handle embed = external, images, etc.
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

    const duration = videoEmbed.meta?.duration || 0;
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
    const text = post.text.length > 320
      ? `${post.text.slice(0, 300)}...\n\n[Cross-posted from ${post.protocol}]`
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
};

// ─── Publishers ─────────────────────────────────────────────────────────

async function publishToNostrRelay(
  _payload: unknown,
): Promise<boolean> {
  const relayUrl = process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:8085';
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

async function publishToBluesky(
  _payload: unknown,
): Promise<boolean> {
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

async function publishToPeerTube(
  payload: unknown,
): Promise<boolean> {
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

async function publishToFarcaster(
  _payload: unknown,
): Promise<boolean> {
  const hubUrl = process.env.FARCASTER_HUB_URL || 'https://hub.farcaster.standardcrypto.vc:2281';
  const payload = _payload as { text: string; embeds: Array<{ url: string }> };
  if (!process.env.FARCASTER_SIGNER_KEY) return false;

  // In production, this would create a signed message using the signer key
  // and submit to the Hub. For now, just log.
  console.log(`[crossposter] Would cast to Farcaster: "${payload.text.slice(0, 50)}..."`);
  return true;
}

async function publishToMastodon(
  payload: unknown,
): Promise<boolean> {
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

// ─── Publisher lookup ───────────────────────────────────────────────────

const PUBLISHERS: Record<string, (payload: unknown) => Promise<boolean>> = {
  nostr: publishToNostrRelay,
  bluesky: publishToBluesky,
  peertube: publishToPeerTube,
  farcaster: publishToFarcaster,
  mastodon: publishToMastodon,
};

// ─── Source Pollers ─────────────────────────────────────────────────────

async function fetchLatestGtsPost(): Promise<UnifiedPost | null> {
  const gtsBase = process.env.GTS_BASE_URL || 'http://127.0.0.1:8082';
  const clientId = process.env.GTS_CLIENT_ID || '';
  const clientSecret = process.env.GTS_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    console.log('[crossposter] GTS: no credentials');
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
      console.log('[crossposter] GTS token failed');
      return null;
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) return null;

    const res = await fetch(
      `${gtsBase}/api/v1/timelines/public?local=true&limit=1`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );
    if (!res.ok) return null;

    const raw = (await res.json()) as Array<{
      id: string;
      content: string;
      created_at: string;
      account: { id: string; username: string; acct: string; display_name: string };
    }>;

    if (!raw.length) return null;

    const s = raw[0];
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
      embeds: [],
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
  } catch (err) {
    console.log('[crossposter] GTS fetch error:', (err as Error).message);
    return null;
  }
}

async function fetchLatestLemmyPost(): Promise<UnifiedPost | null> {
  const lemmyBase = process.env.LEMMY_BASE_URL || 'http://127.0.0.1:8536';

  try {
    const res = await fetch(
      `${lemmyBase}/api/v3/post/list?sort=New&limit=1&type_=Local`,
      { headers: { 'User-Agent': 'DegenFeed-CrossPoster/0.2' } },
    );
    if (!res.ok) return null;

    const data = (await res.json()) as {
      posts?: Array<{
        post: { id: number; name: string; body?: string; published: string; ap_id: string };
        creator?: { person: { id: number; name: string; display_name?: string; avatar?: string } };
        community?: { community: { id: number; name: string; title: string } };
      }>;
    };

    if (!data.posts?.length) return null;

    const pv = data.posts[0];
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
      nostr: { relayUrl: process.env.NOSTR_RELAY_URL || 'ws://127.0.0.1:8085' },
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
    contentFilter: (post: UnifiedPost) =>
      post.embeds.some((e) => e.kind === 'video'),
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
];

// ─── Core Engine ────────────────────────────────────────────────────────

const rateLimiter = new RateLimiter();
const failureTracker = new FailureTracker();

/** Source pollers by protocol */
const SOURCE_POLLERS: Record<string, () => Promise<UnifiedPost | null>> = {
  mastodon: fetchLatestGtsPost,
  lemmy: fetchLatestLemmyPost,
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

    // Get transform
    const transform = TRANSFORMS[target];
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
        results.push({ success: true, target, latencyMs });
        failureTracker.recordSuccess(config.id, target);
        console.log(
          `[crossposter] ✓ ${config.id} → ${target} (${latencyMs}ms): ${post.id}`,
        );
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
        console.log(
          `[crossposter] ✗ ${config.id} → ${target}: publisher failed`,
        );
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
      console.log(
        `[crossposter] ✗ ${config.id} → ${target}: ${(err as Error).message}`,
      );
    }
  }

  const allOk = results.every((r) => r.success);
  return { success: allOk, results };
}

/**
 * Poll a single source and cross-post to all configured targets.
 */
async function pollSource(
  config: CrossPairConfig,
): Promise<void> {
  const poller = SOURCE_POLLERS[config.source];
  if (!poller) {
    console.log(`[crossposter] No poller for source: ${config.source}`);
    return;
  }

  try {
    const post = await poller();
    if (!post) {
      console.log(`[crossposter] ${config.id}: no new posts from ${config.source}`);
      return;
    }

    const lastId = lastSeenIds.get(config.id);
    if (post.id === lastId) {
      return; // Already cross-posted
    }

    // Apply content filter
    if (config.contentFilter && !config.contentFilter(post)) {
      console.log(`[crossposter] ${config.id}: post filtered out`);
      return;
    }

    const { success, results } = await crossPost(post, config);

    if (success) {
      lastSeenIds.set(config.id, post.id);
      console.log(
        `[crossposter] ${config.id}: all targets succeeded (${results.length})`,
      );
    } else {
      const failures = results.filter((r) => !r.success);
      console.log(
        `[crossposter] ${config.id}: ${failures.length}/${results.length} targets failed`,
      );
    }
  } catch (err) {
    console.log(
      `[crossposter] ${config.id}: poll error - ${(err as Error).message}`,
    );
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Start all cross-posting pairs.
 * Each pair runs on its own polling interval.
 */
export function startCrossPoster(
  customConfigs?: CrossPairConfig[],
): Map<string, NodeJS.Timeout> {
  const configs = customConfigs || DEFAULT_CONFIG;
  const timers = new Map<string, NodeJS.Timeout>();

  for (const config of configs) {
    if (!config.enabled) {
      console.log(`[crossposter] ${config.id}: disabled, skipping`);
      continue;
    }

    const interval = config.pollIntervalMs || 60000;
    console.log(
      `[crossposter] ${config.id}: ${config.source} → ${config.targets.join(', ')} every ${interval}ms`,
    );

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
  for (const [id, timer] of timers) {
    clearInterval(timer);
    console.log(`[crossposter] ${id}: stopped`);
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
