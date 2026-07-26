/**
 * Who to follow — trending authors across protocols ranked by engagement.
 *
 * GET /api/discover/people
 */

import { isSpamPost } from '@degenfeed/feed-core';
import type { UnifiedPost } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handleDiscoverPeople(request: Request, env: Env): Promise<Response> {
