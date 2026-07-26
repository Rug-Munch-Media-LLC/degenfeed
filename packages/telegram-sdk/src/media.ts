/**
 * Media upload helpers for @degenfeed/telegram-sdk.
 *
 * Provides convenience functions for uploading photos and media groups
 * to Telegram channels using the TGBotClientLike.
 */

import type { TgInputMedia } from './types';

// Minimal interface matching the TGBotClientLike methods used by this module.
// Avoids circular import: index.ts → media.ts → index.ts
interface TGBotClientLikeLike {
  sendPhoto(
    chatId: string,
    photo: string | Blob,
    opts?: {
      caption?: string;
      parseMode?: 'HTML' | 'MarkdownV2';
      replyToMessageId?: number;
      hasSpoiler?: boolean;
    },
  ): Promise<{ messageId: number }>;
  sendVideo(
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
  ): Promise<{ messageId: number }>;
  sendMediaGroup(
    chatId: string,
    media: TgInputMedia[],
  ): Promise<{ messageIds: number[] }>;
}

// ─── Upload Photo ──────────────────────────────────────────────────

/**
 * Upload a photo to a Telegram chat from a URL or file_id.
 *
 * @param bot     - Initialized TGBotClientLike instance.
 * @param chatId  - Target chat ID (numeric string or @username).
 * @param imageUrl - Public URL of the image, or a Telegram file_id.
 * @param caption - Optional caption text.
 * @returns The Telegram API response.
 */
export async function uploadPhoto(
  bot: TGBotClientLike,
  chatId: string,
  imageUrl: string,
  caption?: string,
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const result = await bot.sendPhoto(chatId, imageUrl, {
      caption,
      parseMode: 'HTML',
    });
    return { ok: true, messageId: result.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ─── Upload Media Group ────────────────────────────────────────────

/**
 * Upload a media group (album) to a Telegram chat.
 * Sends up to 10 images as a grouped album.
 *
 * @param bot     - Initialized TGBotClientLike instance.
 * @param chatId  - Target chat ID.
 * @param images  - Array of image URLs or file_ids.
 * @param caption - Optional caption applied to the first media item.
 * @returns The Telegram API response with message IDs.
 */
export async function uploadMediaGroup(
  bot: TGBotClientLike,
  chatId: string,
  images: string[],
  caption?: string,
): Promise<{ ok: boolean; messageIds?: number[]; error?: string }> {
  if (images.length === 0) {
    return { ok: false, error: 'No images provided' };
  }

  // Telegram supports max 10 items per media group
  const batch = images.slice(0, 10);

  try {
    const media: TgInputMedia[] = batch.map((url, i) => ({
      type: 'photo' as const,
      media: url,
      parse_mode: 'HTML' as const,
      ...(i === 0 && caption ? { caption, parse_mode: 'HTML' as const } : {}),
    }));

    const result = await bot.sendMediaGroup(chatId, media);
    return { ok: true, messageIds: result.messageIds };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

// ─── Upload Video with Thumbnail ───────────────────────────────────

/**
 * Upload a video to a Telegram chat from a URL or file_id.
 *
 * @param bot     - Initialized TGBotClientLike instance.
 * @param chatId  - Target chat ID.
 * @param videoUrl - Public URL of the video, or Telegram file_id.
 * @param opts    - Optional parameters (caption, duration, dimensions, etc.).
 * @returns The Telegram API response.
 */
export async function uploadVideo(
  bot: TGBotClientLike,
  chatId: string,
  videoUrl: string,
  opts?: {
    caption?: string;
    duration?: number;
    width?: number;
    height?: number;
    supportsStreaming?: boolean;
  },
): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const result = await bot.sendVideo(chatId, videoUrl, {
      caption: opts?.caption,
      parseMode: 'HTML',
      duration: opts?.duration,
      width: opts?.width,
      height: opts?.height,
      supportsStreaming: opts?.supportsStreaming,
    });
    return { ok: true, messageId: result.messageId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
