/**
 * Storj Adapter
 *
 * Decentralized S3-compatible object storage.
 * Uses Uplink CLI or S3-compatible gateway.
 * S3 gateway: https://gateway.storjshare.io
 *
 * API: S3-compatible (AWS SDK) or Uplink CLI
 *      https://storj.dev/dcs/api/s3/s3-compatible-gateway
 */
import type { UnifiedPost } from '@degenfeed/types';

const $fetch = globalThis.fetch;

export async function storjListBucket(bucket: string, accessKey?: string): Promise<string[]> {
  try {
    const url = `https://gateway.storjshare.io/${encodeURIComponent(bucket)}`;
    const headers: Record<string, string> = { 'User-Agent': 'DegenFeed/0.1' };
    if (accessKey) headers.Authorization = `Bearer ${accessKey}`;
    const res = await $fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.text();
    // Parse S3 XML response for object keys
    const keys = data.match(/<Key>([^<]+)<\/Key>/g) || [];
    return keys.map((k) => k.replace(/<\/?Key>/g, ''));
  } catch {
    return [];
  }
}

export async function fetchStorjPosts(_limit = 10): Promise<UnifiedPost[]> {
  return []; // Storage protocol — no native social feed
}
