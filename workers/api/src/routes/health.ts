import { DEFAULT_RELAYS } from '../index';
import { getQueueStats } from '../lib/offline-queue';
import { getTxMonitorStats } from '../lib/transaction-monitor';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

/**
 * GET /api/health — Legacy relay health
 */
export async function handleRelaysHealth(env: Env): Promise<Response> {
