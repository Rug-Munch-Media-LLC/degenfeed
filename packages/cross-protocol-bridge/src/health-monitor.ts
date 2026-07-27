/**
 * @degenfeed/cross-protocol-bridge — Health Monitor
 *
 * Monitors bridge health across all paths.
 * Runs periodic health checks and exposes bridge status.
 */

import { circuitBreaker } from './circuit-breaker';
import { getAdapter } from './transforms/index';
import type { BridgeHealth, BridgePath } from './types';
import { BRIDGE_PATHS } from './types';

interface HealthRecord {
  pathId: string;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  requestCount: number;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  lastCheckedAt: number;
  startedAt: number;
}

export class HealthMonitor {
  private records = new Map<string, HealthRecord>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(health: BridgeHealth[]) => void> = [];

  /**
   * Start the health monitoring loop.
   */
  start(intervalMs: number = 30_000): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.runChecks(), intervalMs);
    // Run initial check immediately
    this.runChecks();
  }

  /**
   * Stop the health monitoring loop.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Register a listener for health changes.
   */
  onHealthChange(listener: (health: BridgeHealth[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Record a successful bridge operation.
   */
  recordSuccess(pathId: string, latencyMs: number): void {
    const record = this.getOrCreateRecord(pathId);
    record.successCount++;
    record.requestCount++;
    record.totalLatencyMs += latencyMs;
    record.lastSuccessAt = Date.now();
    record.lastCheckedAt = Date.now();
    circuitBreaker.recordSuccess(pathId);
  }

  /**
   * Record a failed bridge operation.
   */
  recordFailure(pathId: string, latencyMs: number): void {
    const record = this.getOrCreateRecord(pathId);
    record.failureCount++;
    record.requestCount++;
    record.totalLatencyMs += latencyMs;
    record.lastErrorAt = Date.now();
    record.lastCheckedAt = Date.now();
    circuitBreaker.recordFailure(pathId);
  }

  /**
   * Get health for all bridge paths.
   */
  getAllHealth(): BridgeHealth[] {
    return BRIDGE_PATHS.map((path) => this.getHealth(path));
  }

  /**
   * Get health for a specific bridge path.
   */
  getHealth(path: BridgePath): BridgeHealth {
    const record = this.records.get(path.id) ?? this.getOrCreateRecord(path.id);
    const cbState = circuitBreaker.getState(path.id);
    const total = record.successCount + record.failureCount;

    return {
      pathId: path.id,
      healthy:
        cbState?.state === 'closed' && total > 0 ? record.successCount / total > 0.5 : path.enabled,
      state: cbState?.state ?? 'closed',
      uptimeMs: Date.now() - record.startedAt,
      lastCheckedAt: record.lastCheckedAt,
      lastSuccessAt: record.lastSuccessAt,
      lastErrorAt: record.lastErrorAt,
      successRate: total > 0 ? record.successCount / total : 1,
      totalRequests: total,
      totalSuccesses: record.successCount,
      totalFailures: record.failureCount,
      avgLatencyMs:
        record.requestCount > 0 ? Math.round(record.totalLatencyMs / record.requestCount) : 0,
    };
  }

  /**
   * Get aggregated health summary.
   */
  getSummary(): {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    overallHealth: 'healthy' | 'degraded' | 'down';
  } {
    const all = this.getAllHealth();
    const healthy = all.filter((h) => h.healthy && h.state === 'closed').length;
    const degraded = all.filter((h) => !h.healthy || h.state === 'half-open').length;
    const down = all.filter((h) => h.state === 'open').length;

    let overallHealth: 'healthy' | 'degraded' | 'down';
    if (down > 0) overallHealth = 'down';
    else if (degraded > 0) overallHealth = 'degraded';
    else overallHealth = 'healthy';

    return { total: all.length, healthy, degraded, down, overallHealth };
  }

  private async runChecks(): Promise<void> {
    await Promise.allSettled(
      BRIDGE_PATHS.map(async (path) => {
        if (!path.enabled) return;
        try {
          const adapter = getAdapter(path.id);
          if (!adapter) return;

          const healthy = await adapter.healthCheck();
          const record = this.getOrCreateRecord(path.id);
          record.lastCheckedAt = Date.now();

          if (healthy) {
            record.successCount++;
            circuitBreaker.recordSuccess(path.id);
          } else {
            record.failureCount++;
            circuitBreaker.recordFailure(path.id);
          }
        } catch {
          const record = this.getOrCreateRecord(path.id);
          record.failureCount++;
          record.lastErrorAt = Date.now();
          circuitBreaker.recordFailure(path.id);
        }
      }),
    );

    // Notify listeners
    const health = this.getAllHealth();
    for (const listener of this.listeners) {
      try {
        listener(health);
      } catch {
        /* ignore */
      }
    }
  }

  private getOrCreateRecord(pathId: string): HealthRecord {
    let record = this.records.get(pathId);
    if (!record) {
      record = {
        pathId,
        successCount: 0,
        failureCount: 0,
        totalLatencyMs: 0,
        requestCount: 0,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastCheckedAt: Date.now(),
        startedAt: Date.now(),
      };
      this.records.set(pathId, record);
    }
    return record;
  }
}

/** Singleton instance */
export const healthMonitor = new HealthMonitor();
