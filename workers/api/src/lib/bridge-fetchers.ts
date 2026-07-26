/**
 * @degenfeed/api-worker — Cross-Protocol Bridge Source Content Fetchers
 *
 * Fetches content from each supported protocol for bridging.
 */

import type { Env } from '../types';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { SourceContent } from './bridge-types';

// ─── Reliability Helpers ───────────────────────────────────────────────

async function reliableFetch<T>(
  protocol: string,
  _context: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
