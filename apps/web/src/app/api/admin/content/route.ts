import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon'];
const HANDLES = ['alice_web3', 'bob_nft', 'crypto_kyle', 'defi_dan', 'metaverse_mary'];
const TEXTS = [
  'Just swapped some ETH for SOL. Bullish on Solana this cycle!',
  'New NFT collection drop tomorrow. Whitelist spots available!',
  'Does anyone know the best Farcaster client for iOS?',
  'Hot take: Nostr will overtake Twitter within 5 years.',
  'Check out this new DeFi protocol I found — insane APY!',
  'gm another day in the web3 trenches',
  'Published my research on zk-rollups vs optimistic rollups',
  'Who else is going to ETHDenver this year?',
  'Free mint alert! New project on Base, 10K supply',
  'The fediverse is the future of social media. Period.',
];

const MOCK_CONTENT = Array.from({ length: 20 }, (_, i) => ({
  id: `content-${i + 1}`,
  protocol: PROTOCOLS[i % PROTOCOLS.length],
  authorHandle: HANDLES[i % HANDLES.length],
  text: TEXTS[i % TEXTS.length],
  timestamp: Date.now() - Math.random() * 7 * 86400000,
  engagement: {
    likes: Math.floor(Math.random() * 200),
    replies: Math.floor(Math.random() * 40),
    tips: Math.floor(Math.random() * 10),
  },
  score: Math.random(),
  status: (i < 3 ? 'flagged' : i === 4 ? 'removed' : 'published') as
    | 'flagged'
    | 'removed'
    | 'published'
    | 'pending',
  flags: i < 3 ? ['possible_spam', 'high_mention_count'] : undefined,
}));

export async function GET(request: Request) {
  const url = new URL(request.url);
  const protocol = url.searchParams.get('protocol');
  const status = url.searchParams.get('status');

  let filtered = [...MOCK_CONTENT];
  if (protocol) {
    filtered = filtered.filter((c) => c.protocol === protocol);
  }
  if (status) {
    filtered = filtered.filter((c) => c.status === status);
  }

  return NextResponse.json(
    { content: filtered, total: filtered.length },
    {
      headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' },
    },
  );
}
