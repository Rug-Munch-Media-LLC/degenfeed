/**
 * @degenfeed/cross-protocol-bridge — One-Click "Publish to All" Orchestrator
 *
 * High-level orchestrator that cross-posts a MasterPost to every enabled
 * protocol in parallel. This powers the "Publish to All" UI button.
 *
 * Each target protocol gets content adapted to its specific format:
 *   - Nostr: kind 1 note (plaintext, 64K)
 *   - Farcaster: cast (plaintext, 320 chars)
 *   - Bluesky: skeet (plaintext, 300 chars)
 *   - Mastodon: toot (HTML, 500 chars)
 *   - Lemmy: community post (title + body)
 *   - PeerTube: video note with link
 *   - Pixelfed: photo with caption
 *   - Lens: publication (via Momoka)
 */

import type { MasterPost } from '../adapters/types';
import { type Bridge, getDefaultBridge } from '../bridge';
import type { NormalizedContent } from '../types';

export interface CrossPostToAllOptions {
  /** Override specific protocols to target */
  onlyProtocols?: string[];
  /** Skip these protocols */
  excludeProtocols?: string[];
}

export interface CrossPostToAllResult {
  success: boolean;
  total: number;
  results: Record<
    string,
    {
      success: boolean;
      error?: string;
      url?: string;
      nativeId?: string;
      latencyMs: number;
    }
  >;
  summary: {
    successCount: number;
    failureCount: number;
    totalLatencyMs: number;
  };
}

/** Default target protocols from each source protocol */
const SOURCE_TARGET_MAP: Record<string, string[]> = {
  nostr: ['farcaster', 'bluesky', 'mastodon', 'peertube', 'lens'],
  farcaster: ['nostr', 'bluesky', 'mastodon', 'lens'],
  bluesky: ['nostr', 'mastodon', 'lemmy', 'lens'],
  mastodon: ['nostr', 'bluesky', 'farcaster', 'peertube', 'lens', 'pixelfed'],
  peertube: ['nostr', 'farcaster', 'mastodon'],
  lens: ['nostr', 'farcaster'],
  lemmy: ['nostr', 'mastodon'],
  pixelfed: ['mastodon'],
  writefreely: ['mastodon'],
  owncast: ['mastodon'],
  reddit: ['mastodon'],
};

/**
 * Build a pseudo source protocol for routing based on post content.
 * Defaults to 'nostr' since it has the most bridge paths.
 */
function inferSourceProtocol(_post: MasterPost): string {
  // Posts can come from any protocol — we route to all enabled targets
  return 'nostr';
}

function getDefaultTargets(source: string): string[] {
  return SOURCE_TARGET_MAP[source] || ['mastodon', 'nostr', 'bluesky'];
}

/** Convert a MasterPost to the NormalizedContent format the bridge expects */
function masterPostToNormalized(post: MasterPost): NormalizedContent {
  return {
    text: post.text,
    html: post.text, // no HTML conversion here; bridge handles it
    hashtags: post.hashtags || [],
    mentions: (post.mentions || []).map((m) => ({
      raw: m,
      protocol: 'mastodon' as const,
      id: m,
      handle: m,
    })),
    media: (post.media || []).map((m) => ({
      kind: 'image' as const,
      url: m.url,
      alt: m.alt,
    })),
    links: post.linkCard ? [post.linkCard.url] : [],
    sourceProtocol: 'nostr' as const,
  };
}

/**
 * One-click cross-post to ALL protocols.
 * Publishes the given MasterPost to every enabled target protocol in parallel.
 */
export async function crossPostToAll(
  post: MasterPost,
  options: CrossPostToAllOptions = {},
): Promise<CrossPostToAllResult> {
  const bridge: Bridge = getDefaultBridge();
  const sourceProtocol = inferSourceProtocol(post);

  // Resolve target protocols
  let targetProtocols = options.onlyProtocols || getDefaultTargets(sourceProtocol);
  if (options.excludeProtocols) {
    targetProtocols = targetProtocols.filter((p) => !options.excludeProtocols?.includes(p));
  }

  if (targetProtocols.length === 0) {
    return {
      success: true,
      total: 0,
      results: {},
      summary: { successCount: 0, failureCount: 0, totalLatencyMs: 0 },
    };
  }

  // Build a pseudo UnifiedPost for the Bridge engine
  const normalized = masterPostToNormalized(post);
  const pseudoPost = {
    id: `df:${Date.now()}`,
    protocol: 'nostr' as const,
    author: {
      id: 'cross-post-bot',
      name: 'DegenFeed Cross-Poster',
    },
    content: {
      text: post.text,
      html: post.text,
    },
    media: normalized.media,
    hashtags: normalized.hashtags,
    mentions: normalized.mentions,
    links: normalized.links,
    timestamp: Date.now(),
  };

  // Bridge to each target protocol in parallel
  const results: CrossPostToAllResult['results'] = {};

  const bridgeResults = await Promise.allSettled(
    targetProtocols.map(async (target) => {
      const result = await bridge.bridgePost(pseudoPost as any, target as any);
      return { target, result };
    }),
  );

  for (const settled of bridgeResults) {
    if (settled.status === 'fulfilled') {
      const { target, result } = settled.value;
      results[target] = {
        success: result.success,
        error: result.error,
        url: (result.targetResult as Record<string, unknown>)?.url as string | undefined,
        nativeId: (result.targetResult as Record<string, unknown>)?.nativeId as string | undefined,
        latencyMs: result.latencyMs,
      };
    } else {
      results.unknown = {
        success: false,
        error: settled.reason?.message || 'Unknown error',
        latencyMs: 0,
      };
    }
  }

  const entries = Object.values(results);
  const successCount = entries.filter((r) => r.success).length;
  const failureCount = entries.filter((r) => !r.success).length;
  const totalLatencyMs = entries.reduce((sum, r) => sum + r.latencyMs, 0);

  return {
    success: failureCount === 0,
    total: targetProtocols.length,
    results,
    summary: { successCount, failureCount, totalLatencyMs },
  };
}

/**
 * Get the full list of available target protocols for a given source.
 */
export function getAvailableTargets(source: string): string[] {
  return getDefaultTargets(source);
}
