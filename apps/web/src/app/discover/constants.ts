export const TOPIC_META: Record<string, { emoji: string; color: string; label: string }> = {
  bitcoin: { emoji: '\u20BF', color: '#f7931a', label: 'Bitcoin' },
  ethereum: { emoji: '\u039E', color: '#627eea', label: 'Ethereum' },
  solana: { emoji: '\u25C9', color: '#14f195', label: 'Solana' },
  defi: { emoji: '\uD83D\uDCCA', color: '#6366f1', label: 'DeFi' },
  nft: { emoji: '\uD83D\uDDBC', color: '#ec4899', label: 'NFT' },
  ai: { emoji: '\uD83E\uDD16', color: '#06b6d4', label: 'AI' },
  regulation: { emoji: '\u2696\uFE0F', color: '#ef4444', label: 'Regulation' },
  security: { emoji: '\uD83D\uDD12', color: '#dc2626', label: 'Security' },
  memes: { emoji: '\uD83D\uDE02', color: '#f59e0b', label: 'Memes' },
  privacy: { emoji: '\uD83D\uDC41\uFE0F', color: '#a855f7', label: 'Privacy' },
  gaming: { emoji: '\uD83C\uDFAE', color: '#22d3ee', label: 'Gaming' },
  layer2: { emoji: '\u26D3\uFE0F', color: '#8b5cf6', label: 'Layer 2' },
  crypto: { emoji: '\u20BF', color: '#f59e0b', label: 'Crypto' },
  macro: { emoji: '\uD83D\uDCC8', color: '#10b981', label: 'Macro' },
  stablecoin: { emoji: '\uD83D\uDCB5', color: '#22c55e', label: 'Stablecoin' },
};

export function getTopicMeta(topic: string): { emoji: string; color: string; label: string } {
  const key = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
  return TOPIC_META[key] ?? { emoji: '#', color: '#888', label: topic };
}

export function topicSlug(topic: string): string {
  return topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
