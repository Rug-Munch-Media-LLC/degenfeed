/**
 * @degenfeed/api-worker — Premium Publish Utils
 */

import type { Env } from '../index';
import type { QueueEntry, QueueStatus } from './types';
import { PREFIX_QUEUE } from './types';

export async function getQueueEntry(
  env: Env,
  walletAddress: string,
  id: string,
): Promise<QueueEntry | null> {
  if (!env.CACHE) return null;
  try {
    const raw = await env.CACHE.get(`${PREFIX_QUEUE}${walletAddress}:${id}`, 'json');
    return raw as QueueEntry | null;
  } catch {
    return null;
  }
}

export async function listQueueEntries(
  env: Env,
  walletAddress: string,
  statusFilter: QueueStatus | null,
  limit: number,
  cursor?: string,
): Promise<{ entries: QueueEntry[]; nextCursor?: string }> {
  const entries: QueueEntry[] = [];
  if (!env.CACHE) return { entries };
  try {
    const page = await env.CACHE.list({ prefix: `${PREFIX_QUEUE}${walletAddress}:`, cursor, limit });
    for (const key of page.keys) {
      const raw = await env.CACHE.get(key.name, 'json');
      if (!raw) continue;
      const entry = raw as QueueEntry;
      if (statusFilter && entry.status !== statusFilter) continue;
      entries.push(entry);
    }
    entries.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return { entries, nextCursor: page.list_complete ? undefined : page.cursor };
  } catch {
    return { entries };
  }
}

export async function listAllQueueEntries(env: Env, walletAddress: string): Promise<QueueEntry[]> {
  const entries: QueueEntry[] = [];
  if (!env.CACHE) return entries;
  try {
    let cursor: string | undefined;
    do {
      const page = await env.CACHE.list({ prefix: `${PREFIX_QUEUE}${walletAddress}:`, cursor, limit: 100 });
      for (const key of page.keys) {
        const raw = await env.CACHE.get(key.name, 'json');
        if (raw) entries.push(raw as QueueEntry);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch { /* partial results */ }
  return entries;
}

export async function getNextQueuePosition(walletAddress: string, env: Env): Promise<number> {
  try {
    const all = await listAllQueueEntries(env, walletAddress);
    return all.length;
  } catch {
    return 0;
  }
}

export async function getUserTier(walletAddress: string, env: Env): Promise<string> {
  try {
    const { checkPremiumStatus } = await import('../premium');
    const status = await checkPremiumStatus(walletAddress, env);
    return status?.tier ?? 'basic';
  } catch {
    return 'basic';
  }
}

export function getNextDateForDayAndHour(dayOfWeek: number, hourUTC: number): Date {
  const now = new Date();
  const currentDay = now.getUTCDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  const result = new Date(now);
  result.setUTCDate(result.getUTCDate() + daysUntil);
  result.setUTCHours(hourUTC, 0, 0, 0);
  return result;
}

export function calculateNextRecurrence(entry: QueueEntry): string {
  const lastDate = entry.scheduledAt ? new Date(entry.scheduledAt) : new Date();
  let next: Date;
  switch (entry.recurrence) {
    case 'daily':
      next = new Date(lastDate.getTime() + 86400_000);
      break;
    case 'weekly':
      next = new Date(lastDate.getTime() + 7 * 86400_000);
      break;
    case 'monthly':
      next = new Date(lastDate);
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'weekdays': {
      next = new Date(lastDate.getTime() + 86400_000);
      while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
        next = new Date(next.getTime() + 86400_000);
      }
      break;
    }
    default:
      next = new Date(lastDate.getTime() + 7 * 86400_000);
  }
  if (entry.recurrenceEnd && next > new Date(entry.recurrenceEnd)) {
    return lastDate.toISOString();
  }
  return next.toISOString();
}

export function calculateNextEvergreenRepost(entry: QueueEntry): string {
  const lastRepost = entry.lastRepostedAt ? new Date(entry.lastRepostedAt) : new Date();
  let intervalDays: number;
  switch (entry.evergreenFrequency) {
    case 'every-7d': intervalDays = 7; break;
    case 'every-14d': intervalDays = 14; break;
    case 'every-30d': intervalDays = 30; break;
    case 'every-90d': intervalDays = 90; break;
    default: intervalDays = 30;
  }
  return new Date(lastRepost.getTime() + intervalDays * 86400_000).toISOString();
}

export function getRecurringEntriesForDate(entries: QueueEntry[], date: Date): QueueEntry[] {
  const dayOfWeek = date.getUTCDay();
  return entries.filter((e) => {
    if (!e.recurrence) return false;
    if (e.status !== 'scheduled' && e.status !== 'published') return false;
    switch (e.recurrence) {
      case 'daily': return true;
      case 'weekdays': return dayOfWeek !== 0 && dayOfWeek !== 6;
      case 'weekly': return checkDayOfWeekMatch(e.scheduledAt, dayOfWeek);
      case 'monthly': return checkDayOfMonthMatch(e.scheduledAt, date.getUTCDate());
      default: return false;
    }
  });
}

function checkDayOfWeekMatch(scheduledAt: string | null, dayOfWeek: number): boolean {
  if (!scheduledAt) return false;
  return new Date(scheduledAt).getUTCDay() === dayOfWeek;
}

function checkDayOfMonthMatch(scheduledAt: string | null, dayOfMonth: number): boolean {
  if (!scheduledAt) return false;
  return new Date(scheduledAt).getUTCDate() === dayOfMonth;
}
