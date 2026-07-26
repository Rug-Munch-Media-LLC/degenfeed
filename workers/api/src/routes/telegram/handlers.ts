/** HTTP route handlers for Telegram bot endpoints. */

import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import { handleBotCommand } from './commands';
import { telegramCoinGroupKey, telegramGroupFeedKey, telegramGroupKey, telegramUserKey, telegramWalletIndex } from './constants';
import type { TelegramGroupConfig, TelegramLinkedUser, TelegramUpdate } from './types';
import { sendTelegramMessage, validateTelegramInitDataAsync } from './utils';

/**
 * POST /api/telegram/webhook — Receive Telegram Bot API updates
 */
export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
