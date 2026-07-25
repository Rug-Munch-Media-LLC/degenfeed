/**
 * @degenfeed/api-worker — Content Syndication Engine
 *
 * Automatic syndication of content across protocols. When a creator publishes
 * on one protocol, this engine auto-posts to all connected protocols with
 * format adaptation, optimal scheduling, and engagement aggregation.
 *
 * KV key scheme:
 *   syndication:rules:{wallet}         → SyndicationRules
 *   syndication:queue:{queueId}        → QueuedSyndication
 *   syndication:history:{wallet}:{id}  → SyndicationHistoryEntry
 *   syndication:format-cache:{hash}    → Adapted formats (cache, 1h TTL)
 */

import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import type { ContentRecord, MediaAttachment } from './content-library';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SyndicationMode = 'auto' | 'manual-review' | 'never';
export type SyndicationStatus = 'queued' | 'in-progress' | 'completed' | 'failed' | 'cancelled';

export interface ProtocolSyndicationRule {
  /** Protocol identifier */
  protocol: string;
  /** Syndication mode */
  mode: SyndicationMode;
  /** Suggested posting time (HH:MM in UTC) for optimal engagement */
  preferredTime?: string;
  /** Days of week to post (0=Sun, 6=Sat). Empty = every day. */
  preferredDays?: number[];
  /** Minimum interval between posts (in minutes) */
  minIntervalMinutes?: number;
  /** Whether to automatically adapt format */
  autoAdaptFormat: boolean;
  /** Whether to include media attachments */
  includeMedia: boolean;
  /** Whether to include hashtags */
  includeHashtags: boolean;
}

export interface SyndicationRules {
  wallet: string;
  /** Per-protocol syndication rules */
  protocols: Record<string, ProtocolSyndicationRule>;
  /** Default rule for unconfigured protocols */
  defaultMode: SyndicationMode;
  /** Global cooldown between syndication events (minutes) */
  globalCooldownMinutes: number;
  /** Whether cross-platform threading is enabled (linking posts as siblings) */
  crossPlatformThreading: boolean;
  updatedAt: number;
}

export interface QueuedSyndication {
  queueId: string;
  wallet: string;
  /** The content to syndicate */
  contentId: string;
  /** Source protocol (where it was originally published) */
  sourceProtocol: string;
  /** Target protocols */
  targetProtocols: string[];
  /** When to syndicate (0 = immediately) */
  scheduledAt: number;
  /** Actual publish time */
  publishedAt?: number;
  status: SyndicationStatus;
  /** Per-protocol results */
  results: Record<
    string,
    {
      status: 'pending' | 'published' | 'failed' | 'skipped';
      nativeId?: string;
      url?: string;
      error?: string;
    }
  >;
  /** Auth tokens snapshot for syndication */
  auth?: Record<string, string>;
  /** Number of retries attempted */
  retryCount: number;
  createdAt: number;
}

export interface SyndicationHistoryEntry {
  id: string;
  wallet: string;
  contentId: string;
  sourceProtocol: string;
  targetProtocol: string;
  status: 'completed' | 'failed' | 'skipped';
  nativeId?: string;
  url?: string;
  error?: string;
  durationMs: number;
  createdAt: number;
}

// ─── Default Rules ──────────────────────────────────────────────────────────

export const DEFAULT_SYNDICATION_RULES: SyndicationRules = {
  wallet: '',
  protocols: {
    nostr: {
      protocol: 'nostr',
      mode: 'auto',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
    farcaster: {
      protocol: 'farcaster',
      mode: 'auto',
      autoAdaptFormat: true,
      includeMedia: false,
      includeHashtags: false,
    },
    bluesky: {
      protocol: 'bluesky',
      mode: 'auto',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
    mastodon: {
      protocol: 'mastodon',
      mode: 'auto',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
    lens: {
      protocol: 'lens',
      mode: 'manual-review',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
    threads: {
      protocol: 'threads',
      mode: 'manual-review',
      autoAdaptFormat: true,
      includeMedia: false,
      includeHashtags: false,
    },
    telegram: {
      protocol: 'telegram',
      mode: 'auto',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
    reddit: {
      protocol: 'reddit',
      mode: 'manual-review',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: false,
    },
    lemmy: {
      protocol: 'lemmy',
      mode: 'manual-review',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: false,
    },
    peertube: {
      protocol: 'peertube',
      mode: 'never',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
    pixelfed: {
      protocol: 'pixelfed',
      mode: 'manual-review',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    },
  },
  defaultMode: 'manual-review',
  globalCooldownMinutes: 5,
  crossPlatformThreading: true,
  updatedAt: Date.now(),
};

// ─── KV Helpers ─────────────────────────────────────────────────────────────

// biome-ignore lint/style/noNonNullAssertion: KV namespace is always bound in production via wrangler.toml
function kv(env: Env): KVNamespace {
  return env.CONTENT_LIBRARY || env.CACHE!;
}

function rulesKey(wallet: string): string {
  return `syndication:rules:${wallet.toLowerCase()}`;
}

function queueKey(queueId: string): string {
  return `syndication:queue:${queueId}`;
}

function historyKey(wallet: string): string {
  return `syndication:history:${wallet.toLowerCase()}`;
}

// ─── Rules Management ───────────────────────────────────────────────────────

/**
 * Get syndication rules for a wallet.
 * Returns defaults if none configured.
 */
export async function getSyndicationRules(env: Env, wallet: string): Promise<SyndicationRules> {
  const store = kv(env);
  try {
    const raw = await store.get(rulesKey(wallet));
    if (raw) return JSON.parse(raw) as SyndicationRules;
  } catch {
    // Fall through to defaults
  }

  // Return defaults with the wallet set
  return { ...DEFAULT_SYNDICATION_RULES, wallet: wallet.toLowerCase() };
}

/**
 * Set syndication rules for a wallet.
 */
export async function setSyndicationRules(
  env: Env,
  wallet: string,
  rules: Partial<SyndicationRules>,
): Promise<SyndicationRules> {
  const existing = await getSyndicationRules(env, wallet);
  const updated: SyndicationRules = {
    ...existing,
    ...rules,
    wallet: wallet.toLowerCase(),
    updatedAt: Date.now(),
  };

  const store = kv(env);
  await store.put(rulesKey(wallet), JSON.stringify(updated));
  return updated;
}

/**
 * Update per-protocol syndication rules.
 */
export async function updateProtocolSyndicationRule(
  env: Env,
  wallet: string,
  protocol: string,
  rule: Partial<ProtocolSyndicationRule>,
): Promise<SyndicationRules> {
  const existing = await getSyndicationRules(env, wallet);
  existing.protocols[protocol] = {
    ...(existing.protocols[protocol] || {
      protocol,
      mode: 'manual-review',
      autoAdaptFormat: true,
      includeMedia: true,
      includeHashtags: true,
    }),
    ...rule,
    protocol,
  };
  existing.updatedAt = Date.now();

  const store = kv(env);
  await store.put(rulesKey(wallet), JSON.stringify(existing));
  return existing;
}

// ─── Queue Management ───────────────────────────────────────────────────────

/**
 * Queue content for syndication to target protocols.
 */
export async function queueSyndication(
  env: Env,
  wallet: string,
  contentId: string,
  sourceProtocol: string,
  targetProtocols: string[],
  options?: {
    scheduledAt?: number;
    auth?: Record<string, string>;
  },
): Promise<QueuedSyndication> {
  const store = kv(env);
  const queueId = `synd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const entry: QueuedSyndication = {
    queueId,
    wallet: wallet.toLowerCase(),
    contentId,
    sourceProtocol,
    targetProtocols,
    scheduledAt: options?.scheduledAt ?? 0,
    status: 'queued',
    results: Object.fromEntries(targetProtocols.map((p) => [p, { status: 'pending' as const }])),
    retryCount: 0,
    createdAt: Date.now(),
  };

  if (options?.auth) {
    entry.auth = options.auth;
  }

  await store.put(queueKey(queueId), JSON.stringify(entry), {
    expirationTtl: 86400 * 7, // 7 days
  });

  return entry;
}

/**
 * Get a queued syndication entry.
 */
export async function getQueuedSyndication(
  env: Env,
  queueId: string,
): Promise<QueuedSyndication | null> {
  const store = kv(env);
  try {
    const raw = await store.get(queueKey(queueId));
    return raw ? (JSON.parse(raw) as QueuedSyndication) : null;
  } catch {
    return null;
  }
}

/**
 * Execute a queued syndication. Called by the cron or immediately.
 */
export async function executeSyndication(env: Env, queueId: string): Promise<QueuedSyndication> {
  const entry = await getQueuedSyndication(env, queueId);
  if (!entry) throw new Error(`Syndication queue entry ${queueId} not found`);
  if (entry.status === 'completed') return entry;

  entry.status = 'in-progress';
  const store = kv(env);
  await store.put(queueKey(queueId), JSON.stringify(entry));

  // Get the content from the library
  const { getContent } = await import('./content-library');
  const content = await getContent(env, entry.wallet, entry.contentId);
  if (!content) {
    entry.status = 'failed';
    for (const p of entry.targetProtocols) {
      entry.results[p] = { status: 'failed', error: 'Content not found in library' };
    }
    await store.put(queueKey(queueId), JSON.stringify(entry));
    return entry;
  }

  // Get syndication rules
  const rules = await getSyndicationRules(env, entry.wallet);

  // Execute per-protocol
  for (const protocol of entry.targetProtocols) {
    const rule = rules.protocols[protocol];
    if (rule?.mode === 'never') {
      entry.results[protocol] = { status: 'skipped', error: 'Protocol set to never syndicate' };
      continue;
    }

    try {
      const result = await syndicateToProtocol(env, content, protocol, rule, entry.auth ?? {});
      entry.results[protocol] = result;

      // Record history
      await recordSyndicationHistory(
        env,
        entry.wallet,
        entry.contentId,
        entry.sourceProtocol,
        protocol,
        result,
      );
    } catch (err) {
      entry.results[protocol] = {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  entry.status = 'completed';
  entry.publishedAt = Date.now();
  await store.put(queueKey(queueId), JSON.stringify(entry));

  return entry;
}

// ─── Protocol Syndication ───────────────────────────────────────────────────

/**
 * Syndicate content to a single protocol.
 */
async function syndicateToProtocol(
  env: Env,
  content: ContentRecord,
  protocol: string,
  rule: ProtocolSyndicationRule | undefined,
  auth: Record<string, string>,
): Promise<{
  status: 'published' | 'failed' | 'skipped';
  nativeId?: string;
  url?: string;
  error?: string;
}> {
  // Check if we should auto-adapt format
  let text = content.body;
  let title = content.title;
  let media: MediaAttachment[] = content.media;

  if (rule?.autoAdaptFormat) {
    const adapted = adaptForProtocol(text, title, media, protocol);
    text = adapted.text;
    title = adapted.title;
    media = adapted.media;
  }

  if (!rule?.includeMedia) {
    media = [];
  }

  // Build auth for this protocol
  const protocolAuth: Record<string, string> = {};
  for (const [key, val] of Object.entries(auth)) {
    if (key.startsWith(protocol) || key === protocol) {
      protocolAuth[key] = val;
    }
  }

  try {
    // Use the publish orchestrator for actual publishing
    const { orchestratePublish } = await import('./publish-orchestrator');
    const result = await orchestratePublish(
      {
        text,
        title,
        targets: [protocol as Protocol],
        auth: protocolAuth,
        images: media.map((m) => ({
          url: m.url,
          alt: m.alt,
          mimeType: m.mimeType,
        })),
        hashtags: content.tags,
        links: [],
      },
      env,
    );

    const protoResult = result.results[protocol];
    if (protoResult?.ok) {
      // Update the content record with the syndicated copy
      const { updateContent } = await import('./content-library');
      await updateContent(env, content.creatorWallet, content.id, {
        protocols: {
          ...content.protocols,
          [protocol]: {
            status: 'published',
            postId: protoResult.nativeId ?? `${protocol}:${Date.now()}`,
            url: protoResult.nativeUri ?? '',
            publishedAt: Date.now(),
            engagement: {
              likes: 0,
              reposts: 0,
              replies: 0,
              quotes: 0,
              views: 0,
              lastSyncedAt: Date.now(),
            },
            nativeUri: protoResult.nativeUri,
          },
        },
      });

      return {
        status: 'published',
        nativeId: protoResult.nativeId,
        url: protoResult.nativeUri,
      };
    }

    return {
      status: 'failed',
      error: protoResult?.error ?? 'Unknown publish error',
    };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Format Adaptation ──────────────────────────────────────────────────────

interface AdaptedContent {
  text: string;
  title?: string;
  media: MediaAttachment[];
}

const PROTOCOL_LIMITS: Record<string, number> = {
  nostr: 50000,
  farcaster: 320,
  bluesky: 300,
  mastodon: 500,
  lens: 5000,
  threads: 500,
  telegram: 4096,
  reddit: 40000,
  lemmy: 50000,
  peertube: 5000,
  pixelfed: 5000,
};

/**
 * Adapt content for a specific protocol's constraints.
 */
function adaptForProtocol(
  text: string,
  title: string | undefined,
  media: MediaAttachment[],
  protocol: string,
): AdaptedContent {
  const limit = PROTOCOL_LIMITS[protocol] ?? 50000;

  let adaptedText = text;
  let adaptedTitle = title;
  let adaptedMedia = [...media];

  switch (protocol) {
    case 'farcaster': {
      // Farcaster: 320 chars max, no media embeds
      adaptedText = text.slice(0, 280);
      if (title) {
        adaptedText = `${title}\n\n${adaptedText}`.slice(0, 280);
      }
      adaptedTitle = undefined;
      adaptedMedia = [];
      break;
    }

    case 'bluesky': {
      // Bluesky: 300 chars, up to 4 images
      adaptedText = text.slice(0, 280);
      if (title) {
        adaptedText = `${title}: ${adaptedText}`.slice(0, 280);
      }
      adaptedTitle = undefined;
      adaptedMedia = media.slice(0, 4);
      break;
    }

    case 'mastodon': {
      // Mastodon: 500 chars, 4 media, CW support
      adaptedText = text.slice(0, 480);
      if (title) {
        adaptedText = `${title}\n\n${adaptedText}`.slice(0, 480);
      }
      adaptedTitle = undefined;
      adaptedMedia = media.slice(0, 4);
      break;
    }

    case 'nostr': {
      // Nostr: 50k chars, unlimited media (in practice 10)
      if (title) {
        adaptedText = `# ${title}\n\n${text}`;
      }
      adaptedMedia = media.slice(0, 10);
      break;
    }

    case 'lens':
    case 'threads': {
      adaptedText = text.slice(0, limit);
      adaptedTitle = undefined;
      adaptedMedia = media.slice(0, 4);
      break;
    }

    case 'reddit':
    case 'lemmy': {
      // Reddit/Lemmy: support title + body
      adaptedTitle = title || text.slice(0, 200);
      adaptedText = text.slice(0, limit);
      adaptedMedia = media.slice(0, 1);
      break;
    }

    case 'telegram': {
      // Telegram: HTML support, 4096 chars
      adaptedText = text.slice(0, 4000);
      adaptedTitle = undefined;
      adaptedMedia = media.slice(0, 10);
      break;
    }

    case 'peertube': {
      // PeerTube: video description
      adaptedTitle = title || text.slice(0, 200);
      adaptedText = text.slice(0, 4800);
      // PeerTube doesn't accept image galleries as descriptions
      adaptedMedia = [];
      break;
    }

    default: {
      adaptedText = text.slice(0, limit);
      break;
    }
  }

  return { text: adaptedText, title: adaptedTitle, media: adaptedMedia };
}

// ─── History ────────────────────────────────────────────────────────────────

/**
 * Record a syndication history entry.
 */
async function recordSyndicationHistory(
  env: Env,
  wallet: string,
  contentId: string,
  sourceProtocol: string,
  targetProtocol: string,
  result: { status: string; nativeId?: string; url?: string; error?: string },
): Promise<void> {
  const store = kv(env);
  const key = historyKey(wallet);
  const id = `synd-hist-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const entry: SyndicationHistoryEntry = {
    id,
    wallet: wallet.toLowerCase(),
    contentId,
    sourceProtocol,
    targetProtocol,
    status: result.status as 'completed' | 'failed' | 'skipped',
    nativeId: result.nativeId,
    url: result.url,
    error: result.error,
    durationMs: 0,
    createdAt: Date.now(),
  };

  try {
    const raw = await store.get(key);
    const history: SyndicationHistoryEntry[] = raw ? JSON.parse(raw) : [];
    history.push(entry);
    // Keep last 1000 entries
    const trimmed = history.slice(-1000);
    await store.put(key, JSON.stringify(trimmed));
  } catch {
    // non-critical
  }
}

/**
 * Get syndication history for a wallet.
 */
export async function getSyndicationHistory(
  env: Env,
  wallet: string,
  limit = 50,
): Promise<SyndicationHistoryEntry[]> {
  const store = kv(env);
  try {
    const raw = await store.get(historyKey(wallet));
    if (!raw) return [];
    const history: SyndicationHistoryEntry[] = JSON.parse(raw);
    return history.slice(-limit).reverse();
  } catch {
    return [];
  }
}

// ─── Scheduled Syndication Executor ─────────────────────────────────────────

/**
 * Execute all due queued syndications. Called by cron.
 */
export async function executeDueSyndications(env: Env): Promise<number> {
  const store = kv(env);
  let executed = 0;

  try {
    // List all syndication queue entries
    let cursor: string | undefined;
    do {
      const page: { keys: { name: string }[]; list_complete: boolean; cursor?: string } =
        await store.list({ prefix: 'syndication:queue:', cursor, limit: 100 });

      for (const key of page.keys) {
        try {
          const raw = await store.get(key.name);
          if (!raw) continue;

          const entry = JSON.parse(raw) as QueuedSyndication;

          // Skip completed or future entries
          if (entry.status === 'completed' || entry.status === 'in-progress') continue;
          if (entry.scheduledAt > Date.now()) continue;

          await executeSyndication(env, entry.queueId);
          executed++;
        } catch (err) {
          console.error(`[syndication] Failed to execute ${key.name}:`, err);
        }
      }

      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (err) {
    console.error('[syndication] Failed to list syndication queue:', err);
  }

  return executed;
}

/**
 * Check if a syndication is allowed based on cooldown rules.
 */
export async function canSyndicate(
  env: Env,
  wallet: string,
  protocol: string,
): Promise<{ allowed: boolean; reason?: string; nextAvailableAt?: number }> {
  const rules = await getSyndicationRules(env, wallet);
  const protocolRule = rules.protocols[protocol];

  if (protocolRule?.mode === 'never') {
    return { allowed: false, reason: `Syndication to ${protocol} is disabled` };
  }

  // Check last syndication time for this protocol
  const history = await getSyndicationHistory(env, wallet, 5);
  const lastToProtocol = history.find((h) => h.targetProtocol === protocol);

  if (lastToProtocol) {
    const minInterval = protocolRule?.minIntervalMinutes ?? rules.globalCooldownMinutes;
    const elapsed = (Date.now() - lastToProtocol.createdAt) / 60000;
    if (elapsed < minInterval) {
      const nextAvailableAt = lastToProtocol.createdAt + minInterval * 60000;
      return {
        allowed: false,
        reason: `Cooldown active. Next available at ${new Date(nextAvailableAt).toISOString()}`,
        nextAvailableAt,
      };
    }
  }

  return { allowed: true };
}
