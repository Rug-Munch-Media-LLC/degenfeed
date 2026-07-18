import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const HANDLES = [
  'alice_web3',
  'bob_nft',
  'crypto_kyle',
  'defi_dan',
  'metaverse_mary',
  'rug_police',
  'degendad',
  'solana_sam',
  'eth_maxi',
  'nofear_frank',
  'dao_voter',
  'yield_farmer',
  'airdrop_hunter',
  'punk_rock',
  'based_builder',
  'wizard_of_web3',
  'hodl_queen',
  'chain_link',
  'blockchain_bill',
  'token_tom',
];

const DISPLAY_NAMES = [
  'Alice Web3',
  'Bob NFT',
  'Crypto Kyle',
  'DeFi Dan',
  'Metaverse Mary',
  'Rug Police',
  'DegenDad',
  'Solana Sam',
  'ETH Maxi',
  'NoFear Frank',
  'DAO Voter',
  'Yield Farmer',
  'Airdrop Hunter',
  'Punk Rock',
  'Based Builder',
  'Wizard of Web3',
  'HODL Queen',
  'Chain Link',
  'Blockchain Bill',
  'Token Tom',
];

const PROTOCOLS = ['nostr', 'farcaster', 'lens', 'bluesky', 'mastodon', 'threads', 'reddit'];

const MOCK_USERS = Array.from({ length: 45 }, (_, i) => {
  const statuses: Array<'active' | 'suspended' | 'banned' | 'warned'> = [
    'active',
    'active',
    'active',
    'active',
    'active',
    'active',
    'suspended',
    'banned',
    'warned',
    'active',
  ];
  return {
    id: `user-${i + 1}`,
    walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
    handle: HANDLES[i % HANDLES.length],
    displayName: DISPLAY_NAMES[i % DISPLAY_NAMES.length],
    protocol: PROTOCOLS[i % PROTOCOLS.length],
    joinedAt: Date.now() - Math.random() * 90 * 86400000,
    lastActive: Date.now() - Math.random() * 48 * 3600000,
    postCount: Math.floor(Math.random() * 500),
    tipCount: Math.floor(Math.random() * 50),
    reputation: Math.random(),
    status: statuses[i % statuses.length],
    flags: i % 7 === 0 ? ['high_report_count'] : [],
  };
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.toLowerCase() || '';
  const statusFilter = url.searchParams.get('status') || 'all';
  const protocolFilter = url.searchParams.get('protocol') || 'all';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));

  let filtered = [...MOCK_USERS];

  if (search) {
    filtered = filtered.filter(
      (u) =>
        u.handle.toLowerCase().includes(search) ||
        u.displayName.toLowerCase().includes(search) ||
        u.walletAddress.toLowerCase().includes(search),
    );
  }

  if (statusFilter !== 'all') {
    filtered = filtered.filter((u) => u.status === statusFilter);
  }

  if (protocolFilter !== 'all') {
    filtered = filtered.filter((u) => u.protocol === protocolFilter);
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const users = filtered.slice(start, start + limit);

  return NextResponse.json({ users, total, page, totalPages });
}
