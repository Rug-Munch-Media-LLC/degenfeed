/** Telegram bot command handlers. */

import type { Env } from '../../types';
import { telegramCoinGroupKey, telegramGroupFeedKey, telegramGroupKey, telegramUserKey, telegramWalletIndex } from './constants';
import type { TelegramGroupConfig, TelegramLinkedUser } from './types';
import { sendTelegramChatAction, sendTelegramMessage } from './utils';

export async function handleBotCommand(
  botToken: string, chatId: number, userId: number, text: string, env: Env, username?: string, firstName?: string,
): Promise<Response> {
