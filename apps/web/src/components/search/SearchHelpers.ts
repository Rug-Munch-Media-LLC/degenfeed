/**
 * Search helper functions extracted from SearchOverlay.
 */
import { formatCount, formatDate, formatDuration } from '@degenfeed/utils';
import type { IdentityResult } from './SearchTypes';

export { formatCount, formatDate, formatDuration };

const RECENT_SEARCHES_KEY = 'df_recent_searches';
const MAX_RECENT = 5;

export function getProfileUrl(identity: IdentityResult): string {
  switch (identity.protocol) {
    case 'nostr':
      return `https://snort.social/p/${identity.handle || identity.id}`;
    case 'farcaster':
      return `https://warpcast.com/${identity.handle?.replace('@', '') || identity.id}`;
    case 'lens':
      return `https://hey.xyz/u/${identity.handle?.replace('lens/', '') || identity.id}`;
    case 'bluesky':
      return `https://bsky.app/profile/${identity.handle?.replace('@', '') || identity.id}`;
    case 'mastodon':
      return `https://social.degenfeed.xyz/@${identity.handle || identity.id}`;
    default:
      return '#';
  }
}

export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(q: string): void {
  try {
    const searches = getRecentSearches().filter((s) => s !== q);
    searches.unshift(q);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, MAX_RECENT)));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function getTrendingIcon(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('bitcoin') || t.includes('btc')) return '₿';
  if (t.includes('ethereum') || t.includes('eth')) return '◆';
  if (t.includes('solana') || t.includes('sol')) return '◎';
  if (t.includes('defi') || t.includes('yield') || t.includes('liquidity')) return '🏦';
  if (t.includes('nft') || t.includes('collect')) return '🖼';
  if (t.includes('ai') || t.includes('agent') || t.includes('llm')) return '🤖';
  if (t.includes('mem') || t.includes('doge') || t.includes('pepe')) return '😂';
  if (t.includes('gam') || t.includes('play') || t.includes('metaverse')) return '🎮';
  if (t.includes('sec') || t.includes('regul') || t.includes('law')) return '⚖️';
  if (t.includes('layer') || t.includes('l2') || t.includes('scal')) return '⚡';
  if (t.includes('dao') || t.includes('govern')) return '🗳️';
  if (t.includes('privacy') || t.includes('zk') || t.includes('zero')) return '🔒';
  return '🔥';
}

export const TRENDING_TOPICS = [
  { label: 'Bitcoin', query: 'bitcoin', icon: '₿' },
  { label: 'Ethereum', query: 'ethereum', icon: '◆' },
  { label: 'Solana', query: 'solana', icon: '◎' },
  { label: 'DeFi', query: 'defi', icon: '🏦' },
  { label: 'NFT', query: 'nft', icon: '🖼' },
  { label: 'AI', query: 'ai', icon: '🤖' },
  { label: 'Memes', query: 'memes', icon: '😂' },
  { label: 'Gaming', query: 'gaming', icon: '🎮' },
];

export const PROTOCOL_FILTERS = [
  { id: null as string | null, label: 'All' },
  { id: 'nostr', label: 'Nostr', color: '#8b5cf6' },
  { id: 'farcaster', label: 'Farcaster', color: '#8a63d2' },
  { id: 'lens', label: 'Lens', color: '#abfe2c' },
  { id: 'bluesky', label: 'Bluesky', color: '#1185fe' },
  { id: 'mastodon', label: 'Mastodon', color: '#6364ff' },
];

export const RECENT_SEARCHES_KEY_CONST = RECENT_SEARCHES_KEY;
