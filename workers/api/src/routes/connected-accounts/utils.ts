/**
 * @degenfeed/api-worker — Connected Accounts Utilities
 */

import type { Env } from '../../types';
import { connectedUserIndexKey } from '../connected-accounts-types';

export function connectedAccountKey(wallet: string, platform: string): string {
  return `connected:account:${wallet.toLowerCase()}:${platform}`;
}

export async function removePlatformFromIndex(env: Env, wallet: string, platform: string): Promise<void> {
  try {
    const key = connectedUserIndexKey(wallet);
    const raw = await env.CACHE?.get(key);
    if (!raw) return;
    const platforms: string[] = JSON.parse(raw) as string[];
    const filtered = platforms.filter((p) => p !== platform);
    await env.CACHE?.put(key, JSON.stringify(filtered), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
  } catch {
    // Non-fatal
  }
}

export function getStatePrefix(platform: string): string | null {
  const map: Record<string, string> = {
    medium: 'medium_',
    youtube: 'yt_',
    linkedin: 'li_',
    instagram: 'ig_',
    reddit: 'rd_',
    pinterest: 'pt_',
    tiktok: 'tt_',
  };
  return map[platform] ?? null;
}

export async function addPlatformToIndex(env: Env, wallet: string, platform: string): Promise<void> {
  try {
    const key = connectedUserIndexKey(wallet);
    const raw = await env.CACHE?.get(key);
    const platforms: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!platforms.includes(platform)) {
      platforms.push(platform);
      await env.CACHE?.put(key, JSON.stringify(platforms), {
        expirationTtl: 60 * 60 * 24 * 365,
      });
    }
  } catch {
    // Non-fatal
  }
}
