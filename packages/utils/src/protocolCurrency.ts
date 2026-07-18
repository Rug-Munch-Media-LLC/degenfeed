/**
 * Protocol → default tipping currency mapping.
 *
 * When a user is connected via a specific protocol, this mapping
 * determines the default tip currency shown in quick-tip buttons.
 */
export const PROTOCOL_DEFAULT_CURRENCY: Record<string, string> = {
  farcaster: 'base',
  lens: 'matic',
  nostr: 'btc',
  bluesky: 'eth',
  mastodon: 'eth',
  threads: 'eth',
  lemmy: 'eth',
  reddit: 'eth',
  peertube: 'usdc',
  rss: 'usdc',
  ethereum: 'eth',
  solana: 'sol',
};

/**
 * Pick the best default currency given a user's connected protocols
 * and (optionally) the protocol of the post they are viewing.
 *
 * Logic:
 *  1. If the post's protocol has a known default, use it.
 *  2. Otherwise use the first connected protocol that has a mapping.
 *  3. Fall back to 'eth'.
 */
export function getDefaultCurrency(
  connectedProtocols: string[],
  postProtocol?: string,
): string {
  // Prefer the post's protocol currency (author protocol)
  if (postProtocol && PROTOCOL_DEFAULT_CURRENCY[postProtocol]) {
    return PROTOCOL_DEFAULT_CURRENCY[postProtocol];
  }
  // Fall back to user's first connected protocol with a mapping
  for (const proto of connectedProtocols) {
    if (PROTOCOL_DEFAULT_CURRENCY[proto]) return PROTOCOL_DEFAULT_CURRENCY[proto];
  }
  return 'eth';
}

/**
 * Human-readable labels and icons for each tipping currency.
 */
export const CURRENCY_META: Record<
  string,
  { label: string; symbol: string; icon: string; color: string }
> = {
  eth: {
    label: 'Ethereum',
    symbol: 'ETH',
    icon: '◆',
    color: '#627eea',
  },
  base: {
    label: 'Base',
    symbol: 'ETH',
    icon: '🔵',
    color: '#0052FF',
  },
  matic: {
    label: 'Polygon',
    symbol: 'MATIC',
    icon: '🌿',
    color: '#8247e5',
  },
  sol: {
    label: 'Solana',
    symbol: 'SOL',
    icon: '◎',
    color: '#9945ff',
  },
  btc: {
    label: 'Bitcoin (Lightning)',
    symbol: 'BTC',
    icon: '⚡',
    color: '#f7931a',
  },
  usdc: {
    label: 'USD Coin',
    symbol: 'USDC',
    icon: '●',
    color: '#2775ca',
  },
};
