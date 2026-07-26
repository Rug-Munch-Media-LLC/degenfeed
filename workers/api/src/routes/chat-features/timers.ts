/**
 * @degenfeed/api-worker — Conversation Timers (auto-delete)
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

const _chatTimers: typeof import('../../lib/chat-timers') | null = null;

async function getChatTimers() {
