/**
 * @degenfeed/api-worker — Rich Media Sharing for Chat
 *
 * Media sharing in messages: images, videos, audio, files, location,
 * contacts, link previews, stickers, GIFs, and polls.
 *
 * Integrates with:
 *   - video-storage-router.ts (IPFS for small, R2 for large)
 *   - r2-storage.ts (direct R2 uploads)
 *   - ipfs-storage.ts (IPFS Pinata/web3.storage)
 *   - Existing message transport layer
 */

import { log } from '../logger';
import type { Env } from '../types';
import { getIPFSGatewayUrl, uploadBufferToIPFS } from './ipfs-storage';
import { uploadToR2 } from './r2-storage';
import { storeVideo } from './video-storage-router';

// ─── KV Prefixes ──────────────────────────────────────────────────────────

const MEDIA_PREFIX = 'chat:media:';
const MEDIA_INDEX_PREFIX = 'chat:media:index:';
const LINK_PREVIEW_PREFIX = 'chat:linkpreview:';
const POLL_PREFIX = 'chat:poll:';
const _POLL_VOTE_PREFIX = 'chat:poll:vote:';
const GIF_CACHE_PREFIX = 'chat:gifcache:';
const STICKER_PACK_PREFIX = 'chat:sticker:pack:';
const STICKER_USER_PREFIX = 'chat:sticker:user:';

// ─── Types ────────────────────────────────────────────────────────────────

export type MediaType =
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'contact'
  | 'link_preview'
  | 'sticker'
  | 'gif'
  | 'poll';

export interface ChatMedia {
  /** Unique media ID */
  id: string;
  /** Media type */
  type: MediaType;
  /** Conversation ID where shared */
  conversationId: string;
  /** Sender wallet address */
  senderId: string;
  /** Timestamp */
  createdAt: number;
  /** File metadata */
  file?: {
    name: string;
    size: number;
    mimeType: string;
    /** Storage URL (IPFS gateway, R2 CDN, or direct link) */
    url: string;
    /** Thumbnail/preview URL */
    thumbnailUrl?: string;
    /** Blur hash for image placeholders */
    blurHash?: string;
    /** Width/height for images/videos */
    width?: number;
    height?: number;
    /** Duration in seconds (audio/video) */
    duration?: number;
    /** Storage backend used */
    storage: 'ipfs' | 'r2' | 'external';
    /** IPFS CID if stored on IPFS */
    ipfsCid?: string;
    /** R2 key if stored on R2 */
    r2Key?: string;
  };
  /** Location data */
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  /** Contact data */
  contact?: {
    walletAddress: string;
    displayName?: string;
    avatar?: string;
    bio?: string;
  };
  /** Link preview */
  linkPreview?: {
    url: string;
    title: string;
    description?: string;
    imageUrl?: string;
    favicon?: string;
    siteName?: string;
  };
  /** Sticker reference */
  sticker?: {
    packId: string;
    stickerId: string;
    url: string;
    emoji?: string;
  };
  /** GIF reference */
  gif?: {
    provider: 'tenor' | 'giphy';
    gifId: string;
    url: string;
    previewUrl: string;
    width: number;
    height: number;
  };
}

export interface Poll {
  /** Poll ID */
  id: string;
  /** Conversation where poll was sent */
  conversationId: string;
  /** Creator wallet */
  createdBy: string;
  /** Question text */
  question: string;
  /** Options */
  options: PollOption[];
  /** Allow multiple answers? */
  multipleChoice: boolean;
  /** When the poll ends (null = no expiry) */
  endsAt: number | null;
  /** Total votes cast */
  totalVotes: number;
  /** When created */
  createdAt: number;
}

export interface PollOption {
  /** Option ID */
  id: string;
  /** Option text */
  text: string;
  /** Vote count */
  votes: number;
  /** Who voted (for transparency) */
  voters: string[];
}

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  imageUrl: string | null;
  favicon: string | null;
  siteName: string | null;
  cachedAt: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const MAX_IMAGE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB (will route to R2)
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILE_SIZE_FREE = 100 * 1024 * 1024; // 100MB free
const MAX_FILE_SIZE_PREMIUM = 2 * 1024 * 1024 * 1024; // 2GB premium
const LINK_PREVIEW_CACHE_TTL = 86400 * 7; // 7 days
const _BASE_STICKER_URL = 'https://degenfeed.xyz/stickers';
const GIF_SEARCH_CACHE_TTL = 300; // 5 min

// ─── Media ID Generation ──────────────────────────────────────────────────

function generateMediaId(): string {
  return `media_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function generatePollId(): string {
  return `poll_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Generate blur hash placeholder from image dimensions.
 * Simple approximation — in production, use the blurhash library.
 */
function generateBlurHash(width: number, height: number): string {
  const aspect = width / height;
  return `L${'A'.repeat(aspect > 1 ? 8 : 6)}${'0'.repeat(4)}`;
}

// ─── Media Upload ─────────────────────────────────────────────────────────

/**
 * Upload chat media with intelligent storage routing.
 *
 * Small files (<60s video, <10MB audio/images) → IPFS
 * Large files → R2 with CDN
 * Returns enriched ChatMedia object with storage URLs.
 */
export async function uploadChatMedia(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  conversationId: string,
  senderId: string,
  env: Env,
  options?: {
    mediaType?: MediaType;
    duration?: number;
    width?: number;
    height?: number;
    isPremium?: boolean;
    thumbnailBuffer?: ArrayBuffer;
  },
): Promise<ChatMedia> {
  const mediaId = generateMediaId();
  const size = buffer.byteLength;
  const type = options?.mediaType ?? inferMediaType(mimeType);

  const media: ChatMedia = {
    id: mediaId,
    type,
    conversationId,
    senderId: senderId.toLowerCase(),
    createdAt: Date.now(),
    file: {
      name: fileName,
      size,
      mimeType,
      url: '',
      storage: 'ipfs',
      duration: options?.duration,
      width: options?.width,
      height: options?.height,
    },
  };

  try {
    // Route based on type and size
    if (type === 'video' || type === 'audio') {
      // Use video-storage-router for media with duration
      const contentId = `chat-${senderId}-${Date.now()}`;
      const storageResult = await storeVideo(env, {
        contentId,
        buffer,
        duration: options?.duration ?? 0,
        isPremium: options?.isPremium,
        format: mimeType,
      });

      media.file!.url = storageResult.cdnUrl || storageResult.url;
      media.file!.storage = storageResult.backend === 'ipfs' ? 'ipfs' : 'r2';
      media.file!.ipfsCid = storageResult.ipfsHash;
      media.file!.r2Key = contentId;
      media.file!.thumbnailUrl = storageResult.ipfsHash
        ? `${getIPFSGatewayUrl(storageResult.ipfsHash)}?format=thumbnail`
        : undefined;
    } else {
      // Images and other files
      if (size < 10 * 1024 * 1024) {
        // Small: IPFS
        const ipfsResult = await uploadBufferToIPFS(buffer, fileName, mimeType, env);
        if (ipfsResult.cid) {
          media.file!.url = ipfsResult.gatewayUrl;
          media.file!.ipfsCid = ipfsResult.cid;
        } else {
          throw new Error('IPFS upload failed');
        }
      } else {
        // Large: R2
        const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '.bin';
        const storageKey = `chat/media/${conversationId}/${mediaId}${ext}`;
        const r2Result = await uploadToR2(storageKey, buffer, mimeType, env, {
          'media-id': mediaId,
          conversation: conversationId,
          sender: senderId,
        });
        media.file!.url = r2Result.cdnUrl;
        media.file!.r2Key = r2Result.key;
        media.file!.storage = 'r2';
      }

      // Generate thumbnail for images
      if (type === 'image' && options?.thumbnailBuffer) {
        const thumbKey = `chat/media/${conversationId}/${mediaId}_thumb.jpg`;
        const thumbResult = await uploadToR2(thumbKey, options.thumbnailBuffer, 'image/jpeg', env);
        media.file!.thumbnailUrl = thumbResult.cdnUrl;
      }

      // Blur hash for large images
      if (type === 'image' && options?.width && options?.height) {
        media.file!.blurHash = generateBlurHash(options.width, options.height);
      }
    }
  } catch (err) {
    log('error', `[chat-media] upload failed: ${fileName}`, err);
    throw new Error(`Media upload failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // Store metadata in KV
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv
      .put(`${MEDIA_PREFIX}${mediaId}`, JSON.stringify(media), {
        expirationTtl: 86400 * 90,
      })
      .catch(() => {});

    // Index by conversation
    const indexKey = `${MEDIA_INDEX_PREFIX}${conversationId}`;
    const existingRaw = await kv.get(indexKey).catch(() => null);
    const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(mediaId);
    await kv
      .put(indexKey, JSON.stringify(existing.slice(-200)), {
        expirationTtl: 86400 * 90,
      })
      .catch(() => {});
  }

  return media;
}

/**
 * Infer media type from MIME type.
 */
function inferMediaType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'file';
}

// ─── Media Retrieval ──────────────────────────────────────────────────────

/**
 * Get media metadata by ID.
 */
export async function getMedia(env: Env, mediaId: string): Promise<ChatMedia | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${MEDIA_PREFIX}${mediaId}`);
    return raw ? (JSON.parse(raw) as ChatMedia) : null;
  } catch {
    return null;
  }
}

/**
 * Get all media in a conversation, optionally filtered by type.
 */
export async function getConversationMedia(
  env: Env,
  conversationId: string,
  options?: {
    type?: MediaType;
    limit?: number;
    before?: number;
  },
): Promise<ChatMedia[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];

  try {
    const indexRaw = await kv.get(`${MEDIA_INDEX_PREFIX}${conversationId}`);
    if (!indexRaw) return [];

    const mediaIds: string[] = JSON.parse(indexRaw);
    const results: ChatMedia[] = [];

    for (const id of mediaIds) {
      const media = await getMedia(env, id);
      if (!media) continue;
      if (options?.type && media.type !== options.type) continue;
      if (options?.before && media.createdAt >= options.before) continue;
      results.push(media);
    }

    // Sort newest first, apply limit
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results.slice(0, options?.limit ?? 50);
  } catch {
    return [];
  }
}

// ─── Link Previews ────────────────────────────────────────────────────────

/**
 * Generate a link preview from a URL.
 * Caches results in KV for 7 days.
 */
export async function generateLinkPreview(url: string, env: Env): Promise<LinkPreviewData | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  // Check cache
  const cacheKey = `${LINK_PREVIEW_PREFIX}${urlToKey(url)}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as LinkPreviewData;
    }
  } catch {
    // Ignore cache errors
  }

  try {
    // Fetch the page and extract Open Graph / meta tags
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DegenFeed/1.0 (link-preview-bot; +https://degenfeed.xyz)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    const title =
      extractMeta(html, 'og:title') ||
      extractMeta(html, 'twitter:title') ||
      extractTitle(html) ||
      url;
    const description =
      extractMeta(html, 'og:description') ||
      extractMeta(html, 'twitter:description') ||
      extractMeta(html, 'description');
    const imageUrl = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image');
    const favicon = extractFavicon(html, url);
    const siteName = extractMeta(html, 'og:site_name');

    const preview: LinkPreviewData = {
      url,
      title: title.slice(0, 300),
      description: description?.slice(0, 500) ?? '',
      imageUrl,
      favicon,
      siteName,
      cachedAt: Date.now(),
    };

    // Cache in KV
    await kv
      .put(cacheKey, JSON.stringify(preview), {
        expirationTtl: LINK_PREVIEW_CACHE_TTL,
      })
      .catch(() => {});

    return preview;
  } catch {
    return null;
  }
}

function urlToKey(url: string): string {
  return Buffer.from(url).toString('base64url').slice(0, 64);
}

function extractMeta(html: string, property: string): string | null {
  // Try property="..." and name="..."
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`,
      'i',
    ),
    new RegExp(`<meta[^>]+name=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(property)}["']`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1] ?? null;
}

function extractFavicon(html: string, baseUrl: string): string | null {
  const match = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i);
  if (match?.[1]) {
    try {
      return new URL(match[1], baseUrl).href;
    } catch {
      return match[1];
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Polls ────────────────────────────────────────────────────────────────

/**
 * Create a poll in a conversation.
 */
export async function createPoll(
  env: Env,
  conversationId: string,
  createdBy: string,
  question: string,
  options: string[],
  multipleChoice: boolean,
  endsAtMinutes?: number,
): Promise<Poll> {
  if (options.length < 2 || options.length > 10) {
    throw new Error('Polls must have 2-10 options');
  }
  if (!question.trim()) {
    throw new Error('Poll question is required');
  }

  const poll: Poll = {
    id: generatePollId(),
    conversationId,
    createdBy: createdBy.toLowerCase(),
    question: question.trim().slice(0, 500),
    options: options.map((text) => ({
      id: `opt_${crypto.randomUUID().slice(0, 8)}`,
      text: text.trim().slice(0, 200),
      votes: 0,
      voters: [],
    })),
    multipleChoice,
    endsAt: endsAtMinutes ? Date.now() + endsAtMinutes * 60000 : null,
    totalVotes: 0,
    createdAt: Date.now(),
  };

  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.put(`${POLL_PREFIX}${poll.id}`, JSON.stringify(poll), {
      expirationTtl: endsAtMinutes
        ? endsAtMinutes * 60 + 86400 // 1 day grace after expiry
        : 86400 * 30,
    });
  }

  return poll;
}

/**
 * Vote on a poll option.
 */
export async function votePoll(
  env: Env,
  pollId: string,
  voterId: string,
  optionIds: string[],
): Promise<Poll | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;

  const raw = await kv.get(`${POLL_PREFIX}${pollId}`);
  if (!raw) throw new Error('Poll not found');

  const poll = JSON.parse(raw) as Poll;

  // Check expiry
  if (poll.endsAt && Date.now() > poll.endsAt) {
    throw new Error('Poll has ended');
  }

  // Check if already voted
  const alreadyVoted = poll.options.some((o) => o.voters.includes(voterId));
  if (alreadyVoted && !poll.multipleChoice) {
    throw new Error('Already voted on this poll');
  }

  // Validate option IDs
  for (const optId of optionIds) {
    if (!poll.options.some((o) => o.id === optId)) {
      throw new Error(`Option ${optId} not found`);
    }
  }

  // Record vote
  for (const optId of optionIds) {
    const option = poll.options.find((o) => o.id === optId);
    if (option) {
      if (!option.voters.includes(voterId)) {
        option.voters.push(voterId);
        option.votes = option.voters.length;
      }
    }
  }

  poll.totalVotes = poll.options.reduce((sum, o) => sum + o.voters.length, 0);

  // If multiple choice, track total votes differently (count unique voters)
  if (!poll.multipleChoice) {
    poll.totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  }

  await kv.put(`${POLL_PREFIX}${pollId}`, JSON.stringify(poll), {
    expirationTtl: poll.endsAt ? Math.ceil((poll.endsAt - Date.now()) / 1000) + 86400 : 86400 * 30,
  });

  return poll;
}

/**
 * Get poll by ID.
 */
export async function getPoll(env: Env, pollId: string): Promise<Poll | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${POLL_PREFIX}${pollId}`);
    return raw ? (JSON.parse(raw) as Poll) : null;
  } catch {
    return null;
  }
}

// ─── GIF Search ──────────────────────────────────────────────────────────

interface GifResult {
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Search for GIFs via Tenor/Giphy.
 * Returns cached results for 5 minutes.
 */
export async function searchGifs(
  query: string,
  env: Env,
  options?: {
    limit?: number;
    provider?: 'tenor' | 'giphy';
  },
): Promise<GifResult[]> {
  const provider = options?.provider ?? 'tenor';
  const limit = options?.limit ?? 20;
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;

  // Check cache
  const cacheKey = `${GIF_CACHE_PREFIX}${provider}:${query.toLowerCase().trim()}`;
  if (kv) {
    try {
      const cached = await kv.get(cacheKey);
      if (cached) {
        return (JSON.parse(cached) as GifResult[]).slice(0, limit);
      }
    } catch {
      // Ignore cache errors
    }
  }

  try {
    let results: GifResult[] = [];

    if (provider === 'tenor') {
      // Tenor free tier — no API key needed for basic search
      const res = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=AIzaSyDy81EbOqBqUoPJ6f6E3BbEJQ_zgJ0LKlI&limit=${limit}&contentfilter=medium`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          results?: Array<{
            id: string;
            media_formats?: {
              gif?: { url: string; dims: number[] };
              tinygif?: { url: string; dims: number[] };
            };
          }>;
        };
        results = (data.results ?? []).map((g) => ({
          url: g.media_formats?.gif?.url ?? '',
          previewUrl: g.media_formats?.tinygif?.url ?? '',
          width: g.media_formats?.gif?.dims?.[0] ?? 200,
          height: g.media_formats?.gif?.dims?.[1] ?? 200,
        }));
      }
    } else {
      // Giphy free tier
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=GlVGYHkrB1kYXfPXz8LmGJ2bQERzWc4B&q=${encodeURIComponent(query)}&limit=${limit}`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          data?: Array<{
            id: string;
            images: {
              original: { url: string; width: string; height: string };
              fixed_width_small: { url: string };
            };
          }>;
        };
        results = (data.data ?? []).map((g) => ({
          url: g.images.original.url,
          previewUrl: g.images.fixed_width_small.url,
          width: parseInt(g.images.original.width, 10) || 200,
          height: parseInt(g.images.original.height, 10) || 200,
        }));
      }
    }

    // Cache results
    if (kv && results.length > 0) {
      await kv
        .put(cacheKey, JSON.stringify(results), {
          expirationTtl: GIF_SEARCH_CACHE_TTL,
        })
        .catch(() => {});
    }

    return results;
  } catch {
    return [];
  }
}

// ─── Stickers ─────────────────────────────────────────────────────────────

export interface StickerPack {
  id: string;
  name: string;
  creatorId: string;
  stickers: Sticker[];
  createdAt: number;
}

export interface Sticker {
  id: string;
  url: string;
  emoji?: string;
  width: number;
  height: number;
}

/**
 * Create a sticker pack.
 */
export async function createStickerPack(
  env: Env,
  name: string,
  creatorId: string,
  stickers: Array<{ buffer: ArrayBuffer; mimeType: string; emoji?: string }>,
): Promise<StickerPack> {
  const packId = `sticker_pack_${crypto.randomUUID().slice(0, 8)}`;
  const processedStickers: Sticker[] = [];

  for (const sticker of stickers) {
    const stickerId = `sticker_${crypto.randomUUID().slice(0, 8)}`;
    const ext = sticker.mimeType === 'image/png' ? '.png' : '.webp';
    const storageKey = `stickers/${packId}/${stickerId}${ext}`;

    const r2Result = await uploadToR2(storageKey, sticker.buffer, sticker.mimeType, env);

    processedStickers.push({
      id: stickerId,
      url: r2Result.cdnUrl,
      emoji: sticker.emoji,
      width: 512,
      height: 512,
    });
  }

  const pack: StickerPack = {
    id: packId,
    name: name.slice(0, 100),
    creatorId: creatorId.toLowerCase(),
    stickers: processedStickers,
    createdAt: Date.now(),
  };

  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (kv) {
    await kv.put(`${STICKER_PACK_PREFIX}${packId}`, JSON.stringify(pack), {
      expirationTtl: 86400 * 365,
    });

    // Index for user
    const userKey = `${STICKER_USER_PREFIX}${creatorId.toLowerCase()}`;
    const existingRaw = await kv.get(userKey).catch(() => null);
    const existing: string[] = existingRaw ? JSON.parse(existingRaw) : [];
    existing.push(packId);
    await kv.put(userKey, JSON.stringify(existing), {
      expirationTtl: 86400 * 365,
    });
  }

  return pack;
}

/**
 * Get sticker pack by ID.
 */
export async function getStickerPack(env: Env, packId: string): Promise<StickerPack | null> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return null;
  try {
    const raw = await kv.get(`${STICKER_PACK_PREFIX}${packId}`);
    return raw ? (JSON.parse(raw) as StickerPack) : null;
  } catch {
    return null;
  }
}

/**
 * Get user's sticker packs.
 */
export async function getUserStickerPacks(env: Env, userId: string): Promise<StickerPack[]> {
  const kv = env.CACHE ?? env.CONTENT_LIBRARY;
  if (!kv) return [];
  try {
    const userKey = `${STICKER_USER_PREFIX}${userId.toLowerCase()}`;
    const raw = await kv.get(userKey);
    if (!raw) return [];

    const packIds: string[] = JSON.parse(raw);
    const packs: StickerPack[] = [];
    for (const packId of packIds) {
      const pack = await getStickerPack(env, packId);
      if (pack) packs.push(pack);
    }
    return packs;
  } catch {
    return [];
  }
}

// ─── Location Helpers ─────────────────────────────────────────────────────

/**
 * Create a location share media object.
 */
export function createLocationMedia(
  conversationId: string,
  senderId: string,
  latitude: number,
  longitude: number,
  options?: { name?: string; address?: string },
): ChatMedia {
  return {
    id: generateMediaId(),
    type: 'location',
    conversationId,
    senderId: senderId.toLowerCase(),
    createdAt: Date.now(),
    location: {
      latitude,
      longitude,
      name: options?.name,
      address: options?.address,
    },
  };
}

/**
 * Create a contact share media object.
 */
export function createContactMedia(
  conversationId: string,
  senderId: string,
  walletAddress: string,
  options?: { displayName?: string; avatar?: string; bio?: string },
): ChatMedia {
  return {
    id: generateMediaId(),
    type: 'contact',
    conversationId,
    senderId: senderId.toLowerCase(),
    createdAt: Date.now(),
    contact: {
      walletAddress: walletAddress.toLowerCase(),
      displayName: options?.displayName,
      avatar: options?.avatar,
      bio: options?.bio,
    },
  };
}

// ─── Media Size Validation ────────────────────────────────────────────────

/**
 * Validate whether a file is within allowed size limits.
 */
export function validateMediaSize(
  size: number,
  mimeType: string,
  isPremium: boolean,
): { allowed: boolean; reason?: string } {
  const limit = isPremium ? MAX_FILE_SIZE_PREMIUM : MAX_FILE_SIZE_FREE;

  if (mimeType.startsWith('image/') && size > MAX_IMAGE_SIZE) {
    return { allowed: false, reason: 'Image exceeds 50MB limit' };
  }
  if (mimeType.startsWith('video/') && size > MAX_VIDEO_SIZE) {
    return { allowed: false, reason: 'Video exceeds 500MB limit' };
  }
  if (mimeType.startsWith('audio/') && size > MAX_AUDIO_SIZE) {
    return { allowed: false, reason: 'Audio exceeds 100MB limit' };
  }
  if (size > limit) {
    return {
      allowed: false,
      reason: `File exceeds ${isPremium ? '2GB' : '100MB'} limit. ${isPremium ? '' : 'Upgrade to premium for 2GB uploads.'}`,
    };
  }

  return { allowed: true };
}
