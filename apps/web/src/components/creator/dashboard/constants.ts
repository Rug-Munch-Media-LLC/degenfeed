import type { StorageTier } from './types';

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / 1024 ** i;
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const BACKEND_COLORS: Record<string, string> = {
  ipfs_storacha: '#00c853',
  ipfs_pinata: '#69f0ae',
  ipfs: '#8a63d2',
  r2_standard: '#f7931a',
  r2_infrequent_access: '#4fc3f7',
  r2: '#f7931a',
  b2: '#e53935',
  storj: '#ffb300',
  arweave: '#00ff41',
  bunny: '#ff6f00',
  sia: '#26a69a',
  filecoin: '#5c6bc0',
  'r2+ipfs': '#ff8f00',
  'r2+arweave': '#ff8f00',
};

export const TIER_COLORS: Record<string, string> = {
  tier1_free: '#00ff41',
  tier2_cheap: '#f7931a',
  tier3_premium: '#8a63d2',
};

export const TIER_LABELS: Record<string, string> = {
  tier1_free: 'Tier 1 — Free (IPFS)',
  tier2_cheap: 'Tier 2 — Cheap (R2/B2)',
  tier3_premium: 'Tier 3 — Premium (Arweave)',
};

export const TYPE_LABELS: Record<string, string> = {
  short: 'Shorts',
  longform: 'VODs',
  podcast: 'Podcasts',
  livestream: 'Live VODs',
  premium: 'Premium',
  temporary: 'Temp',
};

export const TYPE_ICONS: Record<string, string> = {
  short: '🎬',
  longform: '📺',
  podcast: '🎙️',
  livestream: '🔴',
  premium: '⭐',
  temporary: '⏳',
};

export const BACKEND_EMOJIS: Record<string, string> = {
  ipfs: '🌐',
  ipfs_storacha: '🌐',
  ipfs_pinata: '📌',
  r2: '☁️',
  r2_standard: '☁️',
  r2_infrequent_access: '❄️',
  b2: '💾',
  storj: '🔗',
  arweave: '⛓️',
  bunny: '🐰',
  sia: '📡',
  filecoin: '🗄️',
};

export const BACKEND_LABELS: Record<string, string> = {
  ipfs: 'IPFS (decentralized)',
  ipfs_storacha: 'IPFS via Storacha',
  ipfs_pinata: 'IPFS via Pinata',
  r2: 'Cloudflare R2',
  r2_standard: 'Cloudflare R2',
  r2_infrequent_access: 'R2 Infrequent Access',
  b2: 'Backblaze B2',
  storj: 'Storj',
  arweave: 'Arweave (Irys)',
  bunny: 'BunnyCDN',
  sia: 'Sia Network',
  filecoin: 'Filecoin',
};

export const STORAGE_TIERS: StorageTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    storage: '5 GB',
    backends: 'IPFS (Storacha) + R2',
    features: [
      'IPFS shorts storage (Tier 1 — Free)',
      'R2 VOD storage (Tier 2 — $0.015/GB)',
      'Basic CDN delivery via Cloudflare',
      'Auto-cleanup after 30 days unwatched',
    ],
    cta: 'Current Plan',
    color: '#00ff41',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$5/mo',
    storage: '50 GB',
    backends: 'IPFS + R2 + B2 + Arweave',
    features: [
      '50 GB combined storage (all tiers)',
      'Backblaze B2 large file storage ($0.006/GB)',
      'Arweave permanent storage (one-time $0.0006/MB)',
      'Priority CDN + no auto-cleanup',
    ],
    popular: true,
    cta: 'Upgrade',
    color: '#f7931a',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$25/mo',
    storage: '500 GB',
    backends: 'All backends + Edge cache',
    features: [
      '500 GB combined storage',
      'Automatic tier optimization',
      'Arweave permanent storage (10GB included)',
      'R2 Infrequent Access for cold VODs',
      'Edge caching + analytics dashboard',
    ],
    cta: 'Upgrade',
    color: '#8a63d2',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    storage: 'Custom',
    backends: 'All + Dedicated IPFS',
    features: [
      'Custom storage limits',
      'Dedicated IPFS node',
      'Private CDN + SLA guarantees',
      'Sia/Filecoin cold archival',
      'White-glove onboarding',
    ],
    cta: 'Contact Us',
    color: '#ff4444',
  },
];
