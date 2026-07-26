/**
 * @degenfeed/api-worker — Premium Publish Types
 */

export type QueueStatus =
  | 'queued'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';
export type RecurrencePattern = 'once' | 'daily' | 'weekly' | 'monthly' | 'weekdays';
export type RecyclingStrategy = 'engagement' | 'age' | 'manual';
export type EvergreenFrequency = 'every-7d' | 'every-14d' | 'every-30d' | 'every-90d';

export interface QueueEntry {
  id: string;
  walletAddress: string;
  masterPost: import('@degenfeed/cross-protocol-bridge').MasterPost;
  protocols: string[];
  scheduledAt: string | null;
  status: QueueStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
  recurrence?: RecurrencePattern;
  recurrenceEnd?: string;
  recurrenceCount?: number;
  isEvergreen?: boolean;
  evergreenFrequency?: EvergreenFrequency;
  lastRepostedAt?: string;
  recyclingStrategy?: RecyclingStrategy;
  minEngagementScore?: number;
  autoThread?: boolean;
  thread?: import('../lib/auto-formatter').ThreadSegment[];
  aiOptimizedTime?: string;
  aiOptimized?: boolean;
  results?: Record<string, { success: boolean; error?: string; nativeId?: string }>;
  error?: string;
}

export interface BatchPublishEntry {
  text: string;
  title?: string;
  hashtags?: string[];
  scheduledAt?: string;
  protocols?: string[];
}

export interface CalendarDay {
  date: string;
  entries: QueueEntry[];
  count: number;
}

// ─── KV Key Prefixes ──────────────────────────────────────────────────────

export const PREFIX_QUEUE = 'premium:queue:';
export const PREFIX_EVERGREEN = 'premium:evergreen:';
export const PREFIX_RECURRING = 'premium:recurring:';
export const _PREFIX_USAGE = 'premium:usage:';
