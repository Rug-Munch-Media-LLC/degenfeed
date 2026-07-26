/**
 * @degenfeed/api-worker — Chat Cleanup Cron
 *
 * Called by the scheduled cron handler to clean up expired messages and files.
 */

import type { Env } from '../../types';

const _chatTimers: typeof import('../../lib/chat-timers') | null = null;
const _chatFiles: typeof import('../../lib/chat-files') | null = null;

async function getChatTimers() {
