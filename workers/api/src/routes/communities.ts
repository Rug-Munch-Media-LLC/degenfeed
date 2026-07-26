/**
 * Community feed view — returns trending communities across
 * Reddit, Lemmy, and Farcaster channels.
 *
 * GET /api/feed/communities
 */

import { DEFAULT_SUBREDDITS, LemmyProvider } from '@degenfeed/feed-providers';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handleCommunities(_request: Request, env: Env): Promise<Response> {
