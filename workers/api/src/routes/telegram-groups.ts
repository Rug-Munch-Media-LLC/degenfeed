/**
 * telegram-groups — Telegram group management routes.
 *
 * Group configuration, coin linking, chat listing, and
 * group info endpoints for DegenFeed's Telegram integration.
 *
 * Separated from telegram.ts during de-godding.
 */

import { type Env, jsonResponse } from '../index';
import { requireSession } from '../session';
import {
  type TelegramGroupConfig,
  type TelegramLinkedUser,
  telegramCoinGroupKey,
  telegramGroupKey,
  telegramUserKey,
  telegramWalletIndex,
} from './telegram-bot';

// ─── List Telegram chats ─────────────────────────────────────────────────

/**
 * GET /api/telegram/chats
 * Lists Telegram groups/channels that the bot is a member of.
 * Optionally filter by coin symbol.
 *
 * Query: ?symbol=DEGEN (optional)
 */
export async function handleTelegramChats(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

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
      const groupKey = telegramCoinGroupKey(symbol);
      const raw = await env.CACHE?.get(groupKey);
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
        const userRaw = await env.CACHE?.get(telegramUserKey(tgId));
        if (userRaw) {
          const _user = JSON.parse(userRaw) as TelegramLinkedUser;
          for (const coinSymbol of [
            'DEGEN',
            'PEPE',
            'MOCHI',
            'RUG',
            'WAGMI',
            'GM',
            'LFG',
            'MOON',
          ]) {
            const cgKey = telegramCoinGroupKey(coinSymbol);
            const cgRaw = await env.CACHE?.get(cgKey);
            if (cgRaw) {
              const config = JSON.parse(cgRaw) as TelegramGroupConfig;
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
    }

    return jsonResponse({ groups, count: groups.length });
  } catch {
    return jsonResponse({ error: 'Failed to list chats' }, 500);
  }
}

// ─── Group coin linking ───────────────────────────────────────────────────

/**
 * POST /api/telegram/groups/:groupId/link
 * Links a Telegram group to a creator coin.
 *
 * Body: { symbol: string, title?: string }
 */
export async function handleTelegramGroupLink(
  request: Request,
  env: Env,
  groupId?: string,
): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!groupId) {
    return jsonResponse({ error: 'groupId parameter is required' }, 400);
  }

  let body: { symbol?: string; title?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.symbol) {
    return jsonResponse({ error: 'symbol is required' }, 400);
  }

  const symbol = body.symbol.toUpperCase();

  try {
    const groupKey = telegramGroupKey(groupId);
    const coinGroupKey = telegramCoinGroupKey(symbol);

    const existingRaw = await env.CACHE?.get(groupKey);
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

    await env.CACHE?.put(groupKey, JSON.stringify(existing), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    await env.CACHE?.put(
      coinGroupKey,
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

// ─── Get Telegram groups for a coin ──────────────────────────────────────

/**
 * GET /api/telegram/groups
 * Returns Telegram group data for a given coin symbol.
 * Query: ?symbol=DEGEN
 */
export async function handleTelegramGetGroups(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol')?.toUpperCase();

  if (!symbol) {
    return jsonResponse({ error: 'symbol query parameter is required' }, 400);
  }

  try {
    const coinGroupKey = telegramCoinGroupKey(symbol);
    const raw = await env.CACHE?.get(coinGroupKey);

    if (!raw) {
      return jsonResponse({ group: null });
    }

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
          if (mcData.ok && mcData.result) {
            memberCount = mcData.result;
          }
        }
      } catch {
        // Best-effort
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
