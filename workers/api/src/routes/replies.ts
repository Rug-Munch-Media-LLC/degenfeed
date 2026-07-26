/**
 * Thread/reply view — fetch replies for a post from its native protocol.
 *
 * GET /api/feed/post/:id/replies
 */

import type { UnifiedPost } from '@degenfeed/types';
import { jsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handlePostReplies(
  request: Request,
  env: Env,
  postId: string,
): Promise<Response> {
