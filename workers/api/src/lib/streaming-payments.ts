/**
 * @degenfeed/api-worker — Streaming Payments Service (TASK 2)
 *
 * Continuous payment streams for DAO contributors (Superfluid-style).
 * Manages creation, modification, cancellation, and analytics of
 * token streams that pay recipients per second.
 *
 * All state persisted in KV under `stream:{daoId}:{streamId}` namespace.
 *
 * ## Integration
 * Can be paired with on-chain streaming protocols (Superfluid, Sablier)
 * or used as an off-chain accounting layer for manual disbursement.
 */

import type { Address } from 'viem';
import type { Env } from '../types';
import { log } from '../logger';
import { streamAnalyticsKey, streamEventKey, streamIndexKey, streamKey } from '../kv-key-patterns';

// ─── Constants ────────────────────────────────────────────────────────────

const DEFAULT_TTL = 365 * 86400; // 1 year
const _SECONDS_IN_DAY = 86400;
const SECONDS_IN_MONTH = 2_592_000; // 30 days
const SECONDS_IN_YEAR = 31_536_000;

// ─── Types ────────────────────────────────────────────────────────────────

export interface StreamConfig {
  id: string;
  daoId: string;
  /** Recipient wallet address */
  recipient: Address;
  /** Token address (zero address = native ETH/SOL) */
  tokenAddress: Address;
  /** Token symbol for display */
  tokenSymbol: string;
  /** Token decimals */
  tokenDecimals: number;
  /** Flow rate in smallest token units per second */
  flowRate: string;
  /** Optional end date (timestamp). null = indefinite */
  endAt: number | null;
  /** Optional start delay (for scheduled streams) */
  startAt: number;
  /** Human-readable label (e.g. "Monthly contributor payment") */
  label: string;
  /** Stream category (payroll, grant, reward, other) */
  category: 'payroll' | 'grant' | 'reward' | 'other';
  /** Active or paused */
  paused: boolean;
  /** Total amount streamed so far (in smallest units) */
  totalStreamed: string;
  /** Timestamp of last cumulative calculation */
  lastCalculatedAt: number;
  /** When the stream was created */
  createdAt: number;
  /** Who created the stream */
  createdBy: Address;
  /** Link to related entity (grant ID, proposal ID, etc.) */
  referenceId?: string;
  /** Metadata for display */
  metadata?: Record<string, string>;
}

export interface StreamEvent {
  id: string;
  streamId: string;
  daoId: string;
  type: 'payment' | 'modification' | 'pause' | 'resume' | 'cancellation';
  /** Amount involved (for payment events) */
  amount?: string;
  /** USD equivalent at time of event */
  usdValue?: number;
  /** Flow rate before change (for modifications) */
  previousFlowRate?: string;
  /** New flow rate (for modifications) */
  newFlowRate?: string;
  /** Transaction hash if on-chain */
  txHash?: string;
  /** Description of the event */
  description: string;
  timestamp: number;
  triggeredBy: Address;
}

export interface StreamAnalytics {
  daoId: string;
  /** Total active streams */
  activeStreams: number;
  /** Total paused streams */
  pausedStreams: number;
  /** Total streams ever created */
  totalStreams: number;
  /** Amount streamed this month */
  streamedThisMonth: string;
  /** Amount streamed all-time */
  streamedAllTime: string;
  /** Top recipients by total received */
  topRecipients: Array<{
    recipient: Address;
    totalStreamed: string;
    label: string;
  }>;
  /** Stream vs one-time payment ratio (0-1, 1 = all streaming) */
  streamRatio: number;
  /** Projected annual spend based on current flow rates */
  projectedAnnualSpend: string;
  /** Monthly trend (last 6 months) */
  monthlyTrend: Array<{
    month: string;
    streamed: string;
  }>;
  lastUpdated: number;
}

export interface CreateStreamInput {
  recipient: Address;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  /** Flow rate in tokens per second (in smallest units) */
  flowRate: string;
  /** Duration in seconds (optional, if limited) */
  duration?: number;
  /** Label for the stream */
  label: string;
  category: 'payroll' | 'grant' | 'reward' | 'other';
  createdBy: Address;
  referenceId?: string;
  metadata?: Record<string, string>;
}

export interface StreamFilter {
  status?: 'active' | 'paused' | 'ended';
  category?: string;
  recipient?: Address;
  limit?: number;
  offset?: number;
}

// ─── Service ──────────────────────────────────────────────────────────────

export class StreamingPaymentsService {
  private kv: KVNamespace;

  constructor(env: Env) {
    this.env = env;
    this.kv = env.TREASURY as unknown as KVNamespace;
  }

  // ─── Create Stream ────────────────────────────────────────────────

  /**
   * Create a new payment stream.
   * Computes start time (now), end time (if duration given), and stores.
   */
  async createStream(daoId: string, input: CreateStreamInput): Promise<StreamConfig> {
    this.#validateFlowRate(input.flowRate, input.tokenDecimals);

    const id = crypto.randomUUID();
    const now = Date.now();
    const endAt = input.duration ? now + input.duration * 1000 : null;

    // Validate flow rate is positive
    const flowRateBig = BigInt(input.flowRate);
    if (flowRateBig <= 0n) {
      throw new Error('Flow rate must be greater than 0');
    }

    const stream: StreamConfig = {
      id,
      daoId,
      recipient: input.recipient,
      tokenAddress: input.tokenAddress,
      tokenSymbol: input.tokenSymbol,
      tokenDecimals: input.tokenDecimals,
      flowRate: input.flowRate,
      endAt,
      startAt: now,
      label: input.label,
      category: input.category,
      paused: false,
      totalStreamed: '0',
      lastCalculatedAt: now,
      createdAt: now,
      createdBy: input.createdBy,
      referenceId: input.referenceId,
      metadata: input.metadata,
    };

    await this.kv.put(streamKey(daoId, id), JSON.stringify(stream), { expirationTtl: DEFAULT_TTL });

    await this.#addToIndex(daoId, id);

    await this.#recordEvent(daoId, id, {
      type: 'payment',
      description: `Stream created: ${input.label}`,
      amount: '0',
      timestamp: now,
      triggeredBy: input.createdBy,
    });

    log('info', '[stream] Stream created', {
      daoId,
      streamId: id,
      recipient: input.recipient.slice(0, 10),
      flowRate: input.flowRate,
      category: input.category,
    });

    return stream;
  }

  // ─── Get Stream ───────────────────────────────────────────────────

  /**
   * Get stream details with computed total streamed amount.
   */
  async getStream(
    daoId: string,
    streamId: string,
  ): Promise<{ stream: StreamConfig; streamed: string }> {
    const stream = await this.#getStreamConfig(daoId, streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    const streamed = this.#computeTotalStreamed(stream);
    return { stream, streamed };
  }

  // ─── List Streams ─────────────────────────────────────────────────

  /**
   * List all streams for a DAO with optional filters.
   */
  async listStreams(
    daoId: string,
    filter?: StreamFilter,
  ): Promise<{ streams: StreamConfig[]; total: number }> {
    const index = await this.#getIndex(daoId);
    const limited = filter?.offset ? index.slice(filter.offset) : index;

    const slice = filter?.limit ? limited.slice(0, filter.limit) : limited.slice(0, 50);

    const streams: StreamConfig[] = [];

    for (const id of slice) {
      const stream = await this.#getStreamConfig(daoId, id);
      if (stream && this.#matchesFilter(stream, filter)) {
        streams.push(stream);
      }
    }

    return {
      streams: streams.sort((a, b) => b.createdAt - a.createdAt),
      total: index.length,
    };
  }

  // ─── Modify Stream ────────────────────────────────────────────────

  /**
   * Modify a stream's flow rate. Pauses and resumes are separate.
   */
  async modifyStream(
    daoId: string,
    streamId: string,
    updates: {
      flowRate?: string;
      label?: string;
      endAt?: number | null;
      metadata?: Record<string, string>;
    },
    modifiedBy: Address,
  ): Promise<StreamConfig> {
    const stream = await this.#getStreamConfig(daoId, streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    const previousFlowRate = stream.flowRate;

    // Settle accumulated amount before modification
    const currentStreamed = this.#computeTotalStreamed(stream);
    stream.totalStreamed = currentStreamed;
    stream.lastCalculatedAt = Date.now();

    // Apply updates
    if (updates.flowRate !== undefined) {
      this.#validateFlowRate(updates.flowRate, stream.tokenDecimals);
      stream.flowRate = updates.flowRate;
    }
    if (updates.label !== undefined) {
      stream.label = updates.label;
    }
    if (updates.endAt !== undefined) {
      stream.endAt = updates.endAt;
    }
    if (updates.metadata !== undefined) {
      stream.metadata = { ...stream.metadata, ...updates.metadata };
    }

    await this.kv.put(streamKey(daoId, streamId), JSON.stringify(stream), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#recordEvent(daoId, streamId, {
      type: 'modification',
      description: `Flow rate modified: ${previousFlowRate} → ${stream.flowRate}`,
      previousFlowRate,
      newFlowRate: stream.flowRate,
      timestamp: Date.now(),
      triggeredBy: modifiedBy,
    });

    log('info', '[stream] Stream modified', {
      daoId,
      streamId,
      flowRate: stream.flowRate,
      modifiedBy: modifiedBy.slice(0, 10),
    });

    return stream;
  }

  // ─── Cancel Stream ────────────────────────────────────────────────

  /**
   * Cancel a stream, settling the final amount.
   */
  async cancelStream(
    daoId: string,
    streamId: string,
    cancelledBy: Address,
  ): Promise<{ stream: StreamConfig; finalAmount: string }> {
    const stream = await this.#getStreamConfig(daoId, streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    // Settle final accumulated amount
    const finalAmount = this.#computeTotalStreamed(stream);

    await this.#recordEvent(daoId, streamId, {
      type: 'cancellation',
      description: `Stream cancelled. Total streamed: ${finalAmount}`,
      amount: finalAmount,
      timestamp: Date.now(),
      triggeredBy: cancelledBy,
    });

    // Remove from active index
    await this.#removeFromIndex(daoId, streamId);

    log('info', '[stream] Stream cancelled', {
      daoId,
      streamId,
      finalAmount,
      cancelledBy: cancelledBy.slice(0, 10),
    });

    return { stream, finalAmount };
  }

  // ─── Pause / Resume ───────────────────────────────────────────────

  /**
   * Pause a stream (settles accumulated amount, stops accrual).
   */
  async pauseStream(daoId: string, streamId: string, pausedBy: Address): Promise<StreamConfig> {
    const stream = await this.#getStreamConfig(daoId, streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    if (stream.paused) {
      throw new Error('Stream is already paused');
    }

    // Settle before pausing
    stream.totalStreamed = this.#computeTotalStreamed(stream);
    stream.lastCalculatedAt = Date.now();
    stream.paused = true;

    await this.kv.put(streamKey(daoId, streamId), JSON.stringify(stream), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#recordEvent(daoId, streamId, {
      type: 'pause',
      description: 'Stream paused',
      timestamp: Date.now(),
      triggeredBy: pausedBy,
    });

    return stream;
  }

  /**
   * Resume a paused stream.
   */
  async resumeStream(daoId: string, streamId: string, resumedBy: Address): Promise<StreamConfig> {
    const stream = await this.#getStreamConfig(daoId, streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    if (!stream.paused) {
      throw new Error('Stream is not paused');
    }

    stream.paused = false;
    stream.lastCalculatedAt = Date.now();

    await this.kv.put(streamKey(daoId, streamId), JSON.stringify(stream), {
      expirationTtl: DEFAULT_TTL,
    });

    await this.#recordEvent(daoId, streamId, {
      type: 'resume',
      description: 'Stream resumed',
      timestamp: Date.now(),
      triggeredBy: resumedBy,
    });

    return stream;
  }

  // ─── Stream History ───────────────────────────────────────────────

  /**
   * Get event history for a stream.
   */
  async getStreamHistory(
    daoId: string,
    streamId: string,
    limit: number = 50,
  ): Promise<StreamEvent[]> {
    const prefix = streamEventKey(daoId, streamId, '');
    const keys: string[] = [];

    // List keys by prefix (requires KV list support)
    try {
      const listed = await this.kv.list({ prefix });
      for (const key of listed.keys) {
        keys.push(key.name);
      }
    } catch {
      return [];
    }

    // Sort keys (newest first by convention: keys include timestamp)
    keys.sort().reverse();

    const events: StreamEvent[] = [];
    for (const key of keys.slice(0, limit)) {
      try {
        const raw = await this.kv.get(key);
        if (raw) {
          events.push(JSON.parse(raw) as StreamEvent);
        }
      } catch {
        // Skip corrupt entries
      }
    }

    return events;
  }

  // ─── Stream Analytics ─────────────────────────────────────────────

  /**
   * Compute full analytics for a DAO's streaming activity.
   */
  async getAnalytics(daoId: string): Promise<StreamAnalytics> {
    const allStreams = await this.listStreams(daoId, { limit: 200 });
    const active = allStreams.streams.filter((s) => !s.paused);
    const paused = allStreams.streams.filter((s) => s.paused);

    // Compute totals
    let streamedAllTimeWei = 0n;
    let streamedThisMonthWei = 0n;
    const recipientTotals = new Map<string, { total: bigint; label: string }>();

    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartTs = monthStart.getTime();

    for (const stream of allStreams.streams) {
      const total = BigInt(stream.totalStreamed) + BigInt(this.#computeAccruedSinceLast(stream));
      streamedAllTimeWei += total;

      if (stream.createdAt >= monthStartTs) {
        streamedThisMonthWei += total;
      } else if (!stream.paused && (!stream.endAt || stream.endAt > monthStartTs)) {
        // Partial month contribution
        const streamStart = Math.max(stream.createdAt, monthStartTs);
        const relevantDuration = Math.max(0, now - streamStart);
        const flowPerMs = Number(BigInt(stream.flowRate)) / 1000;
        const monthStreamed = BigInt(Math.floor(flowPerMs * relevantDuration));
        streamedThisMonthWei += monthStreamed;
      }

      // Aggregate recipient totals
      const existing = recipientTotals.get(stream.recipient.toLowerCase()) || {
        total: 0n,
        label: stream.label,
      };
      existing.total += total;
      recipientTotals.set(stream.recipient.toLowerCase(), existing);
    }

    // Top recipients
    const topRecipients = Array.from(recipientTotals.entries())
      .map(([addr, data]) => ({
        recipient: addr as Address,
        totalStreamed: data.total.toString(),
        label: data.label,
      }))
      .sort((a, b) => Number(BigInt(b.totalStreamed) - BigInt(a.totalStreamed)))
      .slice(0, 10);

    // Projected annual spend
    const flowPerSecond = allStreams.streams
      .filter((s) => !s.paused)
      .reduce((sum, s) => sum + Number(BigInt(s.flowRate)), 0);
    const projectedAnnualSpend = BigInt(Math.floor(flowPerSecond * SECONDS_IN_YEAR)).toString();

    // Monthly trend
    const monthlyTrend = this.#computeMonthlyTrend(allStreams.streams);

    const analytics: StreamAnalytics = {
      daoId,
      activeStreams: active.length,
      pausedStreams: paused.length,
      totalStreams: allStreams.total,
      streamedThisMonth: streamedThisMonthWei.toString(),
      streamedAllTime: streamedAllTimeWei.toString(),
      topRecipients,
      streamRatio: allStreams.total > 0 ? active.length / allStreams.total : 0,
      projectedAnnualSpend,
      monthlyTrend,
      lastUpdated: now,
    };

    // Cache analytics
    await this.kv.put(
      streamAnalyticsKey(daoId),
      JSON.stringify(analytics),
      { expirationTtl: 3600 }, // 1 hour cache
    );

    return analytics;
  }

  // ─── Payroll Integration ──────────────────────────────────────────

  /**
   * Create recurring payroll streams for multiple contributors.
   * Each contributor gets a stream at the specified flow rate.
   */
  async createPayrollStreams(
    daoId: string,
    payrollEntries: Array<{
      recipient: Address;
      monthlyAmount: string; // Amount per month in smallest units
      tokenAddress: Address;
      tokenSymbol: string;
      tokenDecimals: number;
      label: string;
    }>,
    createdBy: Address,
  ): Promise<StreamConfig[]> {
    const streams: StreamConfig[] = [];

    for (const entry of payrollEntries) {
      // Convert monthly amount to per-second flow rate
      const monthlyWei = BigInt(entry.monthlyAmount);
      const flowRate = (monthlyWei / BigInt(SECONDS_IN_MONTH)).toString();

      const stream = await this.createStream(daoId, {
        recipient: entry.recipient,
        tokenAddress: entry.tokenAddress,
        tokenSymbol: entry.tokenSymbol,
        tokenDecimals: entry.tokenDecimals,
        flowRate,
        label: entry.label,
        category: 'payroll',
        createdBy,
      });

      streams.push(stream);
    }

    log('info', '[stream] Payroll streams created', {
      daoId,
      count: payrollEntries.length,
      createdBy: createdBy.slice(0, 10),
    });

    return streams;
  }

  /**
   * Update contributor flow rates based on activity signals.
   * Higher activity = higher flow rate (multiplier 0.5x – 2x).
   */
  async adjustContributorFlowRate(
    daoId: string,
    streamId: string,
    activityMultiplier: number, // 0.5 to 2.0
    adjustedBy: Address,
  ): Promise<StreamConfig> {
    if (activityMultiplier < 0.5 || activityMultiplier > 2.0) {
      throw new Error('Activity multiplier must be between 0.5 and 2.0');
    }

    const stream = await this.#getStreamConfig(daoId, streamId);
    if (!stream) {
      throw new Error(`Stream not found: ${streamId}`);
    }

    const baseFlowRate = BigInt(stream.flowRate);
    const scaledFlowRate = BigInt(Math.floor(Number(baseFlowRate) * activityMultiplier));

    return this.modifyStream(daoId, streamId, { flowRate: scaledFlowRate.toString() }, adjustedBy);
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  async #getStreamConfig(daoId: string, streamId: string): Promise<StreamConfig | null> {
    try {
      const raw = await this.kv.get(streamKey(daoId, streamId));
      return raw ? (JSON.parse(raw) as StreamConfig) : null;
    } catch {
      return null;
    }
  }

  /**
   * Compute total streamed amount as of now.
   * Includes previously settled total + accrued since last calculation.
   */
  #computeTotalStreamed(stream: StreamConfig): string {
    const settled = BigInt(stream.totalStreamed);
    const accrued = this.#computeAccruedSinceLast(stream);
    return (settled + accrued).toString();
  }

  /**
   * Compute accrued amount since last calculation, respecting
   * pause state and end date.
   */
  #computeAccruedSinceLast(stream: StreamConfig): bigint {
    if (stream.paused) return 0n;

    const now = Date.now();
    const effectiveEnd = stream.endAt ? Math.min(stream.endAt, now) : now;
    const elapsed = Math.max(0, effectiveEnd - stream.lastCalculatedAt);

    // Flow rate is per second, so convert ms to seconds
    const elapsedSeconds = Math.floor(elapsed / 1000);
    const rate = BigInt(stream.flowRate);

    return rate * BigInt(elapsedSeconds);
  }

  /**
   * Validate that a flow rate is reasonable (not absurdly high).
   */
  #validateFlowRate(flowRate: string, decimals: number): void {
    try {
      const rate = BigInt(flowRate);
      if (rate < 0n) {
        throw new Error('Flow rate cannot be negative');
      }

      // Rate per second sanity check: max 1M tokens per second
      const maxRate = BigInt(1_000_000) * BigInt(10 ** decimals);
      if (rate > maxRate) {
        throw new Error('Flow rate exceeds maximum allowed (1M tokens/sec)');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Flow rate')) {
        throw err;
      }
      throw new Error('Invalid flow rate format');
    }
  }

  async #addToIndex(daoId: string, streamId: string): Promise<void> {
    const key = streamIndexKey(daoId);
    const existing = await this.kv.get(key);
    const index: string[] = existing ? (JSON.parse(existing) as string[]) : [];
    index.unshift(streamId);
    await this.kv.put(key, JSON.stringify(index), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #removeFromIndex(daoId: string, streamId: string): Promise<void> {
    const key = streamIndexKey(daoId);
    const existing = await this.kv.get(key);
    if (!existing) return;
    const index: string[] = JSON.parse(existing) as string[];
    const filtered = index.filter((id) => id !== streamId);
    await this.kv.put(key, JSON.stringify(filtered), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  async #getIndex(daoId: string): Promise<string[]> {
    try {
      const raw = await this.kv.get(streamIndexKey(daoId));
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  async #recordEvent(
    daoId: string,
    streamId: string,
    event: {
      type: StreamEvent['type'];
      description: string;
      amount?: string;
      previousFlowRate?: string;
      newFlowRate?: string;
      timestamp: number;
      triggeredBy: Address;
    },
  ): Promise<void> {
    const id = crypto.randomUUID();
    const eventRecord: StreamEvent = {
      id,
      streamId,
      daoId,
      ...event,
    };

    const eventKey = streamEventKey(daoId, streamId, `${event.timestamp}-${id}`);
    await this.kv.put(eventKey, JSON.stringify(eventRecord), {
      expirationTtl: DEFAULT_TTL,
    });
  }

  #matchesFilter(stream: StreamConfig, filter?: StreamFilter): boolean {
    if (!filter) return true;

    if (filter.status === 'active' && stream.paused) return false;
    if (filter.status === 'paused' && !stream.paused) return false;
    if (filter.status === 'ended' && !stream.endAt) return false;

    if (filter.category && stream.category !== filter.category) return false;
    if (filter.recipient && stream.recipient.toLowerCase() !== filter.recipient.toLowerCase()) {
      return false;
    }

    return true;
  }

  /**
   * Compute monthly streaming trend for last 6 months.
   */
  #computeMonthlyTrend(streams: StreamConfig[]): Array<{ month: string; streamed: string }> {
    const now = Date.now();
    const months: Array<{ month: string; streamed: string }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const monthLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      let total = 0n;

      for (const stream of streams) {
        if (stream.createdAt > monthEnd) continue;

        const streamStart = Math.max(stream.createdAt, monthStart);
        const streamEnd = Math.min(stream.endAt || now, monthEnd);

        if (streamEnd > streamStart && !stream.paused) {
          const durationMs = streamEnd - streamStart;
          const flowPerMs = Number(BigInt(stream.flowRate)) / 1000;
          total += BigInt(Math.floor(flowPerMs * durationMs));
        }
      }

      months.push({ month: monthLabel, streamed: total.toString() });
    }

    return months;
  }
}

// ─── Standalone helpers ───────────────────────────────────────────────────

/**
 * Format a flow rate (tokens/sec) to a human-readable monthly amount.
 */
export function flowRateToMonthly(flowRate: string, decimals: number, tokenSymbol: string): string {
  const ratePerSec = Number(flowRate) / 10 ** decimals;
  const monthly = ratePerSec * SECONDS_IN_MONTH;

  if (monthly >= 1_000_000) return `${(monthly / 1_000_000).toFixed(2)}M ${tokenSymbol}/mo`;
  if (monthly >= 1_000) return `${(monthly / 1_000).toFixed(2)}K ${tokenSymbol}/mo`;
  return `${monthly.toFixed(4)} ${tokenSymbol}/mo`;
}

/**
 * Format a flow rate as tokens per second for display.
 */
export function formatFlowRate(flowRate: string, decimals: number): string {
  const rate = Number(flowRate) / 10 ** decimals;
  if (rate >= 1) return `${rate.toFixed(4)}/sec`;
  if (rate >= 0.001) return `${(rate * 1000).toFixed(2)} millisecond`;
  return `${(rate * 1_000_000).toFixed(2)} micro/sec`;
}

/**
 * Calculate the end time for a duration-limited stream, returns
 * milliseconds remaining or null for indefinite.
 */
export function getStreamTimeRemaining(stream: StreamConfig): number | null {
  if (!stream.endAt) return null;
  if (stream.paused) return stream.endAt - stream.lastCalculatedAt;
  return Math.max(0, stream.endAt - Date.now());
}
