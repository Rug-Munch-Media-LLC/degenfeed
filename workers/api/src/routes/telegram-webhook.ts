/**
 * telegram-webhook — Telegram Bot API webhook handler.
 *
 * Receives incoming Telegram updates (messages, callback queries,
 * chat member updates) and dispatches them to the command router
 * or handles group bridging logic.
 *
 * Separated from telegram.ts during de-godding.
 */

import { type Env, jsonResponse } from '../index';
import {
  handleBotCommand,
  sendTelegramMessage,
  type TelegramGroupConfig,
  type TelegramUpdate,
  telegramGroupFeedKey,
  telegramGroupKey,
} from './telegram-bot';

/**
 * POST /api/telegram/webhook
 * Receives Telegram Bot API updates and routes commands.
 */
export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return jsonResponse({ error: 'Telegram bot not configured' }, 501);

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Bot added to group → auto-create group bridge config
  if (update.my_chat_member) {
    const { chat, new_chat_member } = update.my_chat_member;
    if (new_chat_member.status === 'member' || new_chat_member.status === 'administrator') {
      const groupId = String(chat.id);
      const groupKey = telegramGroupKey(groupId);

      try {
        const existing = await env.CACHE?.get(groupKey);
        if (!existing) {
          const config: TelegramGroupConfig = {
            groupId,
            title: chat.title ?? `Group ${groupId}`,
            feedEnabled: true,
            crossPostEnabled: false,
            tippingEnabled: true,
            tokenGated: false,
            connectedAt: Date.now(),
          };
          await env.CACHE?.put(groupKey, JSON.stringify(config), {
            expirationTtl: 60 * 60 * 24 * 365,
          });

          await sendTelegramMessage(
            botToken,
            chat.id,
            '👋 <b>DegenFeed Bot is here!</b>\n\n' +
              'This group is now connected to DegenFeed.\n\n' +
              'Commands:\n' +
              '/feed — Show recent protocol posts\n' +
              '/post &lt;text&gt; — Cross-post to all protocols\n' +
              '/tip @user &lt;amount&gt; — Send Lightning tips\n' +
              '/coin &lt;symbol&gt; — Get coin stats',
          );
        }
      } catch {
        // best-effort
      }
    }
    return jsonResponse({ ok: true });
  }

  // Callback query (inline keyboard interaction)
  if (update.callback_query) {
    const { data, from, id: callbackId, message } = update.callback_query;
    if (data && message) {
      try {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ callback_query_id: callbackId }),
        });
      } catch {
        // best-effort
      }
    }
    return jsonResponse({ ok: true });
  }

  // Text message / command
  if (update.message?.text) {
    const { chat, from, text, message_id } = update.message;

    if (text.startsWith('/')) {
      return handleBotCommand(
        botToken,
        chat.id,
        from?.id ?? 0,
        text,
        env,
        from?.username,
        from?.first_name,
      );
    }

    // Group message bridging (non-command messages)
    if (chat.type === 'group' || chat.type === 'supergroup') {
      const groupId = String(chat.id);
      try {
        const groupKey = telegramGroupKey(groupId);
        const raw = await env.CACHE?.get(groupKey);
        if (raw) {
          const config = JSON.parse(raw) as TelegramGroupConfig;
          if (config.feedEnabled && config.ownerWallet) {
            const bridgePayload = {
              groupId,
              messageId: message_id,
              text,
              fromUser: from?.username ?? from?.first_name ?? 'unknown',
              timestamp: Date.now(),
            };

            await env.CACHE?.put(
              `${telegramGroupFeedKey(groupId)}:${message_id}`,
              JSON.stringify(bridgePayload),
              { expirationTtl: 86400 },
            );
          }
        }
      } catch {
        // best-effort bridging
      }
    }
  }

  return jsonResponse({ ok: true });
}
