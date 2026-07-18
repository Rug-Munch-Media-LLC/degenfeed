import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// TODO: Wire to worker backend
const MOCK_SPAM = [
  {
    id: 'spam-1',
    contentId: 'content-x1',
    reason: 'Repeated link dropping',
    confidence: 0.92,
    detectedAt: Date.now() - 3600000,
    status: 'pending' as const,
    text: 'FREE ETH!!! Claim your airdrop at http://scam-link.xyz now!!!',
    authorHandle: 'scam_bot_42',
    protocol: 'nostr',
  },
  {
    id: 'spam-2',
    contentId: 'content-x2',
    reason: 'Pump and dump',
    confidence: 0.87,
    detectedAt: Date.now() - 7200000,
    status: 'pending' as const,
    text: 'BUY BUY BUY!!! This coin is going to $100!!! Dont miss out!!!',
    authorHandle: 'pumpdumper_99',
    protocol: 'farcaster',
  },
  {
    id: 'spam-3',
    contentId: 'content-x3',
    reason: 'Impersonation',
    confidence: 0.95,
    detectedAt: Date.now() - 10800000,
    status: 'pending' as const,
    text: 'I am Vitalik. Send me ETH and I will send you back 2x.',
    authorHandle: 'vitalik.eth_fake',
    protocol: 'lens',
  },
  {
    id: 'spam-4',
    contentId: 'content-x4',
    reason: 'Duplicate content',
    confidence: 0.76,
    detectedAt: Date.now() - 14400000,
    status: 'confirmed' as const,
    text: 'Check out my new project!',
    authorHandle: 'spammy_mcgee',
    protocol: 'bluesky',
  },
];

export async function GET() {
  return NextResponse.json(
    { items: MOCK_SPAM },
    {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    },
  );
}
