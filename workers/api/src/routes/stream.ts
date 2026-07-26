/**
 * Real-time feed via Server-Sent Events (SSE).
 *
 * GET /api/feed/stream?protocols=nostr,farcaster&sort=hot
 *
 * Opens an SSE connection. Polls providers every 30s, deduplicates
 * against already-sent posts, and pushes new ones to the client.
 */

import { enrichPostNiches, isSpamPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { parseProtocols } from '@degenfeed/utils';
import type { Env } from '../types';
import { DEFAULT_PROTOCOLS, getProvider } from './feed';

export async function handleStreamFeed(request: Request, env: Env): Promise<Response> {
