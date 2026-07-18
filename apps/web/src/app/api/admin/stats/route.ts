import { NextResponse } from 'next/server';
import { getStats, getPendingSources, getNewThisWeekSources, shouldRunDiscovery } from '@/lib/source-engine';

export const runtime = 'nodejs';

// TODO: Wire to worker backend
const NOW = Date.now();

const DEFAULT_STATS = {
  totalUsers: 1247,
  postsToday: 892,
  postsThisWeek: 5431,
  totalTips: 3841,
  tipVolumeUsd: 28450,
  activeProtocols: 6,
  activeProtocolsList: [
    { name: 'Nostr', status: 'online' as const, posts24h: 312 },
    { name: 'Farcaster', status: 'online' as const, posts24h: 204 },
    { name: 'Lens', status: 'online' as const, posts24h: 98 },
    { name: 'Bluesky', status: 'online' as const, posts24h: 156 },
    { name: 'Mastodon', status: 'degraded' as const, posts24h: 72 },
    { name: 'Threads', status: 'online' as const, posts24h: 44 },
  ],
  moderationQueue: 12,
  pendingSources: 8,
  systemUptime: 342720,
  avgResponseTime: 145,
  storageUsed: '4.2 GB',
  dailyActiveUsers: 847,
};

const DEFAULT_ACTIVITY = [
  { id: 'a1', type: 'post' as const, message: 'New milestone: 1,000+ posts today across all protocols', timestamp: NOW - 60000, severity: 'info' as const },
  { id: 'a2', type: 'tip' as const, message: 'Record tip of 0.5 ETH ($1,650) sent on Farcaster', timestamp: NOW - 180000, severity: 'info' as const },
  { id: 'a3', type: 'system' as const, message: 'Mastodon fetcher latency increased to 2.3s', timestamp: NOW - 300000, severity: 'warning' as const },
  { id: 'a4', type: 'user_joined' as const, message: '12 new users registered in the last hour', timestamp: NOW - 600000, severity: 'info' as const },
  { id: 'a5', type: 'report' as const, message: '2 new moderation reports filed (spam, scam)', timestamp: NOW - 1800000, severity: 'warning' as const },
  { id: 'a7', type: 'ban' as const, message: '1 user banned for repeated policy violations', timestamp: NOW - 3600000, severity: 'info' as const },
];

export async function GET() {
  // Inject real source discovery data
  let discoveryActivity = [];
  try {
    const sourceStats = getStats();
    const pending = getPendingSources();
    const newThisWeek = getNewThisWeekSources();

    discoveryActivity = [
      {
        id: 'src-discovery',
        type: 'source' as const,
        message: `Source discovery: ${sourceStats.totalApproved} approved, ${sourceStats.pendingCount} pending, ${sourceStats.newThisWeek} new this week`,
        timestamp: NOW - 60000,
        severity: 'info' as const,
      },
      {
        id: 'src-new-week',
        type: 'source' as const,
        message: `${newThisWeek.sources.length} new sources discovered this week across ${new Set(newThisWeek.sources.map(s => s.platform)).size} platforms`,
        timestamp: NOW - 120000,
        severity: 'info' as const,
      },
      {
        id: 'src-stale',
        type: 'source' as const,
        message: `${sourceStats.staleSources} sources flagged as stale (14d+ inactivity)`,
        timestamp: NOW - 300000,
        severity: sourceStats.staleSources > 5 ? 'warning' as const : 'info' as const,
      },
    ];

    const runSchedule = shouldRunDiscovery();
    if (runSchedule.shouldRun && runSchedule.lastRunAt !== null) {
      discoveryActivity.push({
        id: 'src-cron-due',
        type: 'system' as const,
        message: `Weekly auto-discovery is due (${Math.round(runSchedule.hoursSinceLastRun / 24)}d since last run)`,
        timestamp: NOW - 60000,
        severity: 'warning' as const,
      });
    }

    // Merge discovery activity into default
    const activity = [...discoveryActivity, ...DEFAULT_ACTIVITY];

    return NextResponse.json(
      {
        stats: {
          ...DEFAULT_STATS,
          pendingSources: pending.total,
        },
        activity,
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      },
    );
  } catch {
    // Fall back to default
    return NextResponse.json(
      { stats: DEFAULT_STATS, activity: DEFAULT_ACTIVITY },
      {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      },
    );
  }
}
