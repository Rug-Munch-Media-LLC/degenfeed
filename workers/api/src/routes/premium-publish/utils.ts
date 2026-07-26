/**
 * @degenfeed/api-worker — Premium Publish Utils
 */

import type { Env } from '../types';
import type { QueueEntry, QueueStatus } from './types';
import { PREFIX_QUEUE } from './types';

export async function getQueueEntry(
  env: Env,
  walletAddress: string,
  id: string,
): Promise<QueueEntry | null> {
