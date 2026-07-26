/** Master video aggregators — fetch from all platform wrappers in parallel. */

import type { UnifiedLiveStream } from '../../feed/live-aggregator';
import type { Env } from '../../types';
import { getAllWrappers } from './constants';
import type { AggregatedShort, ShortsQueryOptions, UnifiedVideo, VideoQueryOptions } from './types';

export async function aggregateAllVideos(env: Env, options: VideoQueryOptions = {}): Promise<UnifiedVideo[]> {

export async function aggregateAllShorts(env: Env, options: ShortsQueryOptions = {}): Promise<AggregatedShort[]> {

export async function aggregateAllLiveStreams(env: Env): Promise<UnifiedLiveStream[]> {

