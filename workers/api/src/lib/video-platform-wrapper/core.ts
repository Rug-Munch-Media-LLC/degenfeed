/** Master video aggregators — fetch from all platform wrappers in parallel. */

import type { Env } from '../../index';
import type { UnifiedLiveStream } from '../../feed/live-aggregator';
import type { VideoQueryOptions, ShortsQueryOptions, UnifiedVideo, AggregatedShort } from './types';
import { getAllWrappers } from './constants';

export async function aggregateAllVideos(env: Env, options: VideoQueryOptions = {}): Promise<UnifiedVideo[]> {
  const wrappers = getAllWrappers();
  const results = await Promise.allSettled(wrappers.map((w) => w.getVideos(env, options)));
  const allVideos: UnifiedVideo[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') allVideos.push(...result.value);
  }
  allVideos.sort((a, b) => {
    if (a.views !== b.views) return b.views - a.views;
    return b.createdAt - a.createdAt;
  });
  return allVideos;
}

export async function aggregateAllShorts(env: Env, options: ShortsQueryOptions = {}): Promise<AggregatedShort[]> {
  const wrappers = getAllWrappers();
  const results = await Promise.allSettled(wrappers.map((w) => w.getShorts?.(env, options) ?? Promise.resolve([])));
  const allShorts: AggregatedShort[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') allShorts.push(...result.value);
  }
  allShorts.sort(() => Math.random() - 0.5);
  return allShorts;
}

export async function aggregateAllLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {
  const wrappers = getAllWrappers();
  const results = await Promise.allSettled(wrappers.map((w) => w.detectLiveStreams?.(env) ?? Promise.resolve([])));
  const allStreams: UnifiedLiveStream[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') allStreams.push(...result.value);
  }
  return allStreams.sort((a, b) => b.viewerCount - a.viewerCount);
}
