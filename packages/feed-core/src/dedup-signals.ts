// ─── Dedup signal collection ────────────────────────────────────────────
// Single responsibility: compute every fingerprint once per post.
import type { UnifiedPost } from '@degenfeed/types';
import type { PostSignals } from './dedup-state';
import {
  authorKey,
  contentFingerprint,
  embedFingerprint,
  extractQuotedId,
  imageFingerprint,
} from './fingerprints';
import { imagePerceptualFingerprint } from './image-hash';
import { normalizeStripped, wordSet } from './text-similarity';
import { extractCanonicalUrl, primaryUrl, tickerSnapshot } from './url-identity';

export function collectSignals(p: UnifiedPost): PostSignals {
  const fp = contentFingerprint(p);
  return {
    fp,
    norm: normalizeStripped(p.text),
    purl: primaryUrl(p),
    curl: extractCanonicalUrl(p),
    prefix: p.text.trim().slice(0, 120).toLowerCase(),
    windowKey: `${authorKey(p)}|${fp}`,
    qid: extractQuotedId(p),
    ts: tickerSnapshot(p.text),
    eid: embedFingerprint(p),
    imgFp: imageFingerprint(p),
    phash: imagePerceptualFingerprint(p),
    words: wordSet(p.text),
    cleanText: normalizeStripped(p.text),
  };
}
