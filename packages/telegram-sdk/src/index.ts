/**
 * @degenfeed/telegram-sdk
 *
 * Telegram Bot API client for posting to channels, managing chat membership,
 * and linking DegenFeed identities to Telegram accounts.
 *
 * Uses `fetch()` throughout — compatible with Cloudflare Workers, Node 18+,
 * and browser environments.
 *
 * @see https://core.telegram.org/bots/api
 */

import type {
  TgChat,
  TgChatMember,
  TgFile,
  TgInlineKeyboardMarkup,
  TgInputMedia,
  TgMessage,
  TgResponse,
  TgUser,
  TgWebhookInfo,
} from './types';

export type { TgChat, TgChatMember, TgInlineKeyboardMarkup, TgInputMedia, TgMessage, TgUser, TgWebhookInfo };

export * from './markdown';
export * from './media';

// ─── Constants ─────────────────────────────────────────────────────

/** Default base URL for the Telegram Bot API. */
const TG_API_BASE = 'https://api.telegram.org';

/** Maximum messages per second before hitting rate limits (~30/s for most bots). */
const TG_RATE_LIMIT_RPS = 30;

/** Default retry delay (ms) when rate-limited. */
const TG_RATE_LIMIT_RETRY_MS = 1_000;

/** Max retries for rate-limited requests. */
const TG_MAX_RETRIES = 3;

// ─── Error Types ───────────────────────────────────────────────────

export class TelegramError extends Error {
  public readonly errorCode: number;
  public readonly parameters?: { retry_after?: number; migrate_to_chat_id?: number };

  constructor(
    message: string,
    errorCode: number,
    parameters?: { retry_after?: number; migrate_to_chat_id?: number },
  ) {
    super(message);
    this.name = 'TelegramError';
    this.errorCode = errorCode;
    this.parameters = parameters;
  }
}

export class TelegramRateLimitError extends TelegramError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limited: retry after ${retryAfter}s`, 429, { retry_after: retryAfter });
    this.name = 'TelegramRateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ─── Response Helpers ──────────────────────────────────────────────

export interface SendMessageResult {
  messageId: number;
  chat: { id: string; type: string };
}

export interface SendMediaResult {
  messageId: number;
}

export interface SendMediaGroupResult {
  messageIds: number[];
}

export interface GetMeResult {
  id: number;
  username: string;
  firstName: string;
}

export interface Chat {
  id: string;
  type: string;
  title?: string;
  username?: string;
  description?: string;
  inviteLink?: string;
  photo?: { smallFileId: string; bigFileId: string };
  isForum?: boolean;
}

export interface ChatMember {
  status: string;
  user: { id: number; username?: string; firstName: string; lastName?: string };
  customTitle?: string;
  isAnonymous?: boolean;
  untilDate?: number;
}

// ─── Rate Limiter ──────────────────────────────────────────────────

/**
 * Simple sliding-window rate limiter for Telegram API calls.
 * Tracks request timestamps and delays if the window is saturated.
 */
class RateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private timestamps: number[] = [];

  constructor(maxRequests: number = TG_RATE_LIMIT_RPS, windowMs: number = 1_000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Prune timestamps outside the window
    this.timestamps = this.timestamps.filter((t) => t > windowStart);

    if (this.timestamps.length >= this.maxRequests) {
      // Need to wait until the oldest timestamp falls out of the window
      const oldest = this.timestamps[0]!;
      const waitMs = oldest + this.windowMs - now + 10; // 10ms buffer
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }

    this.timestamps.push(now);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a URL string for a Telegram API method.
 */
function buildUrl(baseUrl: string, method: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${method}`;
}

/**
 * Convert a TgChat object from the API to our normalized Chat shape.
 */
function normalizeChat(chat: TgChat): Chat {
  return {
    id: String(chat.id),
    type: chat.type,
    title: chat.title,
    username: chat.username,
    description: chat.description,
    inviteLink: chat.invite_link,
    photo: chat.photo
      ? {
          smallFileId: chat.photo.small_file_id,
          bigFileId: chat.photo.big_file_id,
        }
      : undefined,
    isForum: chat.is_forum,
  };
}

/**
 * Convert a TgChatMember from API to our normalized ChatMember shape.
 */
function normalizeChatMember(member: TgChatMember): ChatMember {
  return {
    status: member.status,
    user: {
      id: member.user.id,
      username: member.user.username,
      firstName: member.user.first_name,
      lastName: member.user.last_name,
    },
    customTitle: member.custom_title,
    isAnonymous: member.is_anonymous,
    untilDate: member.until_date,
  };
}

// ─── Main Client ───────────────────────────────────────────────────

export class TGBotClient {
  private botToken: string;
  private baseUrl: string;
  private rateLimiter: RateLimiter;
  private userAgent: string;

  constructor(
    botToken: string,
    opts?: {
      baseUrl?: string;
      rateLimitRps?: number;
      userAgent?: string;
    },
  ) {
    this.botToken = botToken;
    this.baseUrl = opts?.baseUrl ?? `${TG_API_BASE}/bot${botToken}`;
    this.rateLimiter = new RateLimiter(opts?.rateLimitRps ?? TG_RATE_LIMIT_RPS);
    this.userAgent = opts?.userAgent ?? 'DegenFeed/0.1 (+https://degenfeed.xyz)';
  }

  // ─── Core API Request ──────────────────────────────────────────

  /**
   * Make a request to the Telegram Bot API.
   * Handles rate limiting, network errors, and Telegram error responses.
   */
  private async request<T>(
    method: string,
    body?: FormData | Record<string, unknown>,
  ): Promise<T> {
    await this.rateLimiter.acquire();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < TG_MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff between retries
        await sleep(100 * 2 ** attempt);
      }

      try {
        const url = buildUrl(this.baseUrl, method);
        const headers: Record<string, string> = {
          'user-agent': this.userAgent,
        };

        let requestBody: BodyInit | undefined;
        let contentType: string | undefined;

        if (body instanceof FormData) {
          requestBody = body;
          // Do not set content-type; fetch sets it with boundary for FormData
        } else if (body !== undefined) {
          contentType = 'application/json';
          headers['content-type'] = contentType;
          requestBody = JSON.stringify(body);
        }

        const res = await fetch(url.toString(), {
          method: 'POST',
          headers,
          body: requestBody,
        });

        const json = (await res.json()) as TgResponse<T>;

        if (!json.ok) {
          const errMsg = json.description ?? 'Unknown Telegram error';
          const errCode = json.error_code ?? 0;
          const params = json.parameters;

          // Handle rate limiting
          if (errCode === 429 && params?.retry_after) {
            const retryAfter = params.retry_after;
            if (attempt < TG_MAX_RETRIES - 1) {
              await sleep(retryAfter * 1_000 + 100);
              continue;
            }
            throw new TelegramRateLimitError(retryAfter);
          }

          // Handle chat migration
          if (errCode === 400 && params?.migrate_to_chat_id) {
            throw new TelegramError(
              `Chat migrated to ${params.migrate_to_chat_id}`,
              errCode,
              params,
            );
          }

          throw new TelegramError(errMsg, errCode, params);
        }

        return json.result as T;
      } catch (err) {
        if (err instanceof TelegramRateLimitError && attempt < TG_MAX_RETRIES - 1) {
          await sleep(err.retryAfter * 1_000 + 100);
          continue;
        }

        if (err instanceof TelegramError) throw err;

        // Network or parse error — retry
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < TG_MAX_RETRIES - 1) {
          continue;
        }
      }
    }

    throw lastError ?? new Error('Telegram request failed after retries');
  }

  // ─── Core Send Methods ─────────────────────────────────────────

  /**
   * Send a text message to a chat.
   *
   * @param chatId  - Target chat ID (numeric string or @channelusername).
   * @param text    - Message text (up to 4096 characters).
   * @param opts    - Optional parameters.
   * @returns The message ID and chat info.
   */
  async sendMessage(
    chatId: string,
    text: string,
    opts?: {
      parseMode?: 'HTML' | 'MarkdownV2';
      disableWebPagePreview?: boolean;
      replyToMessageId?: number;
      linkPreviewOptions?: { isDisabled: boolean };
    },
  ): Promise<SendMessageResult> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };

    if (opts?.parseMode) body.parse_mode = opts.parseMode;
    if (opts?.replyToMessageId) body.reply_to_message_id = opts.replyToMessageId;

    // Handle link_preview_options (newer API) and legacy disable_web_page_preview
    if (opts?.linkPreviewOptions !== undefined) {
      body.link_preview_options = opts.linkPreviewOptions;
    } else if (opts?.disableWebPagePreview !== undefined) {
      body.disable_web_page_preview = opts.disableWebPagePreview;
    }

    const msg = await this.request<TgMessage>('sendMessage', body);

    return {
      messageId: msg.message_id,
      chat: { id: String(msg.chat.id), type: msg.chat.type },
    };
  }

  /**
   * Send a photo to a chat.
   *
   * @param chatId  - Target chat ID.
   * @param photo   - URL, file_id, or Blob of the photo.
   * @param opts    - Optional parameters.
   * @returns The message ID.
   */
  async sendPhoto(
    chatId: string,
    photo: string | Blob,
    opts?: {
      caption?: string;
      parseMode?: 'HTML' | 'MarkdownV2';
      replyToMessageId?: number;
      hasSpoiler?: boolean;
    },
  ): Promise<SendMediaResult> {
    if (typeof photo === 'string') {
      // URL or file_id — send as JSON
      const body: Record<string, unknown> = {
        chat_id: chatId,
        photo,
      };
      if (opts?.caption) body.caption = opts.caption;
      if (opts?.parseMode) body.parse_mode = opts.parseMode;
      if (opts?.replyToMessageId) body.reply_to_message_id = opts.replyToMessageId;
      if (opts?.hasSpoiler) body.has_spoiler = opts.hasSpoiler;

      const msg = await this.request<TgMessage>('sendPhoto', body);
      return { messageId: msg.message_id };
    }

    // Blob — upload via multipart/form-data
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', new Blob([photo]), 'photo.jpg');
    if (opts?.caption) formData.append('caption', opts.caption);
    if (opts?.parseMode) formData.append('parse_mode', opts.parseMode);
    if (opts?.replyToMessageId) formData.append('reply_to_message_id', String(opts.replyToMessageId));
    if (opts?.hasSpoiler) formData.append('has_spoiler', 'true');

    const msg = await this.request<TgMessage>('sendPhoto', formData);
    return { messageId: msg.message_id };
  }

  /**
   * Send a video to a chat.
   *
   * @param chatId  - Target chat ID.
   * @param video   - URL, file_id, or Blob of the video.
   * @param opts    - Optional parameters.
   * @returns The message ID.
   */
  async sendVideo(
    chatId: string,
    video: string | Blob,
    opts?: {
      caption?: string;
      parseMode?: 'HTML' | 'MarkdownV2';
      duration?: number;
      width?: number;
      height?: number;
      supportsStreaming?: boolean;
      replyToMessageId?: number;
      hasSpoiler?: boolean;
    },
  ): Promise<SendMediaResult> {
    if (typeof video === 'string') {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        video,
      };
      if (opts?.caption) body.caption = opts.caption;
      if (opts?.parseMode) body.parse_mode = opts.parseMode;
      if (opts?.duration !== undefined) body.duration = opts.duration;
      if (opts?.width !== undefined) body.width = opts.width;
      if (opts?.height !== undefined) body.height = opts.height;
      if (opts?.supportsStreaming) body.supports_streaming = opts.supportsStreaming;
      if (opts?.replyToMessageId) body.reply_to_message_id = opts.replyToMessageId;
      if (opts?.hasSpoiler) body.has_spoiler = opts.hasSpoiler;

      const msg = await this.request<TgMessage>('sendVideo', body);
      return { messageId: msg.message_id };
    }

    // Blob upload
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('video', new Blob([video]), 'video.mp4');
    if (opts?.caption) formData.append('caption', opts.caption);
    if (opts?.parseMode) formData.append('parse_mode', opts.parseMode);
    if (opts?.duration !== undefined) formData.append('duration', String(opts.duration));
    if (opts?.supportsStreaming) formData.append('supports_streaming', 'true');
    if (opts?.hasSpoiler) formData.append('has_spoiler', 'true');

    const msg = await this.request<TgMessage>('sendVideo', formData);
    return { messageId: msg.message_id };
  }

  /**
   * Send a media group (album) to a chat.
   * Supports up to 10 photos/videos in a single album.
   *
   * @param chatId  - Target chat ID.
   * @param media   - Array of media items (photo or video).
   * @returns Array of message IDs.
   */
  async sendMediaGroup(
    chatId: string,
    media: TgInputMedia[],
  ): Promise<SendMediaGroupResult> {
    if (media.length === 0) {
      throw new TelegramError('Media group must contain at least 1 item', 400);
    }
    if (media.length > 10) {
      throw new TelegramError('Media group supports at most 10 items', 400);
    }

    const body: Record<string, unknown> = {
      chat_id: chatId,
      media,
    };

    const messages = await this.request<TgMessage[]>('sendMediaGroup', body);
    return {
      messageIds: messages.map((msg) => msg.message_id),
    };
  }

  /**
   * Edit a message's text.
   *
   * @param chatId    - Target chat ID.
   * @param messageId - ID of the message to edit.
   * @param text      - New text content.
   * @param opts      - Optional parse mode.
   */
  async editMessageText(
    chatId: string,
    messageId: number,
    text: string,
    opts?: {
      parseMode?: 'HTML' | 'MarkdownV2';
    },
  ): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };

    if (opts?.parseMode) body.parse_mode = opts.parseMode;

    await this.request<true | TgMessage>('editMessageText', body);
  }

  /**
   * Delete a message.
   *
   * @param chatId    - Target chat ID.
   * @param messageId - ID of the message to delete.
   */
  async deleteMessage(chatId: string, messageId: number): Promise<void> {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
    };

    await this.request<true>('deleteMessage', body);
  }

  // ─── Channel / Chat Management ─────────────────────────────────

  /**
   * Get up-to-date information about a chat.
   *
   * @param chatId - Target chat ID.
   * @returns Normalized chat object.
   */
  async getChat(chatId: string): Promise<Chat> {
    const body = { chat_id: chatId };
    const chat = await this.request<TgChat>('getChat', body);
    return normalizeChat(chat);
  }

  /**
   * Get information about a member of a chat.
   *
   * @param chatId - Target chat ID.
   * @param userId - User ID.
   * @returns Normalized chat member object.
   */
  async getChatMember(chatId: string, userId: number): Promise<ChatMember> {
    const body = { chat_id: chatId, user_id: userId };
    const member = await this.request<TgChatMember>('getChatMember', body);
    return normalizeChatMember(member);
  }

  /**
   * Get basic information about the bot.
   *
   * @returns Bot ID, username, and first name.
   */
  async getMe(): Promise<GetMeResult> {
    const user = await this.request<TgUser>('getMe');
    return {
      id: user.id,
      username: user.username ?? '',
      firstName: user.first_name,
    };
  }

  /**
   * Get the number of members in a chat.
   *
   * @param chatId - Target chat ID.
   * @returns Member count.
   */
  async getChatMemberCount(chatId: string): Promise<number> {
    const body = { chat_id: chatId };
    return this.request<number>('getChatMemberCount', body);
  }

  /**
   * Leave a group, supergroup, or channel.
   *
   * @param chatId - Target chat ID.
   */
  async leaveChat(chatId: string): Promise<void> {
    const body = { chat_id: chatId };
    await this.request<true>('leaveChat', body);
  }

  /**
   * Pin a message in a chat (bot must have can_pin_messages rights).
   *
   * @param chatId    - Target chat ID.
   * @param messageId - Message ID to pin.
   * @param opts      - Optional: disable notification.
   */
  async pinMessage(
    chatId: string,
    messageId: number,
    opts?: { disableNotification?: boolean },
  ): Promise<void> {
    const body: Record<string, unknown> = { chat_id: chatId, message_id: messageId };
    if (opts?.disableNotification) body.disable_notification = true;
    await this.request<true>('pinChatMessage', body);
  }

  /**
   * Unpin a message in a chat.
   *
   * @param chatId - Target chat ID.
   * @param messageId - Optional: message ID to unpin. If omitted, unpins the most recent pinned message.
   */
  async unpinMessage(chatId: string, messageId?: number): Promise<void> {
    const body: Record<string, unknown> = { chat_id: chatId };
    if (messageId !== undefined) body.message_id = messageId;
    await this.request<true>('unpinChatMessage', body);
  }

  // ─── Identity Verification ─────────────────────────────────────

  /**
   * Verify whether a user is a member of a specific chat.
   * Useful for gating access or linking Telegram identities to DegenFeed
   * based on chat membership.
   *
   * @param chatId - Chat ID to check membership in.
   * @param userId - Telegram user ID to verify.
   * @returns True if the user is a member (not left/kicked).
   */
  async verifyMembership(chatId: string, userId: number): Promise<boolean> {
    try {
      const member = await this.getChatMember(chatId, userId);
      return member.status !== 'left' && member.status !== 'kicked';
    } catch {
      return false;
    }
  }

  /**
   * Verify bot membership in a chat.
   * Checks whether the bot itself is a member of the given chat.
   *
   * @param chatId - Chat ID to check.
   * @returns True if the bot is a member.
   */
  async verifyBotMembership(chatId: string): Promise<boolean> {
    try {
      const bot = await this.getMe();
      return this.verifyMembership(chatId, bot.id);
    } catch {
      return false;
    }
  }

  // ─── Webhook Management ────────────────────────────────────────

  /**
   * Set a webhook URL for receiving updates.
   *
   * @param url  - HTTPS URL to send updates to.
   * @param opts - Optional: secret token for X-Telegram-Bot-Api-Secret-Token header.
   * @returns True if the webhook was set successfully.
   */
  async setWebhook(
    url: string,
    opts?: { secretToken?: string },
  ): Promise<boolean> {
    const body: Record<string, unknown> = { url };
    if (opts?.secretToken) body.secret_token = opts.secretToken;
    const result = await this.request<true>('setWebhook', body);
    return result === true;
  }

  /**
   * Remove the webhook integration.
   *
   * @returns True if the webhook was deleted.
   */
  async deleteWebhook(): Promise<boolean> {
    const result = await this.request<true>('deleteWebhook');
    return result === true;
  }

  /**
   * Get current webhook status.
   *
   * @returns WebhookInfo object.
   */
  async getWebhookInfo(): Promise<TgWebhookInfo> {
    return this.request<TgWebhookInfo>('getWebhookInfo');
  }

  // ─── Export / Utility ──────────────────────────────────────────

  /**
   * Get the bot token (read-only).
   */
  getBotToken(): string {
    return this.botToken;
  }

  // ─── File Download ─────────────────────────────────────────────

  /**
   * Get download info for a file.
   *
   * @param fileId - Telegram file_id from a message.
   * @returns File object with file_path for constructing the download URL.
   */
  async getFile(fileId: string): Promise<TgFile> {
    const body = { file_id: fileId };
    return this.request<TgFile>('getFile', body);
  }

  /**
   * Get a download URL for a Telegram file.
   * The file can be downloaded from: https://api.telegram.org/file/bot<token>/<file_path>
   *
   * @param fileId - Telegram file_id.
   * @returns Full HTTPS download URL.
   */
  async getFileUrl(fileId: string): Promise<string> {
    const file = await this.getFile(fileId);
    if (!file.file_path) {
      throw new TelegramError('File has no path', 400);
    }
    const token = this.botToken;
    return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  }
}
