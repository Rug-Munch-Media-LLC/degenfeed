/**
 * @degenfeed/api-worker — Connected Accounts Types
 *
 * Shared types, KV helpers, and platform constants for centralized
 * platform OAuth connections (Medium, YouTube, LinkedIn, Reddit,
 * Instagram, TikTok, Pinterest, Substack).
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import {
  consumeState,
  generateOAuthState,
  INSTAGRAM_STATE_PREFIX,
  LINKEDIN_STATE_PREFIX,
  MEDIUM_STATE_PREFIX,
  PINTEREST_STATE_PREFIX,
  storeState,
  TIKTOK_STATE_PREFIX,
  YOUTUBE_STATE_PREFIX,
} from './oauth-state';

// ─── KV key helpers ───────────────────────────────────────────────────────

export function connectedAccountKey(wallet: string, platform: string): string {
  return `connected:account:${wallet.toLowerCase()}:${platform}`;
}

export function connectedUserIndexKey(wallet: string): string {
  return `connected:user:${wallet.toLowerCase()}`;
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface ConnectedAccount {
  platform: string;
  label: string;
  accessToken: string;
  refreshToken?: string;
  platformUserId: string;
  connectedAt: string;
  lastRefreshedAt?: string;
  expiresAt?: number;
  metadata?: Record<string, string>;
}

export type CentralizedPlatform =
  | 'medium'
  | 'substack'
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'linkedin'
  | 'reddit'
  | 'pinterest';

export const CENTRALIZED_PLATFORMS: CentralizedPlatform[] = [
  'medium',
  'substack',
  'youtube',
  'tiktok',
  'instagram',
  'linkedin',
  'reddit',
  'pinterest',
];

export const PLATFORM_LABELS: Record<string, string> = {
  medium: 'Medium',
  substack: 'Substack',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
};

export const PLATFORM_ICONS: Record<string, string> = {
  medium: '✍️',
  substack: '✉️',
  youtube: '▶️',
  tiktok: '🎵',
  instagram: '📷',
  linkedin: '💼',
  reddit: '🤖',
  pinterest: '📌',
};

export function getStatePrefix(platform: string): string | null {
  const map: Record<string, string> = {
    medium: MEDIUM_STATE_PREFIX,
    youtube: YOUTUBE_STATE_PREFIX,
    linkedin: LINKEDIN_STATE_PREFIX,
    instagram: INSTAGRAM_STATE_PREFIX,
    pinterest: PINTEREST_STATE_PREFIX,
    tiktok: TIKTOK_STATE_PREFIX,
  };
  return map[platform] ?? null;
}
