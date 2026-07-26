/**
 * @degenfeed/api-worker — Creator Video Utilities
 */
import type { Env } from '../index';
import { type CreatorVideoMeta, type VideoAnalytics } from './types';

const VIDEOS_PREFIX = 'creator:videos:';
const PROGRESS_PREFIX = 'creator:videos:progress:';
const ANALYTICS_PREFIX = 'creator:videos:analytics:';
const LOOKUP_PREFIX = 'creator:videos:lookup:';

export function videosKey(address: string): string {
  return `${VIDEOS_PREFIX}${address.toLowerCase()}`;
}

export function progressKey(uuid: string): string {
  return `${PROGRESS_PREFIX}${uuid}`;
}

export function analyticsKey(uuid: string): string {
  return `${ANALYTICS_PREFIX}${uuid}`;
}

export function lookupKey(uuid: string): string {
  return `${LOOKUP_PREFIX}${uuid}`;
}

export async function getVideos(env: Env, address: string): Promise<CreatorVideoMeta[]> {
  try {
    const raw = await env.CONTENT_STORE?.get(videosKey(address));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function saveVideos(env: Env, address: string, videos: CreatorVideoMeta[]): Promise<void> {
  await env.CONTENT_STORE?.put(videosKey(address), JSON.stringify(videos));
}
