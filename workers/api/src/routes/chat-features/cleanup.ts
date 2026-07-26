/**
 * @degenfeed/api-worker — Chat Cleanup Cron
 *
 * Called by the scheduled cron handler to clean up expired messages and files.
 */

import type { Env } from '../../types';

let _chatTimers: typeof import('../../lib/chat-timers') | null = null;
let _chatFiles: typeof import('../../lib/chat-files') | null = null;

async function getChatTimers() {
  if (!_chatTimers) _chatTimers = await import('../../lib/chat-timers');
  return _chatTimers;
}

async function getChatFiles() {
  if (!_chatFiles) _chatFiles = await import('../../lib/chat-files');
  return _chatFiles;
}

/**
 * Run cleanup of expired messages and files.
 * Called by cron every minute.
 */
export async function handleCleanupCron(
  env: Env,
): Promise<{ cleanedMessages: number; cleanedFiles: number }> {
  const { cleanupExpiredMessages } = await getChatTimers();
  const { cleanupExpiredFiles } = await getChatFiles();

  const [cleanedMessages, cleanedFiles] = await Promise.all([
    cleanupExpiredMessages(env),
    cleanupExpiredFiles(env),
  ]);

  return { cleanedMessages, cleanedFiles };
}
