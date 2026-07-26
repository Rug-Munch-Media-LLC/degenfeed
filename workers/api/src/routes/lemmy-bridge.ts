/**
 * @degenfeed/api-worker — Lemmy Cross-Protocol Bridge
 *
 * Bridges content between Lemmy and other protocols:
 *   1. Cross-post DegenFeed content → Lemmy community
 *   2. Share Lemmy content → Mastodon / Nostr
 *   3. Auto-suggest best community for content
 *
 * Endpoints:
 *   POST /api/lemmy/bridge/cross-post   — Cross-post content TO a Lemmy community
 *   POST /api/lemmy/bridge/share        — Share a Lemmy post TO other protocols
 *   GET  /api/lemmy/bridge/status       — Bridge status and connected accounts
 */

import { LemmyClient } from '@degenfeed/lemmy-sdk';
import { jsonResponse } from '../response-helpers';
import { sanitizeString } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────

const BRIDGE_INSTANCE = 'https://community.degenfeed.xyz';

/** Communities on our self-hosted instance that we bridge content to. */
const BRIDGE_COMMUNITIES = [
  { id: 'crypto', title: 'Crypto' },
  { id: 'defi', title: 'DeFi' },
  { id: 'nft', title: 'NFT' },
  { id: 'tech', title: 'Tech' },
  { id: 'news', title: 'News' },
  { id: 'memes', title: 'Memes' },
  { id: 'governance', title: 'Governance' },
  { id: 'security', title: 'Security' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'gaming', title: 'Gaming' },
  { id: 'science', title: 'Science' },
  { id: 'trading', title: 'Trading' },
];

/** Niche keyword → community mapping for auto-suggestion. */
const NICHE_COMMUNITY_MAP: Record<string, string[]> = {
