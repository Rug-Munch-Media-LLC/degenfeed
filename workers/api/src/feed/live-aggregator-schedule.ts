/**
 * @degenfeed/api-worker — Stream Schedule Management
 *
 * Create and retrieve scheduled streams.
 */

import { readStringArray, writeStringArray } from '../routes/live-shorts-engine';
import type { Env } from '../types';
import { creatorScheduleIndexKey, scheduleKey } from './live-aggregator-health';
import type { StreamSchedule } from './live-aggregator-types';

/**
 * Create a scheduled stream.
 */
export async function createSchedule(env: Env, schedule: StreamSchedule): Promise<StreamSchedule> {
  const ttl = Math.max(86400, Math.ceil((schedule.scheduledAt - Date.now()) / 1000) + 3600);

  await env.CACHE?.put(scheduleKey(schedule.id), JSON.stringify(schedule), {
    expirationTtl: ttl,
  });

  const creatorKey = creatorScheduleIndexKey(schedule.creatorId);
  const existing = await readStringArray(env, creatorKey);
  if (!existing.includes(schedule.id)) {
    existing.push(schedule.id);
    await writeStringArray(env, creatorKey, existing, ttl);
  }

  return schedule;
}

/**
 * Get all scheduled streams for a creator.
 */
export async function getCreatorSchedules(env: Env, creatorId: string): Promise<StreamSchedule[]> {
  const creatorKey = creatorScheduleIndexKey(creatorId);
  const ids = await readStringArray(env, creatorKey);

  const results: StreamSchedule[] = [];
  for (const id of ids) {
    try {
      const raw = await env.CACHE?.get(scheduleKey(id));
      if (raw) {
        results.push(JSON.parse(raw) as StreamSchedule);
      }
    } catch {
      // Skip corrupted
    }
  }

  return results.sort((a, b) => a.scheduledAt - b.scheduledAt);
}
