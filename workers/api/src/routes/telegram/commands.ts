/** Telegram bot command handlers. */

import type { Env } from '../../types';
import {
  telegramCoinGroupKey,
  telegramGroupFeedKey,
  telegramGroupKey,
  telegramUserKey,
  telegramWalletIndex,
} from './constants';
import type { TelegramGroupConfig, TelegramLinkedUser } from './types';
import { sendTelegramChatAction, sendTelegramMessage } from './utils';

export async function handleBotCommand(
  botToken: string,
  chatId: number,
  userId: number,
  text: string,
  env: Env,
  username?: string,
  firstName?: string,
): Promise<Response> {
  const parts = text.split(/\s+/);
  const command = parts[0]?.toLowerCase() ?? '';
  const args = parts.slice(1);

  await sendTelegramChatAction(botToken, chatId, 'typing');

  switch (command) {
    case '/start':
      return cmdStart(botToken, chatId, env);
    case '/link':
      return cmdLink(botToken, chatId, userId, args, env, username, firstName);
    case '/coin':
      return cmdCoin(botToken, chatId, args, env);
    case '/price':
      return cmdPrice(botToken, chatId, args, env);
    case '/buy':
      return cmdBuy(botToken, chatId, args, env);
    case '/sell':
      return cmdSell(botToken, chatId, args, env);
    case '/holders':
      return cmdHolders(botToken, chatId, args, env);
    case '/leaderboard':
      return cmdLeaderboard(botToken, chatId, args, env);
    case '/feed':
      return cmdFeed(botToken, chatId, args, env, userId);
    case '/post':
      return cmdPost(botToken, chatId, userId, args, env);
    case '/alerts':
      return cmdAlerts(botToken, chatId, userId, args, env);
    case '/alert':
      return cmdAlert(botToken, chatId, userId, args, env);
    case '/community':
      return cmdCommunity(botToken, chatId, args, env);
    case '/tip':
      return cmdTip(botToken, chatId, userId, args, env);
    default: {
      if (command.startsWith('/')) {
        return sendTelegramMessage(
          botToken,
          chatId,
          `Unknown command. Try /start to see available commands.`,
        );
      }
      const { jsonResponse } = await import('../../index');
      return jsonResponse({ ok: true, handled: false });
    }
  }
}

async function cmdStart(botToken: string, chatId: number, env: Env): Promise<Response> {
  const botName = env.TELEGRAM_BOT_NAME ?? 'DegenFeedBot';
  const welcome = `🚀 <b>Welcome to DegenFeed!</b>\n\nThe cross-protocol Web3 social hub.\n\n<b>Commands:</b>\n/link &lt;wallet&gt; — Link your wallet\n/coin &lt;symbol&gt; — Get creator coin stats\n/buy &lt;symbol&gt; &lt;amount&gt; — Buy creator coin\n/sell &lt;symbol&gt; &lt;amount&gt; — Sell creator coin\n/feed — Latest posts\n/post &lt;text&gt; — Cross-post\n/alerts — Configure alerts\n/community &lt;symbol&gt; — Join coin group\n/tip @user &lt;amount&gt; — Send tip\n\n👉 <a href="https://t.me/${botName}?start=app">Open in DegenFeed</a>\n🌐 <a href="https://degenfeed.xyz">DegenFeed Web</a>`;
  return sendTelegramMessage(botToken, chatId, welcome);
}

async function cmdLink(
  botToken: string,
  chatId: number,
  userId: number,
  args: string[],
  env: Env,
  username?: string,
  firstName?: string,
): Promise<Response> {
  const wallet = args[0];
  if (!wallet || (!wallet.startsWith('0x') && !wallet.startsWith('0x'))) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /link &lt;wallet_address&gt;\nExample: <code>/link 0x1234...5678</code>',
    );
  }
  const cleanWallet = wallet.toLowerCase();
  const userKey = telegramUserKey(String(userId));
  const walletKey = telegramWalletIndex(cleanWallet);
  try {
    const existing = await env.CACHE?.get(userKey);
    if (existing) {
      const user = JSON.parse(existing) as TelegramLinkedUser;
      if (user.wallet === cleanWallet) {
        return sendTelegramMessage(
          botToken,
          chatId,
          '✅ Wallet already linked to this Telegram account.',
        );
      }
    }
    const user: TelegramLinkedUser = {
      telegramId: String(userId),
      wallet: cleanWallet,
      username,
      firstName,
      linkedAt: Date.now(),
      preferences: {
        priceAlerts: true,
        mentionAlerts: true,
        feedAlerts: false,
        tipNotifications: true,
      },
    };
    await env.CACHE?.put(userKey, JSON.stringify(user), { expirationTtl: 60 * 60 * 24 * 365 });
    await env.CACHE?.put(walletKey, String(userId), { expirationTtl: 60 * 60 * 24 * 365 });
    return sendTelegramMessage(
      botToken,
      chatId,
      `✅ Wallet <code>${cleanWallet.slice(0, 8)}...${cleanWallet.slice(-6)}</code> linked! Use /coin to check coin prices.`,
    );
  } catch {
    return sendTelegramMessage(botToken, chatId, '❌ Failed to link wallet. Please try again.');
  }
}

async function cmdCoin(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /coin &lt;SYMBOL&gt;\nExample: <code>/coin DEGEN</code>',
    );
  const coinUrl = `https://degenfeed.xyz/c/${symbol.toLowerCase()}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `<b>${symbol}</b>\n\nPrice, holders, and more: <a href="${coinUrl}">View on DegenFeed</a>`,
  );
}

async function cmdPrice(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /price &lt;SYMBOL&gt;\nExample: <code>/price DEGEN</code>',
    );
  const priceUrl = `https://degenfeed.xyz/c/${symbol.toLowerCase()}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `<b>${symbol} Price</b>\n\nView live price: <a href="${priceUrl}">DegenFeed / ${symbol}</a>`,
  );
}

async function cmdBuy(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /buy &lt;SYMBOL&gt; [amount]\nExample: <code>/buy DEGEN 100</code>',
    );
  const amount = args[1];
  const buyLink = amount
    ? `https://degenfeed.xyz/c/${symbol.toLowerCase()}?buy=${amount}`
    : `https://degenfeed.xyz/c/${symbol.toLowerCase()}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `📈 <b>Buy ${symbol}</b>\n\nClick to buy <b>${symbol}</b>${amount ? ` (${amount} tokens)` : ''}:\n🔗 <a href="${buyLink}">Open Buy Page</a>`,
  );
}

async function cmdSell(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /sell &lt;SYMBOL&gt; [amount]\nExample: <code>/sell DEGEN 50</code>',
    );
  const amount = args[1];
  const sellLink = amount
    ? `https://degenfeed.xyz/c/${symbol.toLowerCase()}?sell=${amount}`
    : `https://degenfeed.xyz/c/${symbol.toLowerCase()}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `📤 <b>Sell ${symbol}</b>\n\nClick to sell <b>${symbol}</b>${amount ? ` (${amount} tokens)` : ''}:\n🔗 <a href="${sellLink}">Open Sell Page</a>`,
  );
}

async function cmdHolders(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol) return sendTelegramMessage(botToken, chatId, '❌ Usage: /holders &lt;SYMBOL&gt;');
  return sendTelegramMessage(
    botToken,
    chatId,
    `<b>${symbol} Holders</b>\n\nView holders: <a href="https://degenfeed.xyz/c/${symbol.toLowerCase()}">DegenFeed / ${symbol}</a>`,
  );
}

async function cmdLeaderboard(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(botToken, chatId, '❌ Usage: /leaderboard &lt;SYMBOL&gt;');
  return sendTelegramMessage(
    botToken,
    chatId,
    `<b>${symbol} Leaderboard</b>\n\nTop holders: <a href="https://degenfeed.xyz/c/${symbol.toLowerCase()}/holders">DegenFeed Leaderboard</a>`,
  );
}

async function cmdFeed(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
  _userId: number,
): Promise<Response> {
  const protocol = args[0]?.toLowerCase();
  const validProtocols = ['farcaster', 'lens', 'nostr', 'bluesky', 'mastodon', 'rss'];
  let feedUrl = 'https://degenfeed.xyz/feed';
  if (protocol && validProtocols.includes(protocol))
    feedUrl = `https://degenfeed.xyz/feed/${protocol}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `📰 <b>DegenFeed</b>\n\n${protocol ? `Showing feed for <b>${protocol}</b>\n` : 'Your connected protocol feed\n'}━━━━━━━\nOpen DegenFeed to see your full feed:\n🔗 <a href="${feedUrl}">Open Feed ↗</a>\n\n💡 Tip: Use /feed &lt;protocol&gt; to filter`,
  );
}

async function cmdPost(
  botToken: string,
  chatId: number,
  _userId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const text = args.join(' ');
  if (!text || text.length < 1)
    return sendTelegramMessage(botToken, chatId, '❌ Usage: /post &lt;your message&gt;');
  if (text.length > 5000)
    return sendTelegramMessage(botToken, chatId, '❌ Message too long (max 5000 characters).');
  const encoded = encodeURIComponent(text);
  const postUrl = `https://degenfeed.xyz/compose?text=${encoded}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `📝 <b>Cross-Post</b>\n\nYour message is ready. Click below to publish:\n💬 <i>${text.slice(0, 200)}${text.length > 200 ? '…' : ''}</i>\n\n🔗 <a href="${postUrl}">Open Composer ↗</a>`,
    {
      reply_markup: { inline_keyboard: [[{ text: '✍️ Open Composer', web_app: { url: postUrl } }]] },
    },
  );
}

async function cmdAlerts(
  botToken: string,
  chatId: number,
  userId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const userKey = telegramUserKey(String(userId));
  let user: TelegramLinkedUser | null = null;
  try {
    const raw = await env.CACHE?.get(userKey);
    if (raw) user = JSON.parse(raw) as TelegramLinkedUser;
  } catch {
    /* ignore */
  }
  if (!user)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ You need to /link a wallet first before configuring alerts.',
    );

  const subCommand = args[0]?.toLowerCase();
  if (!subCommand) {
    const prefs = user.preferences;
    return sendTelegramMessage(
      botToken,
      chatId,
      `🔔 <b>Alert Preferences</b>\n\nWallet: <code>${user.wallet.slice(0, 8)}...${user.wallet.slice(-6)}</code>\n\n${prefs.priceAlerts ? '✅' : '⬜'} Price alerts\n${prefs.mentionAlerts ? '✅' : '⬜'} Mention alerts\n${prefs.feedAlerts ? '✅' : '⬜'} Feed digests\n${prefs.tipNotifications ? '✅' : '⬜'} Tip notifications\n\nUse: /alerts toggle [price|mention|feed|tip]`,
    );
  }
  if (subCommand === 'toggle') {
    const toggleTarget = args[1]?.toLowerCase() ?? '';
    const toggleMap: Record<string, keyof TelegramLinkedUser['preferences']> = {
      price: 'priceAlerts',
      mention: 'mentionAlerts',
      feed: 'feedAlerts',
      tip: 'tipNotifications',
    };
    const prefKey = toggleMap[toggleTarget];
    if (!prefKey)
      return sendTelegramMessage(
        botToken,
        chatId,
        '❌ Usage: /alerts toggle [price|mention|feed|tip]',
      );
    user.preferences = { ...user.preferences, [prefKey]: !user.preferences[prefKey] };
    try {
      await env.CACHE?.put(userKey, JSON.stringify(user), { expirationTtl: 60 * 60 * 24 * 365 });
    } catch {
      return sendTelegramMessage(botToken, chatId, '❌ Failed to save preferences.');
    }
    return sendTelegramMessage(
      botToken,
      chatId,
      `✅ ${toggleTarget} alerts ${user.preferences[prefKey] ? 'enabled' : 'disabled'}!`,
    );
  }
  return sendTelegramMessage(
    botToken,
    chatId,
    '❌ Usage: /alerts or /alerts toggle [price|mention|feed|tip]',
  );
}

async function cmdAlert(
  botToken: string,
  chatId: number,
  _userId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[1]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /alert price &lt;SYMBOL&gt; &lt;target_price&gt;',
    );
  const alertUrl = `https://degenfeed.xyz/c/${symbol.toLowerCase()}?alert=price`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `🔔 <b>Set Alert for ${symbol}</b>\n\nSet price alerts: <a href="${alertUrl}">Configure on DegenFeed</a>`,
  );
}

async function cmdCommunity(
  botToken: string,
  chatId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /community &lt;SYMBOL&gt;\nExample: <code>/community DEGEN</code>',
    );
  try {
    const raw = await env.CACHE?.get(telegramCoinGroupKey(symbol));
    if (!raw)
      return sendTelegramMessage(
        botToken,
        chatId,
        `❓ No Telegram group found for <b>${symbol}</b>.\n🌐 <a href="https://degenfeed.xyz/c/${symbol.toLowerCase()}">${symbol} on DegenFeed</a>`,
      );
    const config = JSON.parse(raw) as TelegramGroupConfig;
    return sendTelegramMessage(
      botToken,
      chatId,
      `👥 <b>${symbol} Community</b>\n\nGroup: ${config.title}\n${config.minHoldRequirement ? `🔒 Minimum hold: ${config.minHoldRequirement} ${symbol}\n` : ''}━━━━━━━\nJoin the conversation!`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `👥 Join ${symbol} Group`,
                url: `https://t.me/${symbol.toLowerCase()}_community`,
              },
            ],
          ],
        },
      },
    );
  } catch {
    return sendTelegramMessage(botToken, chatId, `❓ No community found for <b>${symbol}</b>.`);
  }
}

async function cmdTip(
  botToken: string,
  chatId: number,
  _userId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const targetUser = args[0]?.replace('@', '');
  const amount = args[1];
  if (!targetUser || !amount)
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /tip @username &lt;amount&gt;\nExample: <code>/tip @cryptorugmunch 0.001</code>\n\n💡 Tips are sent via Lightning Network.',
    );
  const tipLink = `https://degenfeed.xyz/tip?to=${targetUser}&amount=${amount}`;
  return sendTelegramMessage(
    botToken,
    chatId,
    `⚡ <b>Send Tip</b>\n\nTo: @${targetUser}\nAmount: <b>${amount} BTC/Lightning</b>\n\nClick below to complete the tip:`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: `⚡ Send ${amount} BTC`, web_app: { url: tipLink } }]],
      },
    },
  );
}
