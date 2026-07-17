import { NextResponse } from 'next/server';

/**
 * Curated follow suggestions per protocol.
 * Hardcoded for now — later this can query a trending/people endpoint.
 */
const SUGGESTIONS: Record<
  string,
  Array<{ id: string; name: string; handle: string; avatar: string; bio: string }>
> = {
  nostr: [
    {
      id: 'npub1v3z7j6',
      name: 'Kieran',
      handle: 'kieran@degenfeed.xyz',
      avatar: '/icon.svg',
      bio: 'DegenFeed founder. Nostr maxi.',
    },
    {
      id: 'npub1a2b3c4',
      name: 'BTC Frontier',
      handle: 'btcfrontier',
      avatar: '/icon.svg',
      bio: 'Bitcoin & Nostr evangelist. Open source.',
    },
    {
      id: 'npub1x5y6z7',
      name: 'NostrReport',
      handle: 'nostrreport',
      avatar: '/icon.svg',
      bio: 'Daily roundup of what matters on Nostr.',
    },
  ],
  farcaster: [
    {
      id: 'fc_1',
      name: 'dwr.eth',
      handle: 'dwr',
      avatar: '/icon.svg',
      bio: 'Building Farcaster. Previously Coinbase.',
    },
    {
      id: 'fc_2',
      name: 'v.eth',
      handle: 'v',
      avatar: '/icon.svg',
      bio: 'Farcaster dev. Full-time builder.',
    },
    {
      id: 'fc_3',
      name: 'Horsefacts',
      handle: 'horsefacts',
      avatar: '/icon.svg',
      bio: 'Builder on Farcaster. Optimist.',
    },
  ],
  lens: [
    {
      id: 'lens_1',
      name: 'Stani.lens',
      handle: 'stani',
      avatar: '/icon.svg',
      bio: 'Building Lens Protocol. DeFi native.',
    },
    {
      id: 'lens_2',
      name: 'CryptoNate.lens',
      handle: 'cryptonate',
      avatar: '/icon.svg',
      bio: 'Crypto analysis and Lens ecosystem.',
    },
    {
      id: 'lens_3',
      name: 'ChainLinkGod.lens',
      handle: 'chainlinkgod',
      avatar: '/icon.svg',
      bio: 'Smart contract dev. Chainlink maxi.',
    },
  ],
  bluesky: [
    {
      id: 'bsky_1',
      name: 'jay.bsky.social',
      handle: 'jay.bsky.social',
      avatar: '/icon.svg',
      bio: 'AT Protocol dev. Bluesky team.',
    },
    {
      id: 'bsky_2',
      name: 'pfrazee.bsky.social',
      handle: 'pfrazee.bsky.social',
      avatar: '/icon.svg',
      bio: 'Co-creator of Bluesky.',
    },
    {
      id: 'bsky_3',
      name: 'kPOW.bsky.social',
      handle: 'kpow.bsky.social',
      avatar: '/icon.svg',
      bio: 'Tech commentator. Crypto enthusiast.',
    },
  ],
  mastodon: [
    {
      id: 'masto_1',
      name: 'Eugen',
      handle: 'eugen@mastodon.social',
      avatar: '/icon.svg',
      bio: 'Creator of Mastodon.',
    },
    {
      id: 'masto_2',
      name: 'DegenFeed Bot',
      handle: 'degenfeed@social.degenfeed.xyz',
      avatar: '/icon.svg',
      bio: 'Official DegenFeed Mastodon bot.',
    },
    {
      id: 'masto_3',
      name: 'CryptoFM',
      handle: 'cryptofm@mastodon.social',
      avatar: '/icon.svg',
      bio: 'Crypto news and podcast network.',
    },
  ],
  threads: [
    {
      id: 'threads_1',
      name: 'TechCrunch',
      handle: 'techcrunch@threads.net',
      avatar: '/icon.svg',
      bio: 'Tech and startup news.',
    },
    {
      id: 'threads_2',
      name: 'Bankless',
      handle: 'bankless@threads.net',
      avatar: '/icon.svg',
      bio: 'Go bankless with crypto.',
    },
  ],
  reddit: [
    {
      id: 'reddit_1',
      name: 'r/CryptoCurrency',
      handle: 'r/CryptoCurrency',
      avatar: '/icon.svg',
      bio: 'The largest crypto community on Reddit.',
    },
    {
      id: 'reddit_2',
      name: 'r/defi',
      handle: 'r/defi',
      avatar: '/icon.svg',
      bio: 'Decentralized finance discussion.',
    },
    {
      id: 'reddit_3',
      name: 'r/solana',
      handle: 'r/solana',
      avatar: '/icon.svg',
      bio: 'Solana ecosystem and news.',
    },
  ],
  rss: [
    {
      id: 'rss_1',
      name: 'The Block',
      handle: 'theblock.co',
      avatar: '/icon.svg',
      bio: 'Leading crypto news and research.',
    },
    {
      id: 'rss_2',
      name: 'CoinDesk',
      handle: 'coindesk.com',
      avatar: '/icon.svg',
      bio: 'Crypto news, prices, and data.',
    },
    {
      id: 'rss_3',
      name: 'Decrypt',
      handle: 'decrypt.co',
      avatar: '/icon.svg',
      bio: 'Web3 news that actually makes sense.',
    },
  ],
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const protocolsParam = url.searchParams.get('protocols');

  let protocols: string[];
  if (protocolsParam) {
    protocols = protocolsParam.split(',').filter((p) => p in SUGGESTIONS);
  } else {
    protocols = Object.keys(SUGGESTIONS);
  }

  // Gather up to 5 accounts, prioritizing selected protocols
  const suggestions: Array<{
    id: string;
    name: string;
    handle: string;
    avatar: string;
    bio: string;
    protocol: string;
  }> = [];
  const perProtocolLimit = Math.max(1, Math.floor(8 / protocols.length));

  for (const proto of protocols) {
    const accounts = SUGGESTIONS[proto] ?? [];
    for (const account of accounts.slice(0, perProtocolLimit)) {
      suggestions.push({ ...account, protocol: proto });
    }
  }

  // Fill remaining slots with overflow from any protocol
  if (suggestions.length < 5) {
    for (const proto of protocols) {
      if (suggestions.length >= 5) break;
      const overflow = (SUGGESTIONS[proto] ?? []).slice(perProtocolLimit);
      for (const account of overflow) {
        if (suggestions.length >= 5) break;
        if (!suggestions.find((s) => s.id === account.id)) {
          suggestions.push({ ...account, protocol: proto });
        }
      }
    }
  }

  return NextResponse.json({ suggestions, total: suggestions.length });
}
