/**
 * @degenfeed/discord-sdk
 *
 * Discord Bot API client for guild/channel/message/webhook management.
 * Uses `fetch()` throughout - compatible with Cloudflare Workers, Node 18+, and browser.
 *
 * @see https://discord.com/developers/docs/intro
 */

import type { Protocol } from '@degenfeed/types';

export type { Protocol };

// ─── Constants ─────────────────────────────────────────────────────

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DISCORD_RATE_LIMIT_RPS = 50;
const DISCORD_MAX_RETRIES = 3;

// ─── Error Types ───────────────────────────────────────────────────

export class DiscordError extends Error {
  public readonly errorCode: number;
  public readonly statusCode: number;
  constructor(message: string, errorCode: number, statusCode: number) {
    super(message);
    this.name = 'DiscordError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

export class DiscordRateLimitError extends DiscordError {
  public readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(`Rate limited: retry after ${retryAfter}s`, 429, 429);
    this.name = 'DiscordRateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ─── Types ─────────────────────────────────────────────────────────

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  globalName?: string;
  avatar?: string;
  bot?: boolean;
  verified?: boolean;
  email?: string;
}
export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  ownerId: string;
  roles: DiscordRole[];
  features: string[];
  memberCount?: number;
  premiumTier: number;
  preferredLocale: string;
}
export interface DiscordChannel {
  id: string;
  type: number;
  guildId?: string;
  name?: string;
  topic?: string;
  position?: number;
  parentId?: string;
  lastMessageId?: string;
  rateLimitPerUser?: number;
}
export interface DiscordMessage {
  id: string;
  channelId: string;
  author: DiscordUser;
  content: string;
  timestamp: string;
  editedTimestamp?: string;
  embeds: DiscordEmbed[];
  attachments: DiscordAttachment[];
  mentions: DiscordUser[];
  mentionRoles: string[];
  pinned: boolean;
  type: number;
  flags?: number;
  thread?: DiscordChannel;
}
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  video?: DiscordEmbedVideo;
  provider?: DiscordEmbedProvider;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}
export interface DiscordEmbedFooter {
  text: string;
  iconUrl?: string;
  proxyIconUrl?: string;
}
export interface DiscordEmbedImage {
  url?: string;
  height?: number;
  width?: number;
}
export interface DiscordEmbedThumbnail {
  url?: string;
  height?: number;
  width?: number;
}
export interface DiscordEmbedVideo {
  url?: string;
  height?: number;
  width?: number;
}
export interface DiscordEmbedProvider {
  name?: string;
  url?: string;
}
export interface DiscordEmbedAuthor {
  name?: string;
  url?: string;
  iconUrl?: string;
}
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}
export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxyUrl: string;
  height?: number;
  width?: number;
  contentType?: string;
}
export interface DiscordWebhook {
  id: string;
  type: number;
  guildId?: string;
  channelId?: string;
  user?: DiscordUser;
  name?: string;
  avatar?: string;
  token?: string;
  url?: string;
}
export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
}
export interface DiscordComponent {
  type: number;
  style?: number;
  label?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  customId?: string;
  url?: string;
  disabled?: boolean;
  components?: DiscordComponent[];
}
export interface DiscordAllowedMentions {
  parse?: Array<'roles' | 'users' | 'everyone'>;
  roles?: string[];
  users?: string[];
  repliedUser?: boolean;
}

// ─── Rate Limiter ──────────────────────────────────────────────────

class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private timestamps: number[] = [];
  constructor(maxRequests = DISCORD_RATE_LIMIT_RPS, windowMs = 1_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }
  async acquire(): Promise<void> {
    const now = Date.now();
    const ws = now - this.windowMs;
    this.timestamps = this.timestamps.filter((t) => t > ws);
    if (this.timestamps.length >= this.maxRequests) {
      const oldest = this.timestamps[0]!;
      const waitMs = oldest + this.windowMs - now + 10;
      if (waitMs > 0) await sleep(waitMs);
    }
    this.timestamps.push(now);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main Client ───────────────────────────────────────────────────

export class DiscordBotClient {
  private botToken: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private userAgent: string;

  constructor(
    botToken: string,
    opts?: { baseUrl?: string; rateLimitRps?: number; userAgent?: string },
  ) {
    this.botToken = botToken;
    this.baseUrl = opts?.baseUrl ?? DISCORD_API_BASE;
    this.rateLimiter = new RateLimiter(opts?.rateLimitRps ?? DISCORD_RATE_LIMIT_RPS);
    this.userAgent = opts?.userAgent ?? 'DegenFeed/0.1 (+https://degenfeed.xyz)';
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown> | FormData,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    await this.rateLimiter.acquire();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < DISCORD_MAX_RETRIES; attempt++) {
      if (attempt > 0) await sleep(100 * 2 ** attempt);
      try {
        const url = new URL(`${this.baseUrl}${path}`);
        if (query)
          for (const [k, v] of Object.entries(query))
            if (v !== undefined) url.searchParams.set(k, String(v));

        const headers: Record<string, string> = {
          authorization: `Bot ${this.botToken}`,
          'user-agent': this.userAgent,
        };
        let requestBody: BodyInit | undefined;
        if (body instanceof FormData) {
          requestBody = body;
        } else if (body !== undefined) {
          headers['content-type'] = 'application/json';
          requestBody = JSON.stringify(body);
        }

        const res = await fetch(url.toString(), { method, headers, body: requestBody });

        if (res.status === 429) {
          const errBody = (await res.json().catch(() => ({}))) as { retry_after?: number };
          const retryAfter = errBody.retry_after ?? 1;
          if (attempt < DISCORD_MAX_RETRIES - 1) {
            await sleep(retryAfter * 1_000 + 100);
            continue;
          }
          throw new DiscordRateLimitError(retryAfter);
        }
        if (res.status === 204) return undefined as unknown as T;
        if (!res.ok) throw new DiscordError(`Discord API error ${res.status}`, 0, res.status);
        return (await res.json()) as T;
      } catch (err) {
        if (err instanceof DiscordRateLimitError && attempt < DISCORD_MAX_RETRIES - 1) {
          await sleep(err.retryAfter * 1_000 + 100);
          continue;
        }
        if (err instanceof DiscordError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < DISCORD_MAX_RETRIES - 1) continue;
      }
    }
    throw lastError ?? new DiscordError('Discord request failed after retries', 0, 0);
  }

  async getGuild(guildId: string): Promise<DiscordGuild> {
    return this.request<DiscordGuild>('GET', `/guilds/${guildId}`);
  }
  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.request<DiscordChannel>('GET', `/channels/${channelId}`);
  }
  async getChannelMessages(
    channelId: string,
    opts?: { limit?: number; around?: string; before?: string; after?: string },
  ): Promise<DiscordMessage[]> {
    return this.request<DiscordMessage[]>(
      'GET',
      `/channels/${channelId}/messages`,
      undefined,
      opts as Record<string, string | number | boolean | undefined>,
    );
  }
  async sendMessage(
    channelId: string,
    content: string,
    opts?: {
      embeds?: DiscordEmbed[];
      tts?: boolean;
      allowedMentions?: DiscordAllowedMentions;
      components?: DiscordComponent[];
    },
  ): Promise<DiscordMessage> {
    const b: Record<string, unknown> = { content };
    if (opts?.embeds) b.embeds = opts.embeds;
    if (opts?.tts) b.tts = opts.tts;
    if (opts?.allowedMentions) b.allowed_mentions = opts.allowedMentions;
    if (opts?.components) b.components = opts.components;
    return this.request<DiscordMessage>('POST', `/channels/${channelId}/messages`, b);
  }
  async editMessage(
    channelId: string,
    messageId: string,
    content?: string,
    opts?: { embeds?: DiscordEmbed[]; components?: DiscordComponent[] },
  ): Promise<DiscordMessage> {
    const b: Record<string, unknown> = {};
    if (content !== undefined) b.content = content;
    if (opts?.embeds) b.embeds = opts.embeds;
    if (opts?.components) b.components = opts.components;
    return this.request<DiscordMessage>('PATCH', `/channels/${channelId}/messages/${messageId}`, b);
  }
  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await this.request<void>('DELETE', `/channels/${channelId}/messages/${messageId}`);
  }
  async createWebhook(
    channelId: string,
    name: string,
    opts?: { avatar?: string },
  ): Promise<DiscordWebhook> {
    return this.request<DiscordWebhook>('POST', `/channels/${channelId}/webhooks`, {
      name,
      ...(opts?.avatar ? { avatar: opts.avatar } : {}),
    });
  }
  async executeWebhook(
    webhookId: string,
    webhookToken: string,
    opts?: {
      content?: string;
      embeds?: DiscordEmbed[];
      username?: string;
      avatarUrl?: string;
      wait?: boolean;
    },
  ): Promise<DiscordMessage | undefined> {
    const b: Record<string, unknown> = {};
    if (opts?.content !== undefined) b.content = opts.content;
    if (opts?.embeds) b.embeds = opts.embeds;
    if (opts?.username) b.username = opts.username;
    if (opts?.avatarUrl) b.avatar_url = opts.avatarUrl;
    const q: Record<string, string | number | boolean | undefined> = {};
    if (opts?.wait) q.wait = true;
    return this.request<DiscordMessage | undefined>(
      'POST',
      `/webhooks/${webhookId}/${webhookToken}`,
      b,
      q,
    );
  }
  async createThread(
    channelId: string,
    name: string,
    opts?: { messageId?: string; autoArchiveDuration?: 60 | 1440 | 4320 | 10080 },
  ): Promise<DiscordChannel> {
    if (opts?.messageId)
      return this.request<DiscordChannel>(
        'POST',
        `/channels/${channelId}/messages/${opts.messageId}/threads`,
        { name, auto_archive_duration: opts.autoArchiveDuration },
      );
    return this.request<DiscordChannel>('POST', `/channels/${channelId}/threads`, {
      name,
      auto_archive_duration: opts?.autoArchiveDuration,
    });
  }
  async addMemberRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request<void>('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  }
  async removeMemberRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.request<void>('DELETE', `/guilds/${guildId}/members/${userId}/roles/${roleId}`);
  }
  async getMe(): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', '/users/@me');
  }
  getMaskedToken(): string {
    return this.botToken.length <= 12
      ? '****'
      : `${this.botToken.slice(0, 8)}...${this.botToken.slice(-4)}`;
  }
}
