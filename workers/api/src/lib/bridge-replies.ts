/**
 * @degenfeed/api-worker — Cross-Protocol Reply Fetchers
 *
 * Fetches replies/thread context from each supported protocol.
 */

import type { Env } from '../types';
import { recordBridgeOperation, withReliability } from './bridge-reliability';
import type { CrossProtocolReply } from './bridge-types';

async function reliableBridgePublish<T>(
  protocol: string,
  operation: () => Promise<T>,
  env: Env,
): Promise<T | null> {
