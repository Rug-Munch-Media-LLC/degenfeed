/**
 * @degenfeed/api-worker — PeerTube Utils
 */

import type { Env } from '../../types';
import type { PeerTubeChannel, PeerTubeVideo } from './types';
import { PEERTUBE_CATEGORIES } from './types';

export async function getPeerTubeClient(env: Env): Promise<{ instanceUrl: string; accessToken: string }> {
