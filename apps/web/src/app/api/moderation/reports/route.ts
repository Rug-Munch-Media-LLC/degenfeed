import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
const REASONS = ['spam', 'harassment', 'scam', 'nsfw', 'other'];

const MOCK_REPORTS = Array.from({ length: 12 }, (_, i) => ({
  id: `report-${i + 1}`,
  postId: `0x${Math.random().toString(16).slice(2, 42)}`,
  protocol: PROTOCOLS[i % PROTOCOLS.length],
  reason: REASONS[i % REASONS.length],
  description: i % 3 === 0 ? 'This user keeps posting scam links in every channel.' : undefined,
  reporterAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
  reportedAt: Date.now() - Math.random() * 7 * 86400000,
  status: (i < 6 ? 'pending' : i < 9 ? 'resolved' : 'dismissed') as
    | 'pending'
    | 'resolved'
    | 'dismissed',
  resolvedBy: i >= 6 ? `0x${Math.random().toString(16).slice(2, 42)}` : undefined,
  resolvedAt: i >= 6 ? Date.now() - Math.random() * 3 * 86400000 : undefined,
  postText: i % 2 === 0 ? 'Check out this amazing opportunity! Free money!' : undefined,
  postAuthorId: `0x${Math.random().toString(16).slice(2, 42)}`,
  postAuthorHandle: i % 2 === 0 ? 'spam_account_42' : `user_${Math.floor(Math.random() * 1000)}`,
})).sort((a, b) => {
  const statusOrder: Record<string, number> = { pending: 0, resolved: 1, dismissed: 2 };
  return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const protocol = url.searchParams.get('protocol');
  const reason = url.searchParams.get('reason');

  let filtered = [...MOCK_REPORTS];

  if (status && status !== 'all') {
    filtered = filtered.filter((r) => r.status === status);
  }
  if (protocol) {
    filtered = filtered.filter((r) => r.protocol === protocol);
  }
  if (reason) {
    filtered = filtered.filter((r) => r.reason === reason);
  }

  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 100));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);

  return NextResponse.json({
    reports: filtered.slice(offset, offset + limit),
    total: filtered.length,
  });
}
