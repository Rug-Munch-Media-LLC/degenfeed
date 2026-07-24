/**
 * @degenfeed/cross-protocol-bridge — Unified Cross-Protocol Bridge
 *
 * THE single bridge for ALL protocol translations.
 */

import type { Protocol, UnifiedPost } from '@degenfeed/types';
import { circuitBreaker } from './circuit-breaker';
import { healthMonitor } from './health-monitor';
import { resolveByIdentity } from './identity-linking';
import { normalizePost } from './normalization';
import { getAdapter } from './transforms/index';
import type { BridgeBatchResult, BridgeConfig, BridgeHealth, BridgeResult } from './types';
import { BRIDGE_PATHS, DEFAULT_BRIDGE_CONFIG } from './types';

export { circuitBreaker } from './circuit-breaker';
export { healthMonitor } from './health-monitor';
export {
  getCrossProtocolDisplay,
  getLinkedProtocols,
  hasLinkedProtocol,
  linkIdentity,
  resolveByHandle,
  resolveByIdentity,
  resolveByWallet,
  resolveMentions,
  unlinkIdentity,
} from './identity-linking';
export {
  extractHashtags,
  extractMedia,
  extractMentions,
  normalizePost,
  normalizeText,
  translateHashtag,
  translateHashtagsForProtocol,
} from './normalization';
export {
  fetchUnifiedNotifications,
  generateBridgeNotifications,
  registerNotificationFetcher,
} from './notifications';
export {
  computeRelevanceScore,
  crossProtocolSearch as search,
  registerSearchProvider,
  registerSearchProviderFromPosts,
  searchProtocol,
} from './search';
export { getAdapter, getAllAdapters, registerAdapter } from './transforms/index';
export type {
  BridgeAdapter,
  BridgeBatchResult,
  BridgeConfig,
  BridgeHealth,
  BridgePath,
  BridgeResult,
  CircuitBreakerState,
  CrossPostRecord,
  CrossProtocolSearchResponse,
  CrossProtocolSearchResult,
  LinkedIdentity,
  LinkedProtocolIdentity,
  NormalizedContent,
  NormalizedMedia,
  NormalizedMention,
  UnifiedNotification,
  UnifiedNotificationFeed,
} from './types';
export { BRIDGE_PATHS, DEFAULT_BRIDGE_CONFIG } from './types';

// ─── Bridge Engine ───────────────────────────────────────────────────────

export class Bridge {
  private config: BridgeConfig;
  private running = false;
  private pollingTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  constructor(config?: Partial<BridgeConfig>) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    for (const path of BRIDGE_PATHS) {
      const pathConfig = this.config.circuitBreakers[path.id];
      circuitBreaker.configure(path.id, pathConfig);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    healthMonitor.start(this.config.healthCheckIntervalMs);
    console.log(
      `[cross-protocol-bridge] Started with ${BRIDGE_PATHS.length} bridge paths (${this.getEnabledPathCount()} enabled)`,
    );
  }

  stop(): void {
    this.running = false;
    healthMonitor.stop();
    for (const [_id, timer] of this.pollingTimers) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();
    console.log('[cross-protocol-bridge] Stopped');
  }

  async bridgePost(post: UnifiedPost, targetProtocol: Protocol): Promise<BridgeResult> {
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
      const normalized = normalizePost(post);
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
          error: transformResult.error ?? 'Transform failed',
          retryable: false,
        };
      }

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
          retryable: false,
          targetResult: { nativeId: publishResult.nativeId, url: publishResult.url },
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

    const results = await Promise.all(paths.map((path) => this.bridgePost(post, path.target)));
    const totalSuccess = results.filter((r) => r.success).length;
    const totalFailure = results.filter((r) => !r.success).length;
    const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

    return { results, totalSuccess, totalFailure, totalLatencyMs };
  }

  async autoBridgeForLinkedIdentity(post: UnifiedPost): Promise<BridgeBatchResult> {
    const authorId = post.author.id;
    const identity = resolveByIdentity(post.protocol as Protocol, authorId);

    if (!identity) {
      return { results: [], totalSuccess: 0, totalFailure: 0, totalLatencyMs: 0 };
    }

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

  getHealth(): BridgeHealth[] {
    return healthMonitor.getAllHealth();
  }

  getHealthSummary(): ReturnType<typeof healthMonitor.getSummary> {
    return healthMonitor.getSummary();
  }

  getConfig(): BridgeConfig {
    return this.config;
  }

  updateConfig(config: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  configureCircuitBreaker(
    pathId: string,
    overrides?: Partial<import('./types').CircuitBreakerConfig>,
  ): void {
    circuitBreaker.configure(pathId, overrides);
  }

  resetCircuitBreaker(pathId?: string): void {
    circuitBreaker.reset(pathId);
  }

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

let defaultBridge: Bridge | null = null;

export function getDefaultBridge(config?: Partial<BridgeConfig>): Bridge {
  if (!defaultBridge) {
    defaultBridge = new Bridge(config);
  }
  return defaultBridge;
}

export function resetDefaultBridge(): void {
  if (defaultBridge) {
    defaultBridge.stop();
    defaultBridge = null;
  }
}
