/**
 * @degenfeed/api-worker — Chat Polls
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

const _chatMedia: typeof import('../../lib/chat-media') | null = null;

async function getChatMedia() {
