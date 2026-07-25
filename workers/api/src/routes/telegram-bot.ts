/**
 * telegram-bot — Telegram bot command handlers.
 *
 * Bot command dispatching and all /slash command implementations
 * for DegenFeed's Telegram integration.
 *
 * Separated from telegram.ts during de-godding.
 */

import { type Env, jsonResponse } from '../index';

// ─── KV key helpers ─────────────────────────────────────────────────────────
// ─── KV key helpers ─────────────────────────────────────────────────────────

export function telegramUserKey(telegramId: string): string {
  return `telegram:user:${telegramId}`;
}

export function telegramWalletIndex(wallet: string): string {
  return `telegram:wallet:${wallet.toLowerCase()}`;
}

export function telegramGroupKey(groupId: string): string {
  return `telegram:group:${groupId}`;
}

export function telegramGroupFeedKey(groupId: string): string {
  return `telegram:group:feed:${groupId}`;
}

export function telegramGroupTipKey(groupId: string): string {
  return `telegram:group:tip:${groupId}`;
}

export function telegramCoinGroupKey(symbol: string): string {
  return `telegram:coingroup:${symbol.toLowerCase()}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TelegramLinkedUser {
  telegramId: string;
  wallet: string;
  username?: string;
  firstName?: string;
  linkedAt: number;
  preferences: {
    priceAlerts: boolean;
    mentionAlerts: boolean;
    feedAlerts: boolean;
    tipNotifications: boolean;
  };
}

export interface TelegramGroupConfig {
  groupId: string;
  title: string;
  ownerWallet?: string;
  coinSymbol?: string;
  minHoldRequirement?: string;
  feedEnabled: boolean;
  crossPostEnabled: boolean;
  tippingEnabled: boolean;
  tokenGated: boolean;
  connectedAt: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: 'private' | 'group' | 'supergroup' | 'channel';
      title?: string;
      username?: string;
    };
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; username?: string };
    message?: {
      message_id: number;
      chat: { id: number; type: string };
    };
    data?: string;
  };
  my_chat_member?: {
    chat: { id: number; type: string; title?: string };
    new_chat_member: { status: string; user: { id: number } };
  };
}

// ─── Bot API helper ────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'Markdown';
    reply_markup?: Record<string, unknown>;
    reply_to_message_id?: number;
  },
): Promise<Response> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: options?.parse_mode ?? 'HTML',
  };
  if (options?.reply_markup) payload.reply_markup = options.reply_markup;
  if (options?.reply_to_message_id) payload.reply_to_message_id = options.reply_to_message_id;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[telegram] sendMessage failed:', err.slice(0, 200));
    }
    return res;
  } catch (err) {
    console.error('[telegram] sendMessage error:', err);
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 502 });
  }
}

export async function sendTelegramChatAction(
  botToken: string,
  chatId: number,
  action: 'typing' | 'upload_photo' | 'find_location',
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch {
    // best-effort
  }
}

// ─── Command Router ─────────────────────────────────────────────────────────

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
    default:
      if (command.startsWith('/')) {
        return sendTelegramMessage(
          botToken,
          chatId,
          `Unknown command. Try /start to see available commands.`,
        );
      }
      // Non-command messages ignored (groups get bridged content)
      return jsonResponse({ ok: true, handled: false });
  }
}

// ─── Command: /start ────────────────────────────────────────────────────────

export async function cmdStart(botToken: string, chatId: number, env: Env): Promise<Response> {
  const botName = env.TELEGRAM_BOT_NAME ?? 'DegenFeedBot';
  const welcome =
    `🚀 <b>Welcome to DegenFeed!</b>\n\n` +
    `The cross-protocol Web3 social hub.\n\n` +
    `<b>Commands:</b>\n` +
    `/link &lt;wallet&gt; — Link your wallet to Telegram\n` +
    `/coin &lt;symbol&gt; — Get creator coin stats\n` +
    `/buy &lt;symbol&gt; &lt;amount&gt; — Buy creator coin\n` +
    `/sell &lt;symbol&gt; &lt;amount&gt; — Sell creator coin\n` +
    `/feed — Latest posts from your feed\n` +
    `/post &lt;text&gt; — Cross-post to all protocols\n` +
    `/alerts — Configure price alerts\n` +
    `/community &lt;symbol&gt; — Join coin Telegram group\n` +
    `/tip @user &lt;amount&gt; — Send BTC/Lightning tip\n\n` +
    `👉 <a href="https://t.me/${botName}?start=app">Open in DegenFeed</a>\n` +
    `🌐 <a href="https://degenfeed.xyz">DegenFeed Web</a>`;

  return sendTelegramMessage(botToken, chatId, welcome);
}

// ─── Command: /link ─────────────────────────────────────────────────────────

export async function cmdLink(
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
      '❌ Usage: /link &lt;wallet_address&gt;\n' + 'Example: <code>/link 0x1234...5678</code>',
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

    const linkedUser: TelegramLinkedUser = {
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

    await env.CACHE?.put(userKey, JSON.stringify(linkedUser), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(walletKey, String(userId), {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    return sendTelegramMessage(
      botToken,
      chatId,
      `✅ <b>Wallet linked!</b>\n` +
        `Wallet: <code>${cleanWallet.slice(0, 8)}...${cleanWallet.slice(-6)}</code>\n` +
        `Now you can use /coin, /buy, /sell, /post, and /tip.\n\n` +
        `To configure alerts, use /alerts`,
    );
  } catch (err) {
    console.error('[telegram] /link error:', err);
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Failed to link wallet. Please try again later.',
    );
  }
}

// ─── Command: /coin ─────────────────────────────────────────────────────────

export async function cmdCoin(
  botToken: string,
  chatId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /coin &lt;SYMBOL&gt;\nExample: <code>/coin DEGEN</code>',
    );
  }

  // Fetch coin stats from DegenFeed API
  try {
    const res = await fetch(
      `${env.RMI_BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/coins/${symbol}`,
      { headers: { ...(env.RMI_API_KEY ? { Authorization: `Bearer ${env.RMI_API_KEY}` } : {}) } },
    );

    if (!res.ok) {
      if (res.status === 404) {
        return sendTelegramMessage(
          botToken,
          chatId,
          `❓ Coin <b>${symbol}</b> not found. Check the symbol and try again.`,
        );
      }
      return sendTelegramMessage(
        botToken,
        chatId,
        `⚠️ Could not fetch data for ${symbol}. API temporarily unavailable.`,
      );
    }

    const coin = (await res.json()) as {
      name?: string;
      symbol?: string;
      price?: string;
      marketCap?: string;
      holders?: number;
      volume24h?: string;
      creator?: string;
      dex?: string;
    };

    const msg =
      `💰 <b>${coin.name ?? symbol} (${coin.symbol ?? symbol})</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      `💵 Price: <b>$${coin.price ?? '—'}</b>\n` +
      `📊 Market Cap: $${coin.marketCap ?? '—'}\n` +
      `👥 Holders: ${coin.holders?.toLocaleString() ?? '—'}\n` +
      `📈 24h Volume: $${coin.volume24h ?? '—'}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `<a href="https://degenfeed.xyz/c/${symbol.toLowerCase()}">View on DegenFeed ↗</a>`;

    return sendTelegramMessage(botToken, chatId, msg);
  } catch (err) {
    console.error('[telegram] /coin error:', err);
    return sendTelegramMessage(botToken, chatId, `⚠️ Failed to fetch ${symbol} data.`);
  }
}

// ─── Command: /price ─────────────────────────────────────────────────────────

export async function cmdPrice(
  botToken: string,
  chatId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /price &lt;SYMBOL&gt;\nExample: <code>/price DEGEN</code>',
    );
  }

  try {
    const res = await fetch(
      `${env.RMI_BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/coins/${symbol}`,
      { headers: { ...(env.RMI_API_KEY ? { Authorization: `Bearer ${env.RMI_API_KEY}` } : {}) } },
    );

    if (!res.ok) {
      if (res.status === 404) {
        return sendTelegramMessage(botToken, chatId, `❓ Coin <b>${symbol}</b> not found.`);
      }
      return sendTelegramMessage(botToken, chatId, `⚠️ Could not fetch price for ${symbol}.`);
    }

    const coin = (await res.json()) as {
      name?: string;
      price?: string;
      priceChange24h?: string | number;
      marketCap?: string;
      volume24h?: string;
    };

    const price = Number(coin.price ?? 0);
    const change = Number(coin.priceChange24h ?? 0);
    const sign = change >= 0 ? '+' : '';

    const msg =
      `💵 <b>${coin.name ?? symbol} (${symbol})</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      `Price: <b>$${price.toFixed(price < 0.001 ? 6 : 4)}</b>\n` +
      `24h: ${sign}${change.toFixed(2)}%\n` +
      `Market Cap: $${Number(coin.marketCap ?? 0).toLocaleString()}\n` +
      `Volume 24h: $${Number(coin.volume24h ?? 0).toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━\n` +
      `<a href="https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}">View on DegenFeed ↗</a>`;

    return sendTelegramMessage(botToken, chatId, msg);
  } catch {
    return sendTelegramMessage(botToken, chatId, `⚠️ Failed to fetch price for ${symbol}.`);
  }
}

// ─── Command: /holders ───────────────────────────────────────────────────────

export async function cmdHolders(
  botToken: string,
  chatId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /holders &lt;SYMBOL&gt;\nExample: <code>/holders DEGEN</code>',
    );
  }

  try {
    const res = await fetch(
      `${env.RMI_BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/coins/${symbol}`,
      { headers: { ...(env.RMI_API_KEY ? { Authorization: `Bearer ${env.RMI_API_KEY}` } : {}) } },
    );

    if (!res.ok) {
      return sendTelegramMessage(botToken, chatId, `❓ Could not fetch holder data for ${symbol}.`);
    }

    const coin = (await res.json()) as { holders?: number; holderCount?: number; name?: string };
    const holderCount = coin.holderCount ?? coin.holders ?? 0;

    const msg =
      `👥 <b>${coin.name ?? symbol} Holders</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      `Total Holders: <b>${holderCount.toLocaleString()}</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      `View the full leaderboard:\n` +
      `<a href="https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}/community">Community Page ↗</a>`;

    return sendTelegramMessage(botToken, chatId, msg);
  } catch {
    return sendTelegramMessage(botToken, chatId, `⚠️ Failed to fetch holder data for ${symbol}.`);
  }
}

// ─── Command: /leaderboard ───────────────────────────────────────────────────

export async function cmdLeaderboard(
  botToken: string,
  chatId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /leaderboard &lt;SYMBOL&gt;\nExample: <code>/leaderboard DEGEN</code>',
    );
  }

  try {
    // Try fetching leaderboard from API
    const res = await fetch(
      `${env.RMI_BACKEND_URL ?? 'http://127.0.0.1:8000'}/api/coins/${symbol}/leaderboard`,
      { headers: { ...(env.RMI_API_KEY ? { Authorization: `Bearer ${env.RMI_API_KEY}` } : {}) } },
    );

    if (!res.ok) {
      // Fallback: show link to community page
      return sendTelegramMessage(
        botToken,
        chatId,
        `🏆 <b>${symbol} Leaderboard</b>\n\n` +
          `View the top holders leaderboard on the community page:\n` +
          `<a href="https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}/community">Open Leaderboard ↗</a>`,
      );
    }

    const data = (await res.json()) as {
      leaderboard?: Array<{ wallet: string; amount: number; rank: number }>;
    };

    if (!data.leaderboard || data.leaderboard.length === 0) {
      return sendTelegramMessage(botToken, chatId, `📊 No leaderboard data yet for ${symbol}.`);
    }

    const top5 = data.leaderboard.slice(0, 5);
    const lines = top5.map(
      (h, i) =>
        `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${h.rank}`} ` +
        `<code>${h.wallet.slice(0, 6)}...${h.wallet.slice(-4)}</code> — ` +
        `<b>${h.amount.toLocaleString()}</b> ${symbol}`,
    );

    const msg =
      `🏆 <b>${symbol} Top Holders</b>\n` +
      `━━━━━━━━━━━━━━━\n` +
      lines.join('\n') +
      `\n━━━━━━━━━━━━━━━\n` +
      `<a href="https://app.degenfeed.xyz/coins/${symbol.toLowerCase()}/community">Full Leaderboard ↗</a>`;

    return sendTelegramMessage(botToken, chatId, msg);
  } catch {
    return sendTelegramMessage(
      botToken,
      chatId,
      `⚠️ Failed to fetch leaderboard. Check back later.`,
    );
  }
}

// ─── Command: /alert (price alert) ──────────────────────────────────────────

export async function cmdAlert(
  botToken: string,
  chatId: number,
  userId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const alertType = args[0]?.toLowerCase(); // 'price'
  const symbol = args[1]?.toUpperCase();
  const targetPrice = args[2];

  if (alertType !== 'price' || !symbol || !targetPrice) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /alert price &lt;SYMBOL&gt; &lt;target_price&gt;\n' +
        'Example: <code>/alert price DEGEN 0.05</code>\n\n' +
        'You will be notified when the price target is hit.',
    );
  }

  // Validate target price
  const target = Number(targetPrice);
  if (Number.isNaN(target) || target <= 0) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Invalid target price. Enter a positive number.',
    );
  }

  // Store the alert in KV
  const alertKey = `telegram:alert:${userId}:${symbol.toLowerCase()}:price`;
  try {
    await env.CACHE?.put(
      alertKey,
      JSON.stringify({
        userId,
        chatId,
        symbol,
        targetPrice: target,
        alertType: 'price',
        createdAt: Date.now(),
        triggered: false,
      }),
      { expirationTtl: 60 * 60 * 24 * 30 }, // 30 days
    );

    return sendTelegramMessage(
      botToken,
      chatId,
      `🔔 <b>Price Alert Set!</b>\n\n` +
        `Symbol: <b>${symbol}</b>\n` +
        `Target: <b>$${target.toFixed(6)}</b>\n\n` +
        `You'll be notified when the price reaches this target.`,
    );
  } catch {
    return sendTelegramMessage(botToken, chatId, '❌ Failed to save alert. Please try again.');
  }
}

// ─── Command: /buy ──────────────────────────────────────────────────────────

export async function cmdBuy(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  const amount = args[1];

  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /buy &lt;SYMBOL&gt; [amount]\n' + 'Example: <code>/buy DEGEN 100</code>',
    );
  }

  const buyLink = amount
    ? `https://degenfeed.xyz/c/${symbol.toLowerCase()}?buy=${amount}`
    : `https://degenfeed.xyz/c/${symbol.toLowerCase()}`;

  const msg =
    `🛒 <b>Buy ${symbol}</b>\n\n` +
    `Click below to buy <b>${symbol}</b>${amount ? ` (${amount} tokens)` : ''}:\n` +
    `🔗 <a href="${buyLink}">Open Buy Page</a>\n\n` +
    `You'll need a connected wallet to complete the purchase.`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: `🛒 Buy ${symbol}`,
          web_app: { url: buyLink },
        },
      ],
    ],
  };

  return sendTelegramMessage(botToken, chatId, msg, { reply_markup: keyboard });
}

// ─── Command: /sell ─────────────────────────────────────────────────────────

export async function cmdSell(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  const amount = args[1];

  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /sell &lt;SYMBOL&gt; [amount]\n' + 'Example: <code>/sell DEGEN 50</code>',
    );
  }

  const sellLink = amount
    ? `https://degenfeed.xyz/c/${symbol.toLowerCase()}?sell=${amount}`
    : `https://degenfeed.xyz/c/${symbol.toLowerCase()}`;

  const msg =
    `📤 <b>Sell ${symbol}</b>\n\n` +
    `Click below to sell <b>${symbol}</b>${amount ? ` (${amount} tokens)` : ''}:\n` +
    `🔗 <a href="${sellLink}">Open Sell Page</a>\n\n` +
    `You'll need a connected wallet to complete the sale.`;

  return sendTelegramMessage(botToken, chatId, msg);
}

// ─── Command: /feed ─────────────────────────────────────────────────────────

export async function cmdFeed(
  botToken: string,
  chatId: number,
  args: string[],
  _env: Env,
  _userId: number,
): Promise<Response> {
  const protocol = args[0]?.toLowerCase();

  let feedUrl = 'https://degenfeed.xyz/feed';
  if (protocol && ['farcaster', 'lens', 'nostr', 'bluesky', 'mastodon', 'rss'].includes(protocol)) {
    feedUrl = `https://degenfeed.xyz/feed/${protocol}`;
  }

  const msg =
    `📰 <b>DegenFeed</b>\n\n` +
    (protocol ? `Showing feed for <b>${protocol}</b>\n` : `Your connected protocol feed\n`) +
    `━━━━━━━━━━━━━━━\n` +
    `Open DegenFeed to see your full feed:\n` +
    `🔗 <a href="${feedUrl}">Open Feed ↗</a>\n\n` +
    `💡 Tip: Use /feed &lt;protocol&gt; to filter\n` +
    `Example: <code>/feed farcaster</code>`;

  return sendTelegramMessage(botToken, chatId, msg);
}

// ─── Command: /post ─────────────────────────────────────────────────────────

export async function cmdPost(
  botToken: string,
  chatId: number,
  _userId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const text = args.join(' ');
  if (!text || text.length < 1) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /post &lt;your message&gt;\n' +
        'Example: <code>/post Just minted some DEGEN!</code>',
    );
  }

  if (text.length > 5000) {
    return sendTelegramMessage(botToken, chatId, '❌ Message too long (max 5000 characters).');
  }

  // For now, generate a pre-filled cross-post link
  const encoded = encodeURIComponent(text);
  const postUrl = `https://degenfeed.xyz/compose?text=${encoded}`;

  const msg =
    `📝 <b>Cross-Post</b>\n\n` +
    `Your message is ready to post. Click below to publish:\n\n` +
    `💬 <i>${text.slice(0, 200)}${text.length > 200 ? '…' : ''}</i>\n\n` +
    `🔗 <a href="${postUrl}">Open Composer ↗</a>\n\n` +
    `You can select which protocols to publish to on the web.`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '✍️ Open Composer',
          web_app: { url: postUrl },
        },
      ],
    ],
  };

  return sendTelegramMessage(botToken, chatId, msg, { reply_markup: keyboard });
}

// ─── Command: /alerts ───────────────────────────────────────────────────────

export async function cmdAlerts(
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
    // ignore
  }

  if (!user) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ You need to /link a wallet first before configuring alerts.',
    );
  }

  const subCommand = args[0]?.toLowerCase();

  if (!subCommand) {
    // Show current alert preferences with toggle buttons
    const prefs = user.preferences;
    const statusMsg =
      `🔔 <b>Alert Preferences</b>\n\n` +
      `Wallet: <code>${user.wallet.slice(0, 8)}...${user.wallet.slice(-6)}</code>\n\n` +
      `${prefs.priceAlerts ? '✅' : '⬜'} Price alerts\n` +
      `${prefs.mentionAlerts ? '✅' : '⬜'} Mention alerts\n` +
      `${prefs.feedAlerts ? '✅' : '⬜'} Feed digests\n` +
      `${prefs.tipNotifications ? '✅' : '⬜'} Tip notifications\n\n` +
      `Use: /alerts toggle [price|mention|feed|tip]`;

    return sendTelegramMessage(botToken, chatId, statusMsg);
  }

  if (subCommand === 'toggle') {
    const toggleTarget = args[1]?.toLowerCase() ?? '';
    const toggleMap: Record<string, keyof TelegramLinkedUser['preferences']> = {
      price: 'priceAlerts',
      mention: 'mentionAlerts',
      feed: 'feedAlerts',
      tip: 'tipNotifications',
    };

    const prefKey: keyof TelegramLinkedUser['preferences'] | undefined = toggleMap[toggleTarget];
    if (!prefKey) {
      return sendTelegramMessage(
        botToken,
        chatId,
        '❌ Usage: /alerts toggle [price|mention|feed|tip]',
      );
    }

    const newValue = !user.preferences[prefKey];
    user.preferences = { ...user.preferences, [prefKey]: newValue };
    try {
      await env.CACHE?.put(userKey, JSON.stringify(user), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    } catch {
      return sendTelegramMessage(botToken, chatId, '❌ Failed to save preferences.');
    }

    const state = user.preferences[prefKey] ? 'enabled' : 'disabled';
    return sendTelegramMessage(botToken, chatId, `✅ ${toggleTarget} alerts ${state}!`);
  }

  return sendTelegramMessage(
    botToken,
    chatId,
    '❌ Usage: /alerts or /alerts toggle [price|mention|feed|tip]',
  );
}

// ─── Command: /community ────────────────────────────────────────────────────

export async function cmdCommunity(
  botToken: string,
  chatId: number,
  args: string[],
  env: Env,
): Promise<Response> {
  const symbol = args[0]?.toUpperCase();
  if (!symbol) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /community &lt;SYMBOL&gt;\n' + 'Example: <code>/community DEGEN</code>',
    );
  }

  // Look up the Telegram group for this coin
  try {
    const groupKey = telegramCoinGroupKey(symbol);
    const raw = await env.CACHE?.get(groupKey);
    if (!raw) {
      return sendTelegramMessage(
        botToken,
        chatId,
        `❓ No Telegram group found for <b>${symbol}</b>.\n` +
          `The creator hasn't set up a group yet. Check back later!\n\n` +
          `🌐 <a href="https://degenfeed.xyz/c/${symbol.toLowerCase()}">${symbol} on DegenFeed</a>`,
      );
    }

    const config = JSON.parse(raw) as TelegramGroupConfig;
    const msg =
      `👥 <b>${symbol} Community</b>\n\n` +
      `Group: ${config.title}\n` +
      `Members: Active on DegenFeed\n` +
      `${config.minHoldRequirement ? `🔒 Minimum hold: ${config.minHoldRequirement} ${symbol}\n` : ''}` +
      `━━━━━━━━━━━━━━━\n` +
      `Join the conversation on Telegram!`;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: `👥 Join ${symbol} Group`,
            url: `https://t.me/${symbol.toLowerCase()}_community`,
          },
        ],
      ],
    };

    return sendTelegramMessage(botToken, chatId, msg, { reply_markup: keyboard });
  } catch {
    return sendTelegramMessage(botToken, chatId, `❓ No community found for <b>${symbol}</b>.`);
  }
}

// ─── Command: /tip ──────────────────────────────────────────────────────────

export async function cmdTip(
  botToken: string,
  chatId: number,
  _userId: number,
  args: string[],
  _env: Env,
): Promise<Response> {
  const targetUser = args[0]?.replace('@', '');
  const amount = args[1];

  if (!targetUser || !amount) {
    return sendTelegramMessage(
      botToken,
      chatId,
      '❌ Usage: /tip @username &lt;amount&gt;\n' +
        'Example: <code>/tip @cryptorugmunch 0.001</code>\n\n' +
        '💡 Tips are sent via Lightning Network.',
    );
  }

  const tipLink = `https://degenfeed.xyz/tip?to=${targetUser}&amount=${amount}`;

  const msg =
    `⚡ <b>Send Tip</b>\n\n` +
    `To: @${targetUser}\n` +
    `Amount: <b>${amount} BTC/Lightning</b>\n\n` +
    `Click below to complete the tip:`;

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: `⚡ Send ${amount} BTC`,
          web_app: { url: tipLink },
        },
      ],
    ],
  };

  return sendTelegramMessage(botToken, chatId, msg, { reply_markup: keyboard });
}
