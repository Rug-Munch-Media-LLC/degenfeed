// ─── Test-only differential oracle ──────────────────────────────────────
// The pre-split deduplicatePosts loop, restored verbatim in behaviour from
// the monolith (packages/feed-core/src/index.ts @ HEAD before the split).
// It exists ONLY so dedup-parity.test.ts can diff the split implementation
// against the original pass order and guards. Never import from product code.
import type { UnifiedPost } from '@degenfeed/types';
import { isFromAggregator } from '../cross-post';
import {
  authorKey,
  contentFingerprint,
  embedFingerprint,
  extractQuotedId,
  imageFingerprint,
} from '../fingerprints';
import { imagePerceptualFingerprint } from '../image-hash';
import { extractDomain } from '../post-domain';
import { postTitle } from '../post-title';
import {
  jaccardSimilarity,
  normalizedLevenshtein,
  normalizeStripped,
  wordSet,
} from '../text-similarity';
import {
  extractCanonicalUrl,
  normalizeUrlForDedup,
  primaryUrl,
  tickerSnapshot,
} from '../url-identity';
import {
  cleanOf,
  createLegacySeen,
  JACCARD_THRESHOLD,
  MIN_TEXT_LENGTH,
  markCross,
} from './legacy-helpers';

export function legacyDeduplicatePosts(posts: UnifiedPost[]): UnifiedPost[] {
  const seen = createLegacySeen();
  const candidates: { words: Set<string>; index: number }[] = [];
  const shortTextCandidates: { text: string; index: number }[] = [];
  const out: UnifiedPost[] = [];

  for (const p of posts) {
    if (seen.id.has(p.id)) continue;

    const fp = contentFingerprint(p);
    if (fp && seen.fingerprint.has(fp)) continue;

    const norm = normalizeStripped(p.text);
    if (norm.length > 15 && seen.normalized.has(norm)) continue;

    const purl = primaryUrl(p);
    if (purl && seen.url.has(purl)) continue;

    const curl = extractCanonicalUrl(p);
    if (curl && seen.canonicalUrl.has(curl)) {
      const matched = out.find((o) => extractCanonicalUrl(o) === curl);
      if (matched) markCross(matched, p.protocol);
      continue;
    }

    const prefix = p.text.trim().slice(0, 120).toLowerCase();
    if (prefix.length > 12 && seen.prefix.has(prefix)) continue;

    if (p.text.trim().length <= 80) {
      const exact = p.text.trim().toLowerCase();
      if (exact.length > 0 && seen.shortExact.has(exact)) continue;
      if (exact.length > 0) seen.shortExact.add(exact);
    }

    const windowKey = `${authorKey(p)}|${fp}`;
    if (fp && seen.authorWindow.has(windowKey)) continue;

    const qid = extractQuotedId(p);
    if (qid && seen.quoted.has(qid)) continue;

    const ts = tickerSnapshot(p.text);
    if (ts.length > 3 && seen.ticker.has(ts)) continue;

    const eid = embedFingerprint(p);
    if (eid && seen.embed.has(eid)) continue;

    const imgFp = imageFingerprint(p);
    if (imgFp && seen.imageFp.has(imgFp)) continue;

    const phash = imagePerceptualFingerprint(p);
    if (phash && seen.perceptualHash.has(phash)) continue;

    if (p.protocol === 'rss') {
      const articleTitle = postTitle(p);
      const domain = extractDomain(p);
      if (articleTitle && domain) {
        const rssKey = `rss:${domain}:${articleTitle.toLowerCase().slice(0, 80)}`;
        if (seen.rssOrigin.has(rssKey)) {
          const existing = out.find((o) => {
            const et = postTitle(o);
            const ed = extractDomain(o);
            if (!et || !ed) return false;
            return `rss:${ed}:${et.toLowerCase().slice(0, 80)}` === rssKey;
          });
          if (existing) {
            markCross(existing, p.protocol);
            if ((p.text?.length ?? 0) > (existing.text?.length ?? 0)) {
              const idx = out.indexOf(existing);
              if (idx !== -1) out[idx] = p;
            }
          }
          continue;
        }
        seen.rssOrigin.add(rssKey);
      }
    }

    if (isFromAggregator(p)) {
      let matchedAggregator = false;
      const curl2 = extractCanonicalUrl(p);
      if (curl2) {
        const normalCurl = normalizeUrlForDedup(curl2);
        for (const existing of out) {
          const existingUrl = extractCanonicalUrl(existing);
          if (existingUrl && normalizeUrlForDedup(existingUrl) === normalCurl) {
            matchedAggregator = true;
            markCross(existing, p.protocol);
            break;
          }
        }
      }
      if (matchedAggregator) continue;
    }

    const ws = wordSet(p.text);
    let matchedProtocol: string | undefined;
    if (!qid && ws.size >= 3 && p.text.length > MIN_TEXT_LENGTH) {
      for (const cand of candidates) {
        if (jaccardSimilarity(ws, cand.words) >= JACCARD_THRESHOLD) {
          const existing = out[cand.index];
          if (!existing) continue;
          matchedProtocol = existing.protocol;
          markCross(existing, p.protocol);
          break;
        }
      }
    }

    if (!matchedProtocol && !qid && p.text.length > 15 && p.text.length < 300) {
      const cleanText = cleanOf(p.text);
      if (cleanText.length > 10) {
        for (const cand of shortTextCandidates) {
          if (normalizedLevenshtein(cleanText, cand.text) >= 0.85) {
            const existing = out[cand.index];
            if (!existing) continue;
            matchedProtocol = existing.protocol;
            markCross(existing, p.protocol);
            break;
          }
        }
      }
    }

    if (matchedProtocol) continue;

    seen.id.add(p.id);
    if (fp) seen.fingerprint.add(fp);
    if (norm.length > 15) seen.normalized.add(norm);
    if (purl) seen.url.add(purl);
    if (curl) seen.canonicalUrl.add(curl);
    if (prefix.length > 12) seen.prefix.add(prefix);
    if (fp) seen.authorWindow.add(windowKey);
    if (qid) seen.quoted.add(qid);
    if (ts.length > 3) seen.ticker.add(ts);
    if (eid) seen.embed.add(eid);
    if (imgFp) seen.imageFp.add(imgFp);
    if (phash) seen.perceptualHash.add(phash);

    candidates.push({ words: ws, index: out.length });
    const cleanText = cleanOf(p.text);
    if (cleanText.length > 10 && cleanText.length < 300) {
      shortTextCandidates.push({ text: cleanText, index: out.length });
    }
    out.push(p);
  }

  return out;
}
