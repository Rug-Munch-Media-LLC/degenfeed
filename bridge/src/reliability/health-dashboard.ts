/**
 * Health Dashboard — Tracks provider fetch metrics.
 * Records success/failure counts, latency, and last fetch times.
 */

interface ProviderHealth {
  protocol: string;
  totalFetches: number;
  successfulFetches: number;
  failedFetches: number;
  lastFetchAt: number | null;
  lastSuccessAt: number | null;
  lastErrorAt: number | null;
  avgLatencyMs: number;
}

class HealthDashboard {
  private providers = new Map<string, ProviderHealth>();
  private latencies = new Map<string, number[]>();

  recordFetch(protocol: string): void {
    let health = this.providers.get(protocol);
    if (!health) {
      health = {
        protocol,
        totalFetches: 0,
        successfulFetches: 0,
        failedFetches: 0,
        lastFetchAt: null,
        lastSuccessAt: null,
        lastErrorAt: null,
        avgLatencyMs: 0,
      };
      this.providers.set(protocol, health);
    }
    health.totalFetches++;
    health.lastFetchAt = Date.now();
  }

  recordSuccess(protocol: string, latencyMs: number): void {
    const health = this.providers.get(protocol);
    if (health) {
      health.successfulFetches++;
      health.lastSuccessAt = Date.now();

      if (!this.latencies.has(protocol)) {
        this.latencies.set(protocol, []);
      }
      const lats = this.latencies.get(protocol)!;
      lats.push(latencyMs);
      if (lats.length > 100) lats.shift();
      health.avgLatencyMs = Math.round(lats.reduce((a, b) => a + b, 0) / lats.length);
    }
  }

  recordFailure(protocol: string, _latencyMs: number): void {
    const health = this.providers.get(protocol);
    if (health) {
      health.failedFetches++;
      health.lastErrorAt = Date.now();
    }
  }

  getProviderHealth(protocol: string): ProviderHealth | undefined {
    return this.providers.get(protocol);
  }

  getAllHealth(): ProviderHealth[] {
    return Array.from(this.providers.values());
  }
}

export const healthDashboard = new HealthDashboard();
