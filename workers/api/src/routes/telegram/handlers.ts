/** HTTP route handlers for Telegram bot endpoints. */

import { jsonResponse, methodNotAllowed } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';
import { handleBotCommand } from './commands';
import {
  telegramCoinGroupKey,
  telegramGroupFeedKey,
  telegramGroupKey,
  telegramUserKey,
  telegramWalletIndex,
} from './constants';
import type { TelegramGroupConfig, TelegramLinkedUser, TelegramUpdate } from './types';
import { sendTelegramMessage, validateTelegramInitDataAsync } from './utils';

/**
 * POST /api/telegram/webhook — Receive Telegram Bot API updates
 */
export async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return jsonResponse({ error: 'Telegram bot not configured' }, 501);

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  // Bot added to group
  if (update.my_chat_member) {
    const { chat, new_chat_member } = update.my_chat_member;
    if (new_chat_member.status === 'member' || new_chat_member.status === 'administrator') {
      const groupId = String(chat.id);
      try {
        const existing = await env.CACHE?.get(telegramGroupKey(groupId));
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
          await env.CACHE?.put(telegramGroupKey(groupId), JSON.stringify(config), {
            expirationTtl: 60 * 60 * 24 * 365,
          });
          await sendTelegramMessage(
            botToken,
            chat.id,
            '👋 <b>DegenFeed Bot is here!</b>\n\nThis group is now connected to DegenFeed.\n\nCommands:\n/feed — Show recent protocol posts\n/post &lt;text&gt; — Cross-post\n/tip @user &lt;amount&gt; — Send Lightning tips\n/coin &lt;symbol&gt; — Get coin stats',
          );
        }
      } catch {
        /* best-effort */
      }
    }
    return jsonResponse({ ok: true });
  }

  // Callback query
  if (update.callback_query) {
    const { id: callbackId } = update.callback_query;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId }),
      });
    } catch {
      /* best-effort */
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
    // Group message bridging
    if (chat.type === 'group' || chat.type === 'supergroup') {
      try {
        const raw = await env.CACHE?.get(telegramGroupKey(String(chat.id)));
        if (raw) {
          const config = JSON.parse(raw) as TelegramGroupConfig;
          if (config.feedEnabled && config.ownerWallet) {
            await env.CACHE?.put(
              `${telegramGroupFeedKey(String(chat.id))}:${message_id}`,
              JSON.stringify({
                groupId: String(chat.id),
                messageId: message_id,
                text,
                fromUser: from?.username ?? from?.first_name ?? 'unknown',
                timestamp: Date.now(),
              }),
              { expirationTtl: 86400 },
            );
          }
        }
      } catch {
        /* best-effort bridging */
      }
    }
  }

  return jsonResponse({ ok: true });
}

/**
 * GET /api/telegram/link — Generate Telegram deep link
 */
export async function handleTelegramGenerateLink(request: Request, env: Env): Promise<Response> {
  const botName = env.TELEGRAM_BOT_NAME ?? 'DegenFeedBot';
  const url = new URL(request.url);
  const startParam = url.searchParams.get('start') ?? 'app';
  const deepLink = `https://t.me/${botName}?start=${encodeURIComponent(startParam)}`;
  return jsonResponse({
    deepLink,
    botUsername: botName,
    webLink: `https://t.me/${botName}`,
    qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(deepLink)}`,
  });
}

/**
 * POST /api/telegram/send — Send message via bot (server-side)
 */
export async function handleTelegramSend(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return jsonResponse({ error: 'Telegram bot not configured' }, 501);
  let body: { chatId?: number; text?: string; parseMode?: 'HTML' | 'Markdown' };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.chatId || !body.text) return jsonResponse({ error: 'chatId and text required' }, 400);
  const result = await sendTelegramMessage(botToken, body.chatId, body.text, {
    parse_mode: body.parseMode,
  });
  const resultBody = await result.json().catch(() => ({}));
  return jsonResponse({ ok: result.ok, result: resultBody });
}

/**
 * GET /api/telegram/bot-info — Get bot name and username
 */
export async function handleTelegramBotInfo(_request: Request, env: Env): Promise<Response> {
  return jsonResponse({
    botName: env.TELEGRAM_BOT_NAME ?? 'DegenFeedBot',
    configured: !!env.TELEGRAM_BOT_TOKEN,
    hasBotToken: !!env.TELEGRAM_BOT_TOKEN,
  });
}

/**
 * POST /api/telegram/link-account — Link Telegram account to wallet
 */
export async function handleTelegramLinkAccount(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  let body: { telegramId?: string; username?: string; firstName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.telegramId) return jsonResponse({ error: 'telegramId required' }, 400);
  try {
    const user: TelegramLinkedUser = {
      telegramId: body.telegramId,
      wallet: session.address,
      username: body.username,
      firstName: body.firstName,
      linkedAt: Date.now(),
      preferences: {
        priceAlerts: true,
        mentionAlerts: true,
        feedAlerts: false,
        tipNotifications: true,
      },
    };
    await env.CACHE?.put(telegramUserKey(body.telegramId), JSON.stringify(user), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(telegramWalletIndex(session.address), body.telegramId, {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    return jsonResponse({ ok: true, telegramId: body.telegramId });
  } catch {
    return jsonResponse({ error: 'Failed to link account' }, 500);
  }
}

/**
 * GET /api/telegram/linked — Get linked Telegram account info
 */
export async function handleTelegramGetLinked(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  try {
    const tgId = await env.CACHE?.get(telegramWalletIndex(session.address));
    if (!tgId) return jsonResponse({ linked: false });
    const raw = await env.CACHE?.get(telegramUserKey(tgId));
    if (!raw) return jsonResponse({ linked: false });
    const user = JSON.parse(raw) as TelegramLinkedUser;
    return jsonResponse({
      linked: true,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      linkedAt: user.linkedAt,
      preferences: user.preferences,
    });
  } catch {
    return jsonResponse({ linked: false, error: 'Failed to check' });
  }
}

/**
 * DELETE /api/telegram/link-account — Unlink Telegram account
 */
export async function handleTelegramUnlinkAccount(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return methodNotAllowed(['DELETE']);
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  try {
    const tgId = await env.CACHE?.get(telegramWalletIndex(session.address));
    if (tgId) {
      await env.CACHE?.delete(telegramUserKey(tgId));
      await env.CACHE?.delete(telegramWalletIndex(session.address));
    }
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to unlink' }, 500);
  }
}

/**
 * POST /api/telegram/auth — Verify Telegram login widget data
 */
export async function handleTelegramAuth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return jsonResponse({ error: 'Telegram bot not configured' }, 501);
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  let body: { initData?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.initData) return jsonResponse({ error: 'initData is required' }, 400);
  const isValid = await validateTelegramInitDataAsync(body.initData, botToken);
  if (!isValid) return jsonResponse({ error: 'Invalid Telegram authentication data' }, 403);
  const params = new URLSearchParams(body.initData);
  const userRaw = params.get('user');
  if (!userRaw) return jsonResponse({ error: 'No user data in init data' }, 400);
  let tgUser: { id: number; username?: string; first_name?: string };
  try {
    tgUser = JSON.parse(userRaw) as typeof tgUser;
  } catch {
    return jsonResponse({ error: 'Invalid user data' }, 400);
  }
  const telegramId = String(tgUser.id);
  try {
    const existing = await env.CACHE?.get(telegramUserKey(telegramId));
    if (existing) {
      const user = JSON.parse(existing) as TelegramLinkedUser;
      if (user.wallet === session.address)
        return jsonResponse({ ok: true, alreadyLinked: true, telegramId });
    }
    const linkedUser: TelegramLinkedUser = {
      telegramId,
      wallet: session.address,
      username: tgUser.username,
      firstName: tgUser.first_name,
      linkedAt: Date.now(),
      preferences: {
        priceAlerts: true,
        mentionAlerts: true,
        feedAlerts: false,
        tipNotifications: true,
      },
    };
    await env.CACHE?.put(telegramUserKey(telegramId), JSON.stringify(linkedUser), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(telegramWalletIndex(session.address), telegramId, {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    return jsonResponse({
      ok: true,
      telegramId,
      username: tgUser.username,
      firstName: tgUser.first_name,
    });
  } catch {
    return jsonResponse({ error: 'Failed to link Telegram account' }, 500);
  }
}

/**
 * GET /api/telegram/chats — List user's Telegram groups
 */
export async function handleTelegramChats(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol')?.toUpperCase();
  try {
    const groups: Array<{
      groupId: string;
      title: string;
      coinSymbol?: string;
      memberCount?: number;
      feedEnabled: boolean;
    }> = [];
    if (symbol) {
      const raw = await env.CACHE?.get(telegramCoinGroupKey(symbol));
      if (raw) {
        const config = JSON.parse(raw) as TelegramGroupConfig;
        groups.push({
          groupId: config.groupId,
          title: config.title,
          coinSymbol: config.coinSymbol,
          feedEnabled: config.feedEnabled,
        });
      }
    } else {
      const tgId = await env.CACHE?.get(telegramWalletIndex(session.address));
      if (tgId) {
        for (const coinSymbol of ['DEGEN', 'PEPE', 'MOCHI', 'RUG', 'WAGMI', 'GM', 'LFG', 'MOON']) {
          const raw = await env.CACHE?.get(telegramCoinGroupKey(coinSymbol));
          if (raw) {
            const config = JSON.parse(raw) as TelegramGroupConfig;
            groups.push({
              groupId: config.groupId,
              title: config.title,
              coinSymbol: config.coinSymbol,
              feedEnabled: config.feedEnabled,
            });
          }
        }
      }
    }
    return jsonResponse({ groups, count: groups.length });
  } catch {
    return jsonResponse({ error: 'Failed to list chats' }, 500);
  }
}

/**
 * POST /api/telegram/groups/:groupId/link — Link group to creator coin
 */
export async function handleTelegramGroupLink(
  request: Request,
  env: Env,
  groupId?: string,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  if (!groupId) return jsonResponse({ error: 'groupId parameter is required' }, 400);
  let body: { symbol?: string; title?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }
  if (!body.symbol) return jsonResponse({ error: 'symbol is required' }, 400);
  const symbol = body.symbol.toUpperCase();
  try {
    const existingRaw = await env.CACHE?.get(telegramGroupKey(groupId));
    const existing: TelegramGroupConfig = existingRaw
      ? (JSON.parse(existingRaw) as TelegramGroupConfig)
      : {
          groupId,
          title: body.title ?? `Group ${groupId}`,
          feedEnabled: true,
          crossPostEnabled: false,
          tippingEnabled: true,
          tokenGated: false,
          connectedAt: Date.now(),
        };
    existing.coinSymbol = symbol;
    existing.ownerWallet = session.address;
    await env.CACHE?.put(telegramGroupKey(groupId), JSON.stringify(existing), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(
      telegramCoinGroupKey(symbol),
      JSON.stringify({
        groupId,
        title: existing.title,
        coinSymbol: symbol,
        ownerWallet: session.address,
        feedEnabled: existing.feedEnabled,
        tippingEnabled: existing.tippingEnabled,
        tokenGated: existing.tokenGated,
        connectedAt: Date.now(),
      }),
      { expirationTtl: 60 * 60 * 24 * 365 },
    );
    return jsonResponse({ ok: true, groupId, symbol, title: existing.title });
  } catch {
    return jsonResponse({ error: 'Failed to link group to coin' }, 500);
  }
}

/**
 * GET /api/telegram/groups — Get Telegram group for a coin
 */
export async function handleTelegramGetGroups(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol')?.toUpperCase();
  if (!symbol) return jsonResponse({ error: 'symbol query parameter is required' }, 400);
  try {
    const raw = await env.CACHE?.get(telegramCoinGroupKey(symbol));
    if (!raw) return jsonResponse({ group: null });
    const config = JSON.parse(raw) as TelegramGroupConfig;
    let memberCount: number | undefined;
    const botToken = env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      try {
        const mcRes = await fetch(`https://api.telegram.org/bot${botToken}/getChatMemberCount`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: config.groupId }),
        });
        if (mcRes.ok) {
          const mcData = (await mcRes.json()) as { ok: boolean; result?: number };
          if (mcData.ok && mcData.result) memberCount = mcData.result;
        }
      } catch {
        /* best-effort */
      }
    }
    return jsonResponse({
      group: {
        groupId: config.groupId,
        title: config.title,
        inviteLink: config.coinSymbol
          ? `https://t.me/${config.coinSymbol.toLowerCase()}_community`
          : undefined,
        memberCount,
        feedEnabled: config.feedEnabled,
        tokenGated: config.tokenGated,
        minHoldRequirement: config.minHoldRequirement,
      },
    });
  } catch {
    return jsonResponse({ error: 'Failed to get group information' }, 500);
  }
}
