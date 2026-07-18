import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 300; // 5 minutes

// TODO: Wire to worker backend
interface ProtocolHealth {
  id: string;
  name: string;
  status: 'up' | 'degraded' | 'down';
  postsToday: number;
  usersOnline: number;
  stats: { label: string; value: string }[];
}

const PROTOCOL_STATS: ProtocolHealth[] = [
  {
    id: 'farcaster',
    name: 'Farcaster',
    status: 'up',
    postsToday: 45231,
    usersOnline: 1283,
    stats: [
      { label: 'casts today', value: '45,231' },
      { label: 'channels', value: '1,203' },
      { label: 'hub', value: 'nemes.farcaster.xyz' },
    ],
  },
  {
    id: 'lens',
    name: 'Lens',
    status: 'up',
    postsToday: 8492,
    usersOnline: 422,
    stats: [
      { label: 'publications today', value: '8,492' },
      { label: 'profiles online', value: '22' },
      { label: 'network', value: 'Polygon' },
    ],
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    status: 'up',
    postsToday: 23419,
    usersOnline: 3211,
    stats: [
      { label: 'skeets today', value: '23,419' },
      { label: 'custom feeds', value: '1,845' },
      { label: 'PDS', value: 'bsky.social' },
    ],
  },
  {
    id: 'nostr',
    name: 'Nostr',
    status: 'up',
    postsToday: 12847,
    usersOnline: 867,
    stats: [
      { label: 'notes today', value: '12,847' },
      { label: 'relays active', value: '342' },
      { label: 'top relay', value: 'wss://relay.damus.io' },
    ],
  },
  {
    id: 'mastodon',
    name: 'Mastodon',
    status: 'up',
    postsToday: 3210,
    usersOnline: 1847,
    stats: [
      { label: 'toots on social.degenfeed.xyz', value: '3,210' },
      { label: 'fediverse instances', value: '892' },
      { label: 'active users', value: '1,847' },
    ],
  },
  {
    id: 'threads',
    name: 'Threads',
    status: 'degraded',
    postsToday: 5120,
    usersOnline: 0,
    stats: [
      { label: 'posts today', value: '5,120' },
      { label: 'status', value: 'beta' },
    ],
  },
  {
    id: 'reddit',
    name: 'Reddit',
    status: 'up',
    postsToday: 8932,
    usersOnline: 0,
    stats: [
      { label: 'posts today', value: '8,932' },
      { label: 'subreddits tracked', value: '24' },
    ],
  },
  {
    id: 'rss',
    name: 'News / RSS',
    status: 'up',
    postsToday: 15231,
    usersOnline: 0,
    stats: [
      { label: 'articles today', value: '15,231' },
      { label: 'sources', value: '353+' },
    ],
  },
];

export async function GET() {
  const up = PROTOCOL_STATS.filter((p) => p.status === 'up').length;
  const degraded = PROTOCOL_STATS.filter((p) => p.status === 'degraded').length;
  const down = PROTOCOL_STATS.filter((p) => p.status === 'down').length;
  const total = PROTOCOL_STATS.length;

  return NextResponse.json(
    {
      protocols: PROTOCOL_STATS,
      summary: { up, degraded, down, total },
      cachedAt: Date.now(),
    },
    {
      status: 200,
      headers: {
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    },
  );
}
