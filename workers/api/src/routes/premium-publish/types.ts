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

export type QueueEntry = {}
