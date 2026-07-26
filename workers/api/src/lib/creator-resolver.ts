/**
 * @degenfeed/api-worker — CreatorResolver
 *
 * Resolve a creator's identity across ALL video platforms.
 * "Follow creators, not platforms" — users follow a creator ONCE
 * and get their content from everywhere. The platform badge is
 * informational, not limiting.
 *
 * identifier can be:
 *   - wallet address (0x... or Solana)
 *   - DegenFeed handle (@user)
 *   - YouTube channel ID (UC...)
 *   - Twitch channel name
 *   - Rumble channel name
 *   - PeerTube handle (@user@instance)
 *   - TikTok username
 *   - Instagram username
 *   - Zora address (0x...)
 *   - Any platform URL
 *
 * KV cache prefix: creator:resolve:* (24h TTL)
 */

import type { Env } from '../types';

// ─── Constants ─────────────────────────────────────────────────────────────

export const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://invidious.privacydev.net',
  'https://yewtu.be',
];

export const VIDEO_PLATFORM_COLORS: Record<string, string> = {

export const VIDEO_PLATFORM_LABELS: Record<string, string> = {

// ─── Types ─────────────────────────────────────────────────────────────────

export type VideoPlatform =
  | 'youtube'
  | 'twitch'
  | 'rumble'
  | 'peertube'
  | 'tiktok'
  | 'instagram'
  | 'odysee'
  | 'zora'
  | 'dtube'
  | 'bitchute'
  | 'dailymotion'
  | 'vimeo'
  | 'lbry';

export interface PlatformPresence {

export interface CreatorPresence {

export interface CreatorSearchResult {

// ─── CreatorResolver ───────────────────────────────────────────────────────

export class CreatorResolver {

