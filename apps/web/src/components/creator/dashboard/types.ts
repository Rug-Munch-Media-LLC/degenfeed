export interface BackendUsage {
  bytes: number;
  readable: string;
  count: number;
  costPerMo?: number;
  label?: string;
  emoji?: string;
}

export interface TypeUsage {
  bytes: number;
  readable: string;
  count: number;
  backend?: string;
  tier?: string;
  costPerMo?: number;
}

export interface ExpiringVideo {
  contentId: string;
  title?: string;
  expiresAt: number;
  daysLeft: number;
  tier?: string;
  size?: number;
}

export interface StorageForecast {
  projectedBytes30d: number;
  projectedBytes90d: number;
  currentMonthlyCost: number;
  projectedMonthlyCost30d: number;
  projectedMonthlyCost90d: number;
  daysUntilFull: number | null;
  recommendation: string;
  currentBytes?: number;
}

export interface StorageUsageData {
  totalBytes: number;
  totalReadable: string;
  freeLimit: number;
  usagePercent: number;
  byBackend: Record<string, BackendUsage>;
  byType: Record<string, TypeUsage>;
  plan: 'free' | 'premium' | 'pro' | 'enterprise';
  expiringSoon: ExpiringVideo[];
  costBreakdown?: Record<string, number>;
  totalMonthlyCost?: number;
  forecast?: StorageForecast;
  migrationCandidates?: number;
  potentialSavings?: number;
}

export interface StorageTier {
  id: string;
  name: string;
  price: string;
  storage: string;
  backends: string;
  features: string[];
  popular?: boolean;
  cta: string;
  color: string;
}

// ─── Creator Dashboard (analytics) types & helpers ─────────────────────

export interface CreatorStats {
  totalPosts: number;
  totalFollowers: number;
  totalTipsUsd: number;
  totalSubscribers: number;
  engagementRate: number;
  tipsByProtocol: Record<string, number>;
  tipsByCurrency: Record<string, number>;
  earningsByMonth: number[];
  earningsMonthLabels: string[];
  topTippers: Array<{ name: string; totalUsd: number }>;
  loading: boolean;
  error: string | null;
}

export type TabId =
  | 'overview'
  | 'content'
  | 'analytics'
  | 'monetization'
  | 'publishing'
  | 'articles'
  | 'storage';

export const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◆' },
  { id: 'content', label: 'Content', icon: '📝' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
  { id: 'monetization', label: 'Monetization', icon: '✦' },
  { id: 'articles', label: 'Articles', icon: '📄' },
  { id: 'publishing', label: 'Publishing', icon: '📤' },
  { id: 'storage', label: 'Storage', icon: '💾' },
];

export const PROTOCOL_COLORS: Record<string, string> = {
  nostr: '#8e30eb',
  farcaster: '#8a63d2',
  lens: '#abfe2c',
  bluesky: '#1185fe',
  mastodon: '#6364ff',
  threads: '#888888',
  ethereum: '#627eea',
  solana: '#9945ff',
  reddit: '#ff4500',
};

export const PROTOCOL_LABELS: Record<string, string> = {
  nostr: 'Nostr',
  farcaster: 'Farcaster',
  lens: 'Lens',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  threads: 'Threads (Experimental)',
  ethereum: 'Ethereum',
  solana: 'Solana',
  reddit: 'Reddit',
};

export const CURRENCY_COLORS: Record<string, string> = {
  DEGEN: '#00ff41',
  ETH: '#627eea',
  SOL: '#9945ff',
  BTC: '#f7931a',
  USDC: '#2775ca',
  MATIC: '#8247e5',
};

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
