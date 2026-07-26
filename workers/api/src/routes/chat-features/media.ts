/**
 * @degenfeed/api-worker — Chat Media, GIFs, Link Previews, Stickers
 */

import { log } from '../../logger';
import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

const _chatMedia: typeof import('../../lib/chat-media') | null = null;

async function getChatMedia() {
