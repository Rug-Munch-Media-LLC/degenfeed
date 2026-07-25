/**
 * Telegram Provider
 *
 * Fetches posts from Telegram channels/groups via the Bot API.
 * Telegram channels are a significant source of crypto news, signals,
 * and community discussions — especially for alpha leaks, new token
 * launches, and trading groups.
 *
 * API: Bot API at https://api.telegram.org/bot{token}/
 *   GET /getUpdates — get latest messages (polling)
 *   GET /getChat — get chat info
 *
 * Strategy:
 * 1. Bot API polling from configured channels
 * 2. Public channel scraping via tg.i-c-a.su or t.me/s/ proxies
 * 3. Webhook mode for real-time (separate endpoint)
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface TelegramSource {
  chatId: string;
  displayName: string;
  topic?: string;
}

const CURATED_CHANNELS: TelegramSource[] = [
  { chatId: '@DegenFeed', displayName: 'DegenFeed Official', topic: 'announcements' },
  { chatId: '@cryptocom', displayName: 'Crypto.com News', topic: 'crypto' },
  { chatId: '@coindesk', displayName: 'CoinDesk', topic: 'crypto' },
  { chatId: '@bloomberg_crypto', displayName: 'Bloomberg Crypto', topic: 'crypto' },
  { chatId: '@rektnews', displayName: 'Rekt News', topic: 'security' },
  { chatId: '@definalphahub', displayName: 'DeFi Alpha Hub', topic: 'defi' },
];

const TELEGRAM_ICON = '💬';

// ─── Types ─────────────────────────────────────────────────────────────

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    title?: string;
    username?: string;
    type: string;
  };
  from?: {
    id: number;
    is_bot?: boolean;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  entities?: Array<{
    type: string;
    offset: number;
    length: number;
    url?: string;
  }>;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
  }>;
  video?: {
    file_id: string;
    file_unique_id: string;
    file_size: number;
    width: number;
    height: number;
  };
  document?: { file_id: string; file_unique_id: string; file_name?: string; mime_type?: string };
  reply_to_message?: TelegramMessage;
  forward_from_chat?: { id: number; title?: string; username?: string };
  forward_date?: number;
  link_preview_options?: { url?: string; prefer_large_media?: boolean };
}

interface TelegramGetUpdatesResponse {
  ok: boolean;
  result: TelegramMessage[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

function guessTelegramNiches(text: string, chatTitle?: string): string[] {
  const lower = `${text} ${chatTitle || ''}`.toLowerCase();
  const niches: string[] = [];
  if (
    /\b(crypto|bitcoin|btc|ethereum|eth|solana|sol|defi|nft|web3|blockchain|altcoin)\b/.test(lower)
  )
    niches.push('crypto');
  if (
    /\b(ai|artificial|intelligence|llm|machine.learning|gpt|openai|anthropic|claude|deepseek)\b/.test(
      lower,
    )
  )
    niches.push('ai');
  if (/\b(trading|trade|signal|entry|long|short|leverage|margin|futures|perp)\b/.test(lower))
    niches.push('trading');
  if (/\b(audit|hack|exploit|vulnerability|rug|scam|security|breach)\b/.test(lower))
    niches.push('security');
  if (/\b(defi|yield|liquidity|staking|pool|farm|apy|apr|lend|borrow|swap|amm)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|mint|collection|art|collectible|pfp|soulbound)\b/.test(lower)) niches.push('nft');
  if (/\b(memecoin|meme|shitcoin|pump|dump|degens)\b/.test(lower)) niches.push('memes');
  if (/\b(dao|governance|proposal|vote|treasury)\b/.test(lower)) niches.push('dao');
  if (/\b(regulate|sec|regulation|policy|law|compliance|mica)\b/.test(lower)) niches.push('news');
  if (niches.length === 0) niches.push('social');
  return niches;
}

function extractEntities(text: string): Array<{ kind: string; url: string }> {
  const entities: Array<{ kind: string; url: string }> = [];
  // Extract URLs
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  for (const url of urls.slice(0, 5)) {
    entities.push({ kind: 'link', url });
  }
  return entities;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function messageToPost(msg: TelegramMessage, source: TelegramSource): UnifiedPost {
  const text = msg.text || msg.caption || '';
  const chatTitle = msg.chat?.title || source.displayName;
  const authorName = msg.from?.first_name
    ? [msg.from.first_name, msg.from.last_name].filter(Boolean).join(' ')
    : msg.from?.username || chatTitle;
  const isForwarded = !!msg.forward_from_chat;
  const date = msg.date * 1000; // Telegram uses Unix seconds

  const displayText = [
    `${TELEGRAM_ICON} ${isForwarded ? '🔄 Forwarded: ' : ''}`,
    text.slice(0, 2000),
    text.length > 2000 ? '\n… (truncated)' : '',
  ].join('');

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  // Add photo if present
  if (msg.photo && msg.photo.length > 0) {
    embeds.push({
      kind: 'image',
      url: `https://t.me/${source.chatId.replace('@', '')}/${msg.message_id}`,
    });
  }

  // Add video if present
  if (msg.video) {
    embeds.push({
      kind: 'video',
      url: `https://t.me/${source.chatId.replace('@', '')}/${msg.message_id}`,
    });
  }

  // Add link preview
  if (msg.link_preview_options?.url) {
    embeds.push({ kind: 'link', url: msg.link_preview_options.url });
  }

  // Extract URLs from text
  const extracted = extractEntities(text);
  for (const e of extracted) {
    if (!embeds.some((existing) => existing.url === e.url)) {
      embeds.push(e);
    }
  }

  return {
    id: `telegram:${msg.message_id}@${source.chatId}`,
    protocol: 'telegram',
    author: {
      id: `telegram:${msg.from?.id || msg.chat.id}`,
      primary: { protocol: 'telegram', id: String(msg.from?.id || msg.chat.id) },
      handles: { telegram: msg.from?.username || null },
      displayName: authorName,
      bio: '',
      avatarUrl: '',
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: { telegramUserId: String(msg.from?.id || '') },
    },
    text: displayText,
    embeds,
    contentType: 'text',
    createdAt: date,
    metrics: {
      likes: 0,
      reposts: 0,
      replies: 0,
      quotes: 0,
      views: undefined,
    },
    engagement: {
      viewerLiked: false,
      viewerReposted: false,
      viewerBookmarked: false,
      raw: { likes: 0, reposts: 0, replies: 0, quotes: 0 },
    },
    raw: msg,
    niches: guessTelegramNiches(text, chatTitle),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromChannel(source: TelegramSource, limit: number): Promise<UnifiedPost[]> {
  const token = getBotToken();
  if (!token) {
    console.log('[bridge] Telegram: no TELEGRAM_BOT_TOKEN configured');
    return [];
  }

  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const res = await $fetch(
      `${url}?offset=-${Math.max(limit, 50)}&allowed_updates=["message"]&timeout=5`,
      {
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];

    const data = (await res.json()) as TelegramGetUpdatesResponse;
    if (!data.ok || !Array.isArray(data.result)) return [];

    const messages = data.result
      .filter((m) => {
        // Only include messages from the target channel
        const chatMatch = m.chat?.username
          ? `@${m.chat.username.toLowerCase()}` === source.chatId.toLowerCase()
          : String(m.chat?.id) === source.chatId.replace('@', '');
        return chatMatch && (m.text || m.caption);
      })
      .slice(0, limit);

    return messages.map((m) => messageToPost(m, source));
  } catch (err) {
    console.log(`[bridge] Telegram fetch error (${source.chatId}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'telegram',
  name: 'Telegram',
  description: 'Telegram channels and groups via Bot API',
  endpoint: '/api/feed/telegram',
  requiresAuth: true,
  authEnvVar: 'TELEGRAM_BOT_TOKEN',
  contentType: 'text',
};

export async function fetchTelegramPosts(limit = 20): Promise<UnifiedPost[]> {
  const perSource = Math.max(3, Math.ceil(limit / CURATED_CHANNELS.length));

  const results = await Promise.allSettled(
    CURATED_CHANNELS.map((src) => fetchFromChannel(src, perSource)),
  );

  const all: UnifiedPost[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Set<string>();
  const deduped: UnifiedPost[] = [];
  for (const p of all) {
    if (!seen.has(p.id) && deduped.length < limit) {
      seen.add(p.id);
      deduped.push(p);
    }
  }

  console.log(`[bridge] Telegram: ${deduped.length} messages`);
  return deduped;
}

export const fetch = fetchTelegramPosts;
