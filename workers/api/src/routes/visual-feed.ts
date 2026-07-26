/**
 * visual-feed route — /api/feed/visual*
 *
 * Visual media feed aggregating from Pixelfed, Zora, Bluesky, Nostr,
 * Farcaster, and GoToSocial into a unified masonry-grid feed.
 *
 * Query params:
 *   sources=pixelfed,zora,bluesky — comma-separated source list (default: all)
 *   filter=all|photos|nfts|video|bluesky — media type filter
 *   sort=newest|trending|top — sort order
 *   cursor=0 — pagination offset
 *   limit=30 — results per page (max 100)
 */

import type { VisualSource } from '@degenfeed/types';
import {
