/**
 * @degenfeed/api-worker — Farcaster Frame Utilities
 */

import type { Env } from '../index';
import { STREAM_PREFIX, SPACE_PREFIX, COIN_PREFIX } from './types';

export async function getStream(env: Env, id: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await env.CONTENT_STORE?.get(`${STREAM_PREFIX}${id}`);
    if (!raw) { const raw2 = await env.STREAMS?.get(`${STREAM_PREFIX}${id}`); if (!raw2) return null; return JSON.parse(raw2); }
    return JSON.parse(raw);
  } catch { return null; }
}

export async function getSpace(env: Env, id: string): Promise<Record<string, unknown> | null> {
  try { const raw = await env.SPACES?.get(`${SPACE_PREFIX}${id}`); if (!raw) return null; return JSON.parse(raw); }
  catch { return null; }
}

export async function getCreatorCoin(env: Env, symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const key = `${COIN_PREFIX}${symbol.toLowerCase()}`;
    const raw = await env.CACHE?.get(key);
    if (raw) return JSON.parse(raw);
    const raw2 = await env.FARCASTER_COINS?.get(key);
    if (raw2) return JSON.parse(raw2);
    return null;
  } catch { return null; }
}

export function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
