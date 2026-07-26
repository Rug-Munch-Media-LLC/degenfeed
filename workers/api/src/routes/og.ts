/**
 * OG share embed — returns HTML with OpenGraph meta tags for a post.
 * When pasted into Discord/Twitter/Telegram, shows a rich preview card.
 *
 * GET /api/feed/post/:id?format=og
 */

import type { UnifiedPost } from '@degenfeed/types';
import { badRequest, ok } from '../response-helpers';
import type { Env } from '../types';

export async function handlePostOg(_request: Request, env: Env, postId: string): Promise<Response> {
