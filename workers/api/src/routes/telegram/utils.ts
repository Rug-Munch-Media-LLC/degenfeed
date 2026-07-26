/** Shared utilities for the Telegram bot module. */

import { badGateway } from '../../response-helpers';
import type { Env } from '../../types';

export async function sendTelegramMessage(
  botToken: string, chatId: number, text: string,
  options?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: Record<string, unknown>; reply_to_message_id?: number },
): Promise<Response> {
