import type { Env } from '../types';

export const GOOGLE_STATE_PREFIX = 'google:state:';
export const GITHUB_STATE_PREFIX = 'github:state:';
export const DISCORD_STATE_PREFIX = 'discord:state:';
export const TWITTER_STATE_PREFIX = 'twitter:state:';
export const TELEGRAM_STATE_PREFIX = 'telegram:state:';
export const REDDIT_STATE_PREFIX = 'reddit:state:';
export const MEDIUM_STATE_PREFIX = 'medium:state:';
export const YOUTUBE_STATE_PREFIX = 'youtube:state:';
export const LINKEDIN_STATE_PREFIX = 'linkedin:state:';
export const INSTAGRAM_STATE_PREFIX = 'instagram:state:';
export const PINTEREST_STATE_PREFIX = 'pinterest:state:';
export const TIKTOK_STATE_PREFIX = 'tiktok:state:';
const STATE_TTL_SECONDS = 600;

export function generateOAuthState(): string {
