import type { Env } from '../index';
import type { FeddyCategory, MemberRole, ReportCategory, AutocompleteResult } from './feddy-types';

export const VALID_CATEGORIES: FeddyCategory[] = [
  'crypto',
  'tech',
  'art',
  'music',
  'gaming',
  'sports',
  'food',
  'travel',
  'fashion',
  'health',
  'education',
  'finance',
  'science',
  'literature',
  'film',
  'general',
];

export const VALID_CATEGORIES_SET = new Set<string>(VALID_CATEGORIES);

export const CATEGORY_META: Record<FeddyCategory, { emoji: string; label: string }> = {
  crypto: { emoji: '₿', label: 'Crypto' },
  tech: { emoji: '💻', label: 'Tech' },
  art: { emoji: '🎨', label: 'Art' },
  music: { emoji: '🎵', label: 'Music' },
  gaming: { emoji: '🎮', label: 'Gaming' },
  sports: { emoji: '⚽', label: 'Sports' },
  food: { emoji: '🍕', label: 'Food' },
  travel: { emoji: '✈️', label: 'Travel' },
  fashion: { emoji: '👗', label: 'Fashion' },
  health: { emoji: '💪', label: 'Health' },
  education: { emoji: '📚', label: 'Education' },
  finance: { emoji: '💰', label: 'Finance' },
  science: { emoji: '🔬', label: 'Science' },
  literature: { emoji: '📖', label: 'Literature' },
  film: { emoji: '🎬', label: 'Film' },
  general: { emoji: '🌐', label: 'General' },
};

export const REPORT_CATEGORIES: ReportCategory[] = [
  'spam',
  'harassment',
  'hate_speech',
  'violence',
  'nsfw',
  'impersonation',
  'copyright',
  'scam',
  'other',
];

export const VALID_SORT_OPTIONS = ['members', 'newest', 'trending', 'posts'] as const;
export type SortOption = (typeof VALID_SORT_OPTIONS)[number];

export const PREMIUM_FEATURES = {
  unlimitedProtocols: true,
  creatorCoins: true,
  customVesting: true,
  feddyCommunities: true,
  communityDirectory: true,
  communityCoin: true,
  customDomain: true,
  analytics: true,
  scheduledPosts: true,
  modTools: true,
  joinCommunities: true,
  browseDirectory: true,
  tipInCommunities: true,
} as const;

// ─── Extended role hierarchy ────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  owner: 100,
  moderator: 80,
  contributor: 60,
  vip: 40,
  og: 30,
  member: 10,
};

export const ROLE_BADGE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  moderator: 'Mod',
  contributor: 'Contributor',
  vip: 'VIP',
  og: 'OG Member',
  member: 'Member',
};

export const ROLE_BADGE_COLORS: Record<MemberRole, string> = {
  owner: 'text-amber-400 bg-amber-500/15',
  moderator: 'text-blue-400 bg-blue-500/15',
  contributor: 'text-green-400 bg-green-500/15',
  vip: 'text-purple-400 bg-purple-500/15',
  og: 'text-orange-400 bg-orange-500/15',
  member: 'text-[var(--color-muted)] bg-[var(--color-overlay)]',
};

// ─── KV helpers ─────────────────────────────────────────────────────────

export function k(...parts: string[]): string {
  return parts.join(':');
}

export function getStore(env: Env): KVNamespace {
  if (!env.FEDDY) throw new Error('FEDDY KV namespace not bound');
  return env.FEDDY;
}



export function generateCommunityId(): string {
  return crypto.randomUUID();
}

export function validateCommunityName(name: string): string | null {
  const cleaned = name.toLowerCase().trim();
  if (!/^[a-z0-9-]{3,30}$/.test(cleaned)) return null;
  if (cleaned.startsWith('-') || cleaned.endsWith('-')) return null;
  if (/--/.test(cleaned)) return null;
  return cleaned;
}

export function buildGtsHandle(name: string): string {
  return `@${name}@communities.degenfeed.xyz`;
}

/** Generate a random hex string for secrets/tokens */
export function generateSecret(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Simple hash for API key storage (not cryptographic — use SHA-256 in production) */
export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
