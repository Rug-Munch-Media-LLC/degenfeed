/**
 * @degenfeed/cross-protocol-bridge — Unified Cross-Protocol Bridge
 *
 * THE single bridge for ALL protocol translations.
 *
 * Handles:
 *   - ActivityPub → AT Protocol (via Bridgy Fed)
 *   - ActivityPub → Nostr (via Mostr or custom)
 *   - AT Protocol → Nostr
 *   - Nostr → Farcaster
 *   - RSS → ActivityPub
 *   - Any future bridge path via the adapter system
 *
 * Features:
 *   - Circuit breaker per bridge path (prevents cascade failures)
 *   - Health monitoring with periodic checks
 *   - Content normalization (UnifiedPost → NormalizedContent)
 *   - Identity linking for cross-protocol awareness
 *   - Automatic cross-posting for linked identities
 *   - Bridge result tracking and metrics
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { circuitBreaker } from './circuit-breaker';
import { healthMonitor } from './health-monitor';
import { resolveByIdentity, getLinkedProtocols, linkIdentity } from './identity-linking';
import { normalizePost } from './normalization';
import { generateBridgeNotifications } from './notifications';
import { crossProtocolSearch } from './search';
import { getAdapter } from './transforms/index';
import type {
  BridgeBatchResult,
  BridgeConfig,
  BridgeHealth,
  BridgePath,
  BridgeResult,
  CrossPostRecord,
} from './types';
import { BRIDGE_PATHS, DEFAULT_BRIDGE_CONFIG } from './types';

export type {
  BridgeAdapter,
  BridgeBatchResult,
  BridgeConfig,
  BridgeHealth,
  BridgePath,
  BridgeResult,
  CrossPostRecord,
  NormalizedContent,
  NormalizedMedia,
  NormalizedMention,
  UnifiedNotification,
  UnifiedNotificationFeed,
  CrossProtocolSearchResponse,
  CrossProtocolSearchResult,
  LinkedIdentity,
  LinkedProtocolIdentity,
  CircuitBreakerState,
} from './types';

export { BRIDGE_PATHS, DEFAULT_BRIDGE_CONFIG } from './types';

export { circuitBreaker, healthMonitor } from './circuit-breaker';
export { healthMonitor as healthMonitorInstance } from './health-monitor';
export {
  normalizePost,
  normalizeText,
  extractHashtags,
  extractMentions,
  extractMedia,
  translateHashtag,
  translateHashtagsForProtocol,
} from './normalization';
export {
  linkIdentity,
  unlinkIdentity,
  resolveByIdentity,
  resolveByWallet,
  resolveByHandle,
  resolveMentions,
  getLinkedProtocols,
  getCrossProtocolDisplay,
  hasLinkedProtocol,
} from './identity-linking';
export {
  fetchUnifiedNotifications,
  registerNotificationFetcher,
  generateBridgeNotifications,
} from './notifications';
export {
  crossProtocolSearch as search,
  searchProtocol,
  registerSearchProvider,
  registerSearchProviderFromPosts,
  computeRelevanceScore,
} from './search';
export { registerAdapter, getAdapter, getAllAdapters } from './transforms/index';

// ─── Bridge Engine ───────────────────────────────────────────────────────

export class Bridge {
  private config: BridgeConfig;
  private running = false;
  private pollingTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(config?: Partial<BridgeConfig>) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };

    // Configure circuit breakers for all bridge paths
    for (const path of BRIDGE_PATHS) {
      const pathConfig = this.config.circuitBreakers[path.id];
      circuitBreaker.configure(path.id, pathConfig);
    }
  }

  /**
   * Start the bridge engine.
   * Begins health monitoring and cross-posting loops.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Start health monitoring
    healthMonitor.start(this.config.healthCheckIntervalMs);

    console.log(
      `[cross-protocol-bridge] Started with ${BRIDGE_PATHS.length} bridge paths (${this.getEnabledPathCount()} enabled)`,
    );
  }

  /**
   * Stop the bridge engine.
   */
  stop(): void {
    this.running = false;
    healthMonitor.stop();

    for (const [id, timer] of this.pollingTimers) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();

    console.log('[cross-protocol-bridge] Stopped');
  }

  /**
   * Bridge a single post from source to target protocol.
   *
   * @param post - The unified post to bridge
   * @param targetProtocol - Target protocol to bridge to
   * @returns Bridge result
   */
  async bridgePost(
    post: UnifiedPost,
    targetProtocol: Protocol,
  ): Promise<BridgeResult> {
    const sourceProtocol = post.protocol as Protocol;
    const pathId = `${sourceProtocol}→${targetProtocol}`;

    if (!this.config.enabled) {
      return {
        success: false,
        pathId,
        sourceProtocol,
        targetProtocol,
        latencyMs: 0,
        error: 'Bridge is disabled',
        retryable: false,
      };
    }

    // Check circuit breaker
    if (!circuitBreaker.isAllowed(pathId)) {
      return {
        success: false,
        pathId,
        sourceProtocol,
        targetProtocol,
        latencyMs: 0,
        error: `Circuit breaker open for ${pathId}`,
        retryable: true,
      };
    }

    // Check if this path is enabled
    if (this.config.enabledPaths[pathId] === false) {
      return {
        success: false,
        pathId,
        sourceProtocol,
        targetProtocol,
        latencyMs: 0,
        error: `Bridge path ${pathId} is disabled`,
        retryable: false,
      };
    }

    // Get the bridge adapter
    const adapter = getAdapter(pathId);
    if (!adapter) {
      return {
        success: false,
        pathId,
        sourceProtocol,
        targetProtocol,
        latencyMs: 0,
        error: `No adapter for bridge path: ${pathId}`,
        retryable: false,
      };
    }

    const startTime = Date.now();

    try {
      // 1. Normalize the post
      const normalized = normalizePost(post);

      // 2. Transform to target format
      const transformResult = await adapter.transform(normalized);
      if (!transformResult.success) {
        const latencyMs = Date.now() - startTime;
        healthMonitor.recordFailure(pathId, latencyMs);
        return {
          success: false,
          pathId,
          sourceProtocol,
          targetProtocol,
          latencyMs,
          error: transformResult.error,
          retryable: false,
        };
      }

      // 3. Publish to target protocol
      const publishResult = await adapter.publish(transformResult.payload);
      const latencyMs = Date.now() - startTime;

      if (publishResult.success) {
        healthMonitor.recordSuccess(pathId, latencyMs);
        return {
          success: true,
          pathId,
          sourceProtocol,
          targetProtocol,
          latencyMs,
          targetResult: {
            nativeId: publishResult.nativeId,
            url: publishResult.url,
          },
        };
      }

      healthMonitor.recordFailure(pathId, latencyMs);
      return {
        success: false,
        pathId,
        sourceProtocol,
        targetProtocol,
        latencyMs,
        error: publishResult.error,
        retryable: publishResult.retryable,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      healthMonitor.recordFailure(pathId, latencyMs);
      return {
        success: false,
        pathId,
        sourceProtocol,
        targetProtocol,
        latencyMs,
        error: `Bridge error: ${(err as Error).message}`,
        retryable: true,
      };
    }
  }

  /**
   * Bridge a post to ALL enabled target protocols.
   * Useful for "post once, appear everywhere" functionality.
   *
   * @param post - The unified post to bridge
   * @param includePaths - Optional: only bridge through these path IDs
   * @returns Batch bridge result
   */
  async bridgePostToAll(post: UnifiedPost, includePaths?: string[]): Promise<BridgeBatchResult> {
    const sourceProtocol = post.protocol as Protocol;
    const paths = includePaths
      ? BRIDGE_PATHS.filter(
          (p) => includePaths.includes(p.id) && p.source === sourceProtocol && p.enabled,
        )
      : BRIDGE_PATHS.filter((p) => p.source === sourceProtocol && p.enabled);

    if (paths.length === 0) {
      return { results: [], totalSuccess: 0, totalFailure: 0, totalLatencyMs: 0 };
    }

    const results = await Promise.all(
      paths.map((path) => this.bridgePost(post, path.target)),
    );

    const totalSuccess = results.filter((r) => r.success).length;
    const totalFailure = results.filter((r) => !r.success).length;
    const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

    return { results, totalSuccess, totalFailure, totalLatencyMs };
  }

  /**
   * Bridge a post automatically based on the author's linked identities.
   * If the author has linked accounts on other protocols, the post is
   * bridged to those protocols.
   */
  async autoBridgeForLinkedIdentity(post: UnifiedPost): Promise<BridgeBatchResult> {
    // Find the author's linked identity
    const authorId = post.author.id;
    const identity = resolveByIdentity(post.protocol as Protocol, authorId);

    if (!identity) {
      return { results: [], totalSuccess: 0, totalFailure: 0, totalLatencyMs: 0 };
    }

    // Get protocols to bridge to (all linked protocols except source)
    const targetProtocols = identity.protocols
      .filter((p) => p.protocol !== post.protocol)
      .map((p) => p.protocol);

    if (targetProtocols.length === 0) {
      return { results: [], totalSuccess: 0, totalFailure: 0, totalLatencyMs: 0 };
    }

    const results = await Promise.all(
      targetProtocols.map((protocol) => this.bridgePost(post, protocol)),
    );

    const totalSuccess = results.filter((r) => r.success).length;
    const totalFailure = results.filter((r) => !r.success).length;
    const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

    return { results, totalSuccess, totalFailure, totalLatencyMs };
  }

  /**
   * Get health information for all bridge paths.
   */
  getHealth(): BridgeHealth[] {
    return healthMonitor.getAllHealth();
  }

  /**
   * Get health summary.
   */
  getHealthSummary(): ReturnType<typeof healthMonitor.getSummary> {
    return healthMonitor.getSummary();
  }

  /**
   * Get bridge configuration.
   */
  getConfig(): BridgeConfig {
    return this.config;
  }

  /**
   * Update bridge configuration.
   */
  updateConfig(config: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Update circuit breaker configuration for a specific path.
   */
  configureCircuitBreaker(pathId: string, overrides?: Partial<import('./types').CircuitBreakerConfig>): void {
    circuitBreaker.configure(pathId, overrides);
  }

  /**
   * Reset circuit breaker for a path.
   */
  resetCircuitBreaker(pathId?: string): void {
    circuitBreaker.reset(pathId);
  }

  /**
   * Get circuit breaker state.
   */
  getCircuitBreakerState(pathId: string): import('./types').CircuitBreakerState | undefined {
    return circuitBreaker.getState(pathId);
  }

  private getEnabledPathCount(): number {
    return BRIDGE_PATHS.filter((p) => {
      if (this.config.enabledPaths[p.id] === false) return false;
      return p.enabled;
    }).length;
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────

let defaultBridge: Bridge | null = null;

/**
 * Get or create the default bridge instance.
 */
export function getDefaultBridge(config?: Partial<BridgeConfig>): Bridge {
  if (!defaultBridge) {
    defaultBridge = new Bridge(config);
  }
  return defaultBridge;
}

/**
 * Reset the default bridge instance.
 */
export function resetDefaultBridge(): void {
  if (defaultBridge) {
    defaultBridge.stop();
    defaultBridge = null;
  }
}
