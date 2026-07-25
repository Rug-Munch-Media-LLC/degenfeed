/**
 * @degenfeed/api-worker — Cross-Publish Orchestrator
 *
 * Unified publisher for one-click multi-protocol publishing.
 * Accepts a MasterPost + protocol list + optional schedule time,
 * calls each protocol adapter, publishes in parallel, and returns results.
 *
 * Depends on the existing publish-orchestrator.ts for actual SDK calls,
 * and on @degenfeed/cross-protocol-bridge for content adaptation.
 */

import type { MasterPost } from '@degenfeed/cross-protocol-bridge';
import { adaptForProtocols } from '@degenfeed/cross-protocol-bridge';
import type { Protocol } from '@degenfeed/types';
import type { Env } from '../index';
import type { PublishInput } from './publish-orchestrator';
import { orchestratePublish } from './publish-orchestrator';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CrossPublishRequest {
  /** The master post content to distribute */
  masterPost: MasterPost;
  /** Target protocols to publish to */
  protocols: Protocol[];
  /** Optional: schedule for later (ISO date string or unix ms) */
  scheduleTime?: string | number;
  /** Per-protocol auth tokens */
  auth?: Record<string, string>;
  /** Pre-signed messages (for Farcaster, Lens, etc.) */
  signedMessage?: string;
  typedDataId?: string;
  signature?: string;
}

export interface PerProtocolResult {
  /** Protocol identifier */
  protocol: string;
  /** Publication status */
  status: 'published' | 'failed' | 'pending' | 'scheduled';
  /** Native post ID on the target protocol */
  postId?: string;
  /** URL to the published post */
  url?: string;
  /** Error message if failed */
  error?: string;
  /** Timestamp of publication */
  publishedAt?: number;
  /** Character count of published content */
  charCount?: number;
  /** Whether media was attached */
  hasMedia?: boolean;
}

export interface CrossPublishReport {
  /** Unique publish batch ID */
  batchId: string;
  /** Timestamp when the publish was initiated */
  initiatedAt: number;
  /** Results per protocol */
  results: PerProtocolResult[];
  /** Summary counts */
  summary: {
    total: number;
    published: number;
    failed: number;
    scheduled: number;
    pending: number;
  };
  /** Whether this was scheduled */
  scheduled: boolean;
  /** ISO schedule time if applicable */
  scheduledAt?: string;
  /** Total latency for all publishes (ms) */
  totalLatencyMs: number;
}

// ─── Cross-Post Record ────────────────────────────────────────────────────

export interface CrossPostLinkRecord {
  /** DegenFeed batch ID linking all copies */
  batchId: string;
  /** Original master post text (hashed for dedup) */
  textHash: string;
  /** All protocol copies */
  copies: Array<{
    protocol: string;
    nativeId?: string;
    url?: string;
    status: 'published' | 'failed' | 'scheduled';
    publishedAt?: number;
  }>;
  /** When the batch was created */
  createdAt: number;
  /** Author wallet/ID */
  author: string;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────

let batchCounter = 0;

function generateBatchId(): string {
  batchCounter++;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `cp-${ts}-${rand}-${batchCounter}`;
}

/**
 * Execute a cross-publish: adapt content per protocol, publish in parallel,
 * track results, create cross-post linkage records.
 */
export async function executeCrossPublish(
  request: CrossPublishRequest,
  env: Env,
): Promise<CrossPublishReport> {
  const startTime = Date.now();
  const batchId = generateBatchId();
  const isScheduled = !!request.scheduleTime;

  // Step 1: Adapt the master post for all target protocols
  const adapted = adaptForProtocols(request.masterPost, request.protocols);

  // Step 2: Build publish inputs and execute in parallel
  const publishPromises = Object.entries(adapted).map(async ([protocol, result]) => {
    const baseResult: PerProtocolResult = {
      protocol,
      status: 'pending',
      publishedAt: Date.now(),
    };

    if ('error' in result) {
      return {
        ...baseResult,
        status: 'failed' as const,
        error: result.error,
      };
    }

    const { params, adapter } = result;
    const charCount = params.text.length;
    const hasMedia = !!params.mediaUrls && params.mediaUrls.length > 0;

    // Build the PublishInput for the existing orchestrator
    const publishInput: PublishInput = {
      text: params.text,
      title: params.title,
      targets: [protocol as Protocol],
      auth: request.auth,
      images: params.mediaUrls?.map((url, i) => ({
        url,
        alt: params.mediaAlts?.[i] ?? '',
        mimeType: 'image/jpeg',
      })),
      hashtags: params.formattedHashtags?.map((h) => h.replace(/^#/, '')),
      links: request.masterPost.linkCard ? [request.masterPost.linkCard.url] : undefined,
      signedMessage: request.signedMessage,
      typedDataId: request.typedDataId,
      signature: request.signature,
    };

    // Add protocol-specific extras
    if (params.extra?.spoilerText) {
      publishInput.auth = {
        ...publishInput.auth,
        mastodon_cw: String(params.extra.spoilerText),
      };
    }

    try {
      const report = await orchestratePublish(publishInput, env);
      const resultData = report.results[protocol];

      if (resultData?.ok) {
        return {
          ...baseResult,
          status: isScheduled ? ('scheduled' as const) : ('published' as const),
          postId: resultData.nativeId,
          url: resultData.nativeUri,
          charCount,
          hasMedia,
          publishedAt: Date.now(),
        };
      }

      return {
        ...baseResult,
        status: 'failed' as const,
        error: resultData?.error ?? 'Unknown publish error',
        charCount,
        hasMedia,
      };
    } catch (err) {
      return {
        ...baseResult,
        status: 'failed' as const,
        error: err instanceof Error ? err.message : String(err),
        charCount,
        hasMedia,
      };
    }
  });

  const results = await Promise.all(publishPromises);

  // Step 3: Compute summary
  const published = results.filter((r) => r.status === 'published').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const scheduled = results.filter((r) => r.status === 'scheduled').length;

  // Step 4: Store cross-post linkage record in KV
  try {
    await storeCrossPostLink(batchId, results, request, env);
  } catch (err) {
    console.error('[cross-publish] Failed to store linkage record:', err);
  }

  const totalLatencyMs = Date.now() - startTime;

  return {
    batchId,
    initiatedAt: startTime,
    results,
    summary: {
      total: results.length,
      published,
      failed,
      scheduled,
      pending: results.filter((r) => r.status === 'pending').length,
    },
    scheduled: isScheduled,
    scheduledAt: isScheduled ? new Date(request.scheduleTime!).toISOString() : undefined,
    totalLatencyMs,
  };
}

// ─── Cross-Post Linkage Storage ───────────────────────────────────────────

async function storeCrossPostLink(
  batchId: string,
  results: PerProtocolResult[],
  request: CrossPublishRequest,
  env: Env,
): Promise<void> {
  if (!env.CACHE) return;

  const record: CrossPostLinkRecord = {
    batchId,
    textHash: simpleHash(request.masterPost.text),
    copies: results.map((r) => ({
      protocol: r.protocol,
      nativeId: r.postId,
      url: r.url,
      status: r.status,
      publishedAt: r.publishedAt,
    })),
    createdAt: Date.now(),
    author: request.auth?.wallet ?? 'anonymous',
  };

  // Store by batch ID
  await env.CACHE.put(`crosspost:batch:${batchId}`, JSON.stringify(record), {
    expirationTtl: 86400 * 90, // 90 days
  });

  // Store in the author's post list
  const authorKey = `crosspost:author:${record.author}`;
  const existing = await env.CACHE.get(authorKey, 'json').catch(() => null);
  const batchList: string[] = Array.isArray(existing) ? (existing as string[]) : [];
  batchList.push(batchId);
  await env.CACHE.put(authorKey, JSON.stringify(batchList.slice(-100)), {
    expirationTtl: 86400 * 90,
  });
}

/**
 * Get all cross-post batches for an author.
 */
export async function getAuthorCrossPostBatches(
  author: string,
  env: Env,
): Promise<CrossPostLinkRecord[]> {
  if (!env.CACHE) return [];

  const authorKey = `crosspost:author:${author}`;
  const batchIds: string[] = (await env.CACHE.get(authorKey, 'json').catch(() => [])) as string[];

  if (!batchIds || batchIds.length === 0) return [];

  const records = await Promise.all(
    batchIds.map(async (id) => {
      const raw = await env.CACHE.get(`crosspost:batch:${id}`, 'json').catch(() => null);
      return raw as CrossPostLinkRecord | null;
    }),
  );

  return records.filter(Boolean) as CrossPostLinkRecord[];
}

/**
 * Get a single cross-post batch by ID.
 */
export async function getCrossPostBatch(
  batchId: string,
  env: Env,
): Promise<CrossPostLinkRecord | null> {
  if (!env.CACHE) return null;
  const raw = await env.CACHE.get(`crosspost:batch:${batchId}`, 'json').catch(() => null);
  return raw as CrossPostLinkRecord | null;
}

/**
 * Delete a cross-post batch record.
 */
export async function deleteCrossPostBatch(batchId: string, env: Env): Promise<boolean> {
  if (!env.CACHE) return false;
  try {
    // Get the record first to know the author
    const record = await getCrossPostBatch(batchId, env);
    if (record) {
      // Remove from author's list
      const authorKey = `crosspost:author:${record.author}`;
      const existing: string[] = (await env.CACHE.get(authorKey, 'json').catch(
        () => [],
      )) as string[];
      if (Array.isArray(existing)) {
        const updated = existing.filter((id) => id !== batchId);
        await env.CACHE.put(authorKey, JSON.stringify(updated), {
          expirationTtl: 86400 * 90,
        });
      }
    }
    await env.CACHE.delete(`crosspost:batch:${batchId}`);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36);
}
