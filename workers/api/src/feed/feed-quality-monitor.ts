/**
 * @degenfeed/api-worker — Feed Quality Monitoring
 *
 * Monitors per-protocol content flow and alerts when feeds go empty.
 *
 * Tracks:
 *   1. Per-protocol content count (last N fetch cycles)
 *   2. Empty feed alerts (any protocol with 0 posts for >1 hour)
 *   3. Provider health integration into feed quality scoring
 *
 * Alerts are written to KV for observability dashboards and the
 * /api/bridge/health endpoint.
 */

import type { Env } from '../index';

// ─── Constants ──────────────────────────────────────────────────────────

const FEED_MONITOR_PREFIX = 'feed:monitor:v1:';
const EMPTY_FEED_ALERT_PREFIX = 'feed:alert:v1:';
const PROTOCOL_COUNT_PREFIX = 'feed:counts:v1:';
const ALERT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const MAX_COUNT_HISTORY = 24; // keep last 24 samples

// ─── Types ──────────────────────────────────────────────────────────────

export interface ProtocolCountSample {
  protocol: string;
  postCount: number;
  sourceCount: number;
  fetchedAt: number;
}

export interface EmptyFeedAlert {
  protocol: string;
  detectedAt: number;
  emptySince: number;
  consecutiveEmptyFetches: number;
  lastContentAt: number | null;
  severity: 'warning' | 'critical';
  resolved: boolean;
  resolvedAt?: number;
}

export interface FeedQualityReport {
  protocols: Record<
    string,
    {
      totalPosts: number;
      avgPostsPerFetch: number;
      lastFetchCount: number;
      lastFetchedAt: number | null;
      isEmpty: boolean;
      emptySinceMs: number | null;
      alertActive: boolean;
      sampleCount: number;
    }
  >;
  activeAlerts: EmptyFeedAlert[];
  summary: {
    total: number;
    withContent: number;
    empty: number;
    alertCount: number;
  };
  generatedAt: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function protocolCountKey(protocol: string): string {
  return `${PROTOCOL_COUNT_PREFIX}${protocol}`;
}

function alertKey(protocol: string): string {
  return `${EMPTY_FEED_ALERT_PREFIX}${protocol}`;
}

function monitorKey(protocol: string): string {
  return `${FEED_MONITOR_PREFIX}${protocol}`;
}

// ─── Record a protocol fetch result ──────────────────────────────────

export async function recordProtocolFetch(
  env: Env,
  protocol: string,
  postCount: number,
): Promise<void> {
  if (!env.CACHE) return;

  const now = Date.now();
  const key = protocolCountKey(protocol);

  try {
    const raw = await env.CACHE.get(key);
    const samples: ProtocolCountSample[] = raw ? JSON.parse(raw) : [];

    samples.push({
      protocol,
      postCount,
      sourceCount: postCount > 0 ? 1 : 0,
      fetchedAt: now,
    });

    // Keep only last N samples
    const trimmed = samples.slice(-MAX_COUNT_HISTORY);
    await env.CACHE.put(key, JSON.stringify(trimmed), { expirationTtl: 86400 * 7 });

    // Check for empty feed alert
    await checkEmptyFeedAlert(env, protocol, samples, now);
  } catch {
    // Non-critical
  }
}

// ─── Check and manage empty feed alerts ─────────────────────────────

async function checkEmptyFeedAlert(
  env: Env,
  protocol: string,
  samples: ProtocolCountSample[],
  now: number,
): Promise<void> {
  // Only check if we have enough samples
  if (samples.length < 3) return;

  const recentSamples = samples.slice(-5);
  const _emptySamples = recentSamples.filter((s) => s.postCount === 0);
  const consecutiveEmpty = getConsecutiveEmpty(samples);

  // Get the last time this protocol had content
  const lastContentSample = [...samples].reverse().find((s) => s.postCount > 0);
  const lastContentAt = lastContentSample?.fetchedAt ?? null;

  // Get existing alert (if any)
  const alertKey2 = alertKey(protocol);
  let existingAlert: EmptyFeedAlert | null = null;
  try {
    const raw = await env.CACHE.get(alertKey2);
    if (raw) existingAlert = JSON.parse(raw);
  } catch {
    // ignore
  }

  // Determine if we should alert
  const shouldAlert =
    consecutiveEmpty >= 3 && lastContentAt !== null
      ? now - lastContentAt > ALERT_THRESHOLD_MS
      : consecutiveEmpty >= 5; // No history — 5 consecutive empty fetches

  if (shouldAlert && !existingAlert?.resolved) {
    const alert: EmptyFeedAlert = {
      protocol,
      detectedAt: existingAlert?.detectedAt ?? now,
      emptySince: lastContentAt ?? now,
      consecutiveEmptyFetches: consecutiveEmpty,
      lastContentAt,
      severity: consecutiveEmpty >= 10 ? 'critical' : 'warning',
      resolved: false,
    };

    await env.CACHE.put(alertKey2, JSON.stringify(alert), { expirationTtl: 86400 * 3 });
    console.warn(
      `[feed-monitor] ALERT: ${protocol} feed empty for ${Math.round((now - (lastContentAt ?? now)) / 60000)} minutes`,
    );
  }

  // Resolve alert if content returned
  if (existingAlert && !existingAlert.resolved) {
    const recentNonEmpty = recentSamples.some((s) => s.postCount > 0);
    if (recentNonEmpty) {
      existingAlert.resolved = true;
      existingAlert.resolvedAt = now;
      await env.CACHE.put(alertKey2, JSON.stringify(existingAlert), { expirationTtl: 86400 * 3 });
      console.log(`[feed-monitor] RESOLVED: ${protocol} feed has content again`);
    }
  }
}

function getConsecutiveEmpty(samples: ProtocolCountSample[]): number {
  let count = 0;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (s && s.postCount === 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ─── Mark a protocol as having content (for alerts) ─────────────────

export async function resolveFeedAlert(env: Env, protocol: string): Promise<void> {
  if (!env.CACHE) return;
  try {
    const raw = await env.CACHE.get(alertKey(protocol));
    if (raw) {
      const alert = JSON.parse(raw) as EmptyFeedAlert;
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      await env.CACHE.put(alertKey(protocol), JSON.stringify(alert), { expirationTtl: 86400 * 3 });
    }
  } catch {
    // Non-critical
  }
}

// ─── Generate quality report ────────────────────────────────────────

export async function getFeedQualityReport(env: Env): Promise<FeedQualityReport> {
  const report: FeedQualityReport = {
    protocols: {},
    activeAlerts: [],
    summary: { total: 0, withContent: 0, empty: 0, alertCount: 0 },
    generatedAt: Date.now(),
  };

  if (!env.CACHE) return report;

  const now = Date.now();

  // Protocol list — same as bridge-reliability
  const protocols = [
    'nostr',
    'farcaster',
    'lens',
    'bluesky',
    'mastodon',
    'lemmy',
    'pixelfed',
    'peertube',
    'threads',
    'zora',
    'reddit',
    'rss',
    'mirror',
    'hive',
    'dtube',
    'lbry',
    'pleroma',
    'misskey',
    'writefreely',
    'funkwhale',
    'castopod',
    'subsocial',
    'steem',
    'telegram',
    'diaspora',
    'friendica',
    'mediagoblin',
    'bookwyrm',
    'mobilizon',
    'bonfire',
    'mitra',
    'takahe',
    'forgejo',
    'owncast',
    'faircamp',
    'gab',
    'minds',
    'aether',
    'scuttlebutt',
    'deso',
    'session',
    'cyberconnect',
    'arena',
    'microblog',
    'orbis',
    'ceramic',
    'audius',
    'rarible',
    'xmtp',
    'push',
    'huddle01',
    'tableland',
    'ponder',
    'ethereum',
    'solana',
    'kbin',
    'tildes',
    'discord',
    'matrix',
    'github',
  ];

  for (const protocol of protocols) {
    try {
      const raw = await env.CACHE.get(protocolCountKey(protocol));
      if (!raw) {
        report.protocols[protocol] = {
          totalPosts: 0,
          avgPostsPerFetch: 0,
          lastFetchCount: 0,
          lastFetchedAt: null,
          isEmpty: true,
          emptySinceMs: null,
          alertActive: false,
          sampleCount: 0,
        };
        continue;
      }

      const samples: ProtocolCountSample[] = JSON.parse(raw);
      const totalPosts = samples.reduce((sum, s) => sum + s.postCount, 0);
      const lastSample = samples[samples.length - 1];
      const consecutiveEmpty2 = getConsecutiveEmpty(samples);
      const lastContent = [...samples].reverse().find((s) => s.postCount > 0);
      const emptySinceMs = lastContent ? now - lastContent.fetchedAt : null;

      // Check for active alert
      let alertActive = false;
      try {
        const alertRaw = await env.CACHE.get(alertKey(protocol));
        if (alertRaw) {
          const alert = JSON.parse(alertRaw) as EmptyFeedAlert;
          alertActive = !alert.resolved;
          if (alertActive) report.activeAlerts.push(alert);
        }
      } catch {
        // ignore
      }

      report.protocols[protocol] = {
        totalPosts,
        avgPostsPerFetch: samples.length > 0 ? Math.round(totalPosts / samples.length) : 0,
        lastFetchCount: lastSample?.postCount ?? 0,
        lastFetchedAt: lastSample?.fetchedAt ?? null,
        isEmpty: consecutiveEmpty2 >= 3,
        emptySinceMs,
        alertActive,
        sampleCount: samples.length,
      };
    } catch {
      // Skip protocol on error
    }
  }

  // Summary
  const values = Object.values(report.protocols);
  report.summary.total = values.length;
  report.summary.withContent = values.filter((v) => v.lastFetchCount > 0).length;
  report.summary.empty = values.filter((v) => v.isEmpty).length;
  report.summary.alertCount = report.activeAlerts.length;

  return report;
}

// ─── KV-backed Webhook for empty feed alerts ───────────────────────

export async function notifyEmptyFeedAlert(env: Env, alert: EmptyFeedAlert): Promise<void> {
  // Write to KV for the monitoring dashboard
  const key = monitorKey(alert.protocol);
  try {
    await env.CACHE.put(key, JSON.stringify(alert), { expirationTtl: 86400 });
  } catch {
    // Non-critical
  }

  // Log to console — production would send via webhook
  console.warn(
    `[feed-monitor] ${alert.severity.toUpperCase()}: ${alert.protocol} feed empty ` +
      `(${alert.consecutiveEmptyFetches} consecutive empty fetches, ` +
      `last content ${alert.lastContentAt ? new Date(alert.lastContentAt).toISOString() : 'never'})`,
  );
}
