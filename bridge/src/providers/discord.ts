/**
 * Discord Provider
 *
 * Fetches posts from Discord channels/servers via the Discord REST API.
 * Discord is a primary source for crypto communities, trading groups,
 * dev DAOs, and NFT projects — offering real-time community discussions.
 *
 * API: Discord REST API v10
 *   GET /channels/{channel_id}/messages — get messages from a channel
 *   GET /guilds/{guild_id} — get guild/server info
 *   GET /channels/{channel_id} — get channel info
 *
 * Strategy:
 * 1. Bot API with configured channels/servers
 * 2. Message fetching with pagination
 * 3. Supports text channels, forum channels, and thread replies
 */

import type { SchemaGuard, UnifiedPost } from '../server/types';

const $fetch = globalThis.fetch;

// ─── Constants ─────────────────────────────────────────────────────────

interface DiscordSource {
  guildId: string;
  channelId: string;
  displayName: string;
  topic?: string;
}

const CURATED_CHANNELS: DiscordSource[] = [
  { guildId: 'crypto', channelId: 'general', displayName: 'Crypto General', topic: 'crypto' },
  { guildId: 'defi', channelId: 'discussion', displayName: 'DeFi Discussion', topic: 'defi' },
  { guildId: 'nft', channelId: 'announcements', displayName: 'NFT Announcements', topic: 'nft' },
  { guildId: 'dev', channelId: 'coding', displayName: 'Dev / Builders', topic: 'tech' },
];

const DISCORD_API_BASE = 'https://discord.com/api/v10';

// ─── Types ─────────────────────────────────────────────────────────────

interface DiscordAuthor {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  bot?: boolean;
}

interface DiscordAttachment {
  id: string;
  filename: string;
  url: string;
  proxy_url: string;
  content_type?: string;
  width?: number;
  height?: number;
  size: number;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  image?: { url: string; proxy_url: string; width?: number; height?: number };
  thumbnail?: { url: string; proxy_url: string; width?: number; height?: number };
  author?: { name: string; url?: string; icon_url?: string };
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessage {
  id: string;
  type: number;
  content: string;
  channel_id: string;
  guild_id?: string;
  author: DiscordAuthor;
  attachments: DiscordAttachment[];
  embeds: DiscordEmbed[];
  timestamp: string;
  edited_timestamp: string | null;
  mention_everyone: boolean;
  mentions: DiscordAuthor[];
  pinned: boolean;
  referenced_message?: DiscordMessage | null;
  thread?: { id: string; name: string; message_count: number };
}

interface DiscordChannelInfo {
  id: string;
  name: string;
  topic?: string;
  guild_id?: string;
  type: number;
}

interface DiscordGuildInfo {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  member_count?: number;
  premium_tier?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getBotToken(): string | undefined {
  return process.env.DISCORD_BOT_TOKEN;
}

function parseDiscordTimestamp(ts: string): number {
  return new Date(ts).getTime();
}

function guessDiscordNiches(text: string, channelName?: string): string[] {
  const lower = `${text} ${channelName || ''}`.toLowerCase();
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
  if (/\b(trading|trade|signal|entry|long|short|leverage|margin|futures|perp|swap)\b/.test(lower))
    niches.push('trading');
  if (/\b(audit|hack|exploit|vulnerability|rug|scam|security|breach|exploit)\b/.test(lower))
    niches.push('security');
  if (/\b(defi|yield|liquidity|staking|pool|farm|apy|apr|lend|borrow|swap|amm|dex)\b/.test(lower))
    niches.push('defi');
  if (/\b(nft|mint|collection|art|collectible|pfp|soulbound|opensea|blur)\b/.test(lower))
    niches.push('nft');
  if (/\b(memecoin|meme|shitcoin|pump|dump|degens|pepe|bonk|dogecoin|shiba)\b/.test(lower))
    niches.push('memes');
  if (/\b(dao|governance|proposal|vote|treasury|multisig)\b/.test(lower)) niches.push('dao');
  if (/\b(dev|developer|code|programming|solidity|rust|typescript|contract|api)\b/.test(lower))
    niches.push('tech');
  if (/\b(gaming|game|metaverse|play2earn|p2e|web3.gaming)\b/.test(lower)) niches.push('gaming');
  if (niches.length === 0) niches.push('social');
  return niches;
}

function getAvatarUrl(author: DiscordAuthor): string {
  if (author.avatar) {
    return `https://cdn.discordapp.com/avatars/${author.id}/${author.avatar}.${author.avatar.startsWith('a_') ? 'gif' : 'png'}`;
  }
  const defaultIndex = Number(author.discriminator) % 5;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

// ─── Mapping ──────────────────────────────────────────────────────────

function messageToPost(msg: DiscordMessage, source: DiscordSource): UnifiedPost {
  const text = msg.content || '';
  const authorName = msg.author.global_name || msg.author.username;
  const timestamp = parseDiscordTimestamp(msg.timestamp);

  const embeds: Array<{ kind: string; url: string; meta?: Record<string, unknown> }> = [];

  // Attachments
  for (const att of msg.attachments) {
    if (att.content_type?.startsWith('image/')) {
      embeds.push({
        kind: 'image',
        url: att.url,
        meta: { width: att.width, height: att.height, filename: att.filename },
      });
    } else if (att.content_type?.startsWith('video/')) {
      embeds.push({ kind: 'video', url: att.url, meta: { filename: att.filename } });
    } else {
      embeds.push({ kind: 'link', url: att.url, meta: { filename: att.filename, size: att.size } });
    }
  }

  // Rich embeds
  for (const e of msg.embeds) {
    if (e.image?.url) {
      embeds.push({ kind: 'image', url: e.image.url, meta: { title: e.title } });
    }
    if (e.thumbnail?.url) {
      embeds.push({ kind: 'image', url: e.thumbnail.url, meta: { title: e.title } });
    }
    if (e.url && !text.includes(e.url)) {
      embeds.push({
        kind: 'link',
        url: e.url,
        meta: { title: e.title, description: e.description },
      });
    }
  }

  // Extract URLs from text
  const urlRe = /https?:\/\/[^\s<>"']+/gi;
  const urls = text.match(urlRe) ?? [];
  for (const url of urls) {
    if (!embeds.some((existing) => existing.url === url)) {
      embeds.push({ kind: 'link', url });
    }
  }

  const displayText = `💬 ${text.slice(0, 2000)}${text.length > 2000 ? '\n… (truncated)' : ''}`;

  return {
    id: `discord:${msg.id}`,
    protocol: 'discord',
    author: {
      id: `discord:${msg.author.id}`,
      primary: { protocol: 'discord', id: msg.author.id },
      handles: { discord: msg.author.username },
      displayName: authorName,
      bio: '',
      avatarUrl: getAvatarUrl(msg.author),
      followerCount: 0,
      followingCount: 0,
      links: [],
      keys: {},
    },
    text: displayText,
    embeds,
    contentType: 'text',
    createdAt: timestamp,
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
    niches: guessDiscordNiches(text, source.displayName),
  };
}

// ─── Fetch Logic ──────────────────────────────────────────────────────

async function fetchFromChannel(source: DiscordSource, limit: number): Promise<UnifiedPost[]> {
  const token = getBotToken();
  if (!token) {
    // console.log('[bridge] Discord: no DISCORD_BOT_TOKEN configured');
    return [];
  }

  try {
    const url = `${DISCORD_API_BASE}/channels/${source.channelId}/messages?limit=${Math.min(limit, 100)}`;
    const res = await $fetch(url, {
      headers: {
        Authorization: `Bot ${token}`,
        'User-Agent': 'DegenFeed-Bridge/0.1 (Discord)',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      if (res.status === 429) {
        // console.log(`[bridge] Discord rate limited on ${source.channelId}`);
      }
      return [];
    }

    const messages = (await res.json()) as DiscordMessage[];
    if (!Array.isArray(messages)) return [];

    return messages
      .filter((m) => !m.author.bot && m.content.trim().length > 0)
      .slice(0, limit)
      .map((m) => messageToPost(m, source));
  } catch (err) {
    // console.log(`[bridge] Discord fetch error (${source.channelId}): ${(err as Error).message}`);
    return [];
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

export const schema: SchemaGuard = {
  id: 'discord',
  name: 'Discord',
  description: 'Discord channels and communities',
  endpoint: '/api/feed/discord',
  requiresAuth: true,
  authEnvVar: 'DISCORD_BOT_TOKEN',
  contentType: 'text',
};

export async function fetchDiscordPosts(limit = 20): Promise<UnifiedPost[]> {
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

  // console.log(`[bridge] Discord: ${deduped.length} messages`);
  return deduped;
}

export const fetch = fetchDiscordPosts;
