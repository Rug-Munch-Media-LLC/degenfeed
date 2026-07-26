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

export type ChatMedia = {};
