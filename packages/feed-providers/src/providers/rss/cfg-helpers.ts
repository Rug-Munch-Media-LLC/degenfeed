import type { RssFeedConfig } from './types';

/**
 * Compact helper for defining RSS feed configs.
 */
export function cfg(
  url: string,
  opts: {
    tier?: number;
    weight?: number;
    category?: string;
    tags?: string[];
    authority?: number;
    isPaid?: boolean;
    schedule?: 'daily' | 'weekly' | 'monthly' | 'irregular';
  } = {},
): RssFeedConfig {
  return {
    url,
    tier: opts.tier ?? 3,
    weight: opts.weight ?? 0.7,
    category: opts.category ?? 'news',
    tags: opts.tags ?? ['crypto'],
    authority: opts.authority ?? 1,
    ...(opts.isPaid !== undefined ? { isPaid: opts.isPaid } : {}),
    ...(opts.schedule !== undefined ? { schedule: opts.schedule } : {}),
  };
}
