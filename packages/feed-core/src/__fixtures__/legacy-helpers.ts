// ─── Test-only helpers for the legacy dedup oracle ─────────────────────
import type { Protocol, UnifiedPost } from '@degenfeed/types';

export const JACCARD_THRESHOLD = 0.7;
export const MIN_TEXT_LENGTH = 20;

export function markCross(post: UnifiedPost, protocol: Protocol): void {
  const record = post as unknown as Record<string, unknown>;
  const cross = (record.crossPostedTo as string[]) ?? [];
  if (!cross.includes(protocol)) cross.push(protocol);
  record.crossPostedTo = cross;
}

export function cleanOf(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createLegacySeen() {
  return {
    id: new Set<string>(),
    fingerprint: new Set<string>(),
    normalized: new Set<string>(),
    url: new Set<string>(),
    canonicalUrl: new Set<string>(),
    prefix: new Set<string>(),
    shortExact: new Set<string>(),
    authorWindow: new Set<string>(),
    quoted: new Set<string>(),
    ticker: new Set<string>(),
    embed: new Set<string>(),
    imageFp: new Set<string>(),
    perceptualHash: new Set<string>(),
    rssOrigin: new Set<string>(),
  };
}
