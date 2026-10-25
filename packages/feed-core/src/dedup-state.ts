// ─── Deduplication state ────────────────────────────────────────────────
// Single responsibility: remember what has already been accepted into the feed.
import type { UnifiedPost } from '@degenfeed/types';

/** Sets keyed by every dedup signal we track. */
export interface SeenSets {
  id: Set<string>;
  fingerprint: Set<string>;
  normalized: Set<string>;
  url: Set<string>;
  canonicalUrl: Set<string>;
  prefix: Set<string>;
  shortExact: Set<string>;
  authorWindow: Set<string>;
  quoted: Set<string>;
  ticker: Set<string>;
  embed: Set<string>;
  imageFp: Set<string>;
  perceptualHash: Set<string>;
  rssOrigin: Set<string>;
}

/** Signals computed once per post and reused by every dedup pass. */
export interface PostSignals {
  fp: string | null;
  norm: string;
  purl: string | null;
  curl: string | null;
  prefix: string;
  windowKey: string;
  qid: string | null;
  ts: string;
  eid: string | null;
  imgFp: string | null;
  phash: string | null;
  words: Set<string>;
  cleanText: string;
}

export function createSeen(): SeenSets {
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

/** Record that a kept post was also seen on another protocol. */
export function markCrossPosted(existing: UnifiedPost, protocol: string): void {
  const record = existing as unknown as Record<string, unknown>;
  const cross = (record.crossPostedTo as string[]) ?? [];
  if (!cross.includes(protocol)) cross.push(protocol);
  record.crossPostedTo = cross;
}

/** Persist the signals of an accepted post so later posts can be matched. */
export function markSeen(seen: SeenSets, p: UnifiedPost, s: PostSignals): void {
  seen.id.add(p.id);
  if (s.fp) seen.fingerprint.add(s.fp);
  if (s.norm.length > 15) seen.normalized.add(s.norm);
  if (s.purl) seen.url.add(s.purl);
  if (s.curl) seen.canonicalUrl.add(s.curl);
  if (s.prefix.length > 12) seen.prefix.add(s.prefix);
  if (s.fp) seen.authorWindow.add(s.windowKey);
  if (s.qid) seen.quoted.add(s.qid);
  if (s.ts.length > 3) seen.ticker.add(s.ts);
  if (s.eid) seen.embed.add(s.eid);
  if (s.imgFp) seen.imageFp.add(s.imgFp);
  if (s.phash) seen.perceptualHash.add(s.phash);
}
