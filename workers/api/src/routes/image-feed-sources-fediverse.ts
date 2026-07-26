/**
 * @degenfeed/api-worker — Unified Image Feed Source Fetchers
 *
 * Source-specific image fetchers for all supported protocols.
 * Each fetcher handles its own error handling, rate limit tracking,
 * response validation, and fallback.
 *
 * Sources: Pixelfed, Zora, Mastodon/GTS, Nostr (NIP-94, kind 1 with images),
 *          Bluesky, Lens, IPFS/Arweave, Reddit, Immich/Lychee
 */

import { log } from '../logger';
import type { Env } from '../types';
import type { ImageSource, UnifiedImage } from './image-feed-types';
import { extractImageUrl, fetchWithTimeout, guessCategory, metaFor, stripHtml } from './image-feed-types';

// ─── Source Fetchers ──────────────────────────────────────────────────────

/** 1. Pixelfed — federated ActivityPub image posts */
export async function fetchPixelfedImages(_env: Env, limit: number): Promise<UnifiedImage[]> {
