/**
 * Shill intake — turn a VideoRecord into normalised `shill_candidate` leads.
 *
 * Deliberately NOT a verdict engine: one candidate per (video, address) with the
 * quote and its transcript timestamp so the scam-proof lane can adjudicate.
 */
import { scanLexicon, strongestHit } from './extract';
import type { ChainFamily, LexiconField, ShillCandidate, VideoRecord } from './types';

const QUOTE_LIMIT = 280;

interface Located {
  quote: string;
  field: LexiconField;
  timestampMs: number | null;
}

function sentenceAround(text: string, needle: string): string | null {
  const index = text.indexOf(needle);
  if (index < 0) return null;
  const before = text.slice(0, index);
  const start = Math.max(
    before.lastIndexOf('. '),
    before.lastIndexOf('\n'),
    before.lastIndexOf('! '),
  );
  const from = start < 0 ? 0 : start + 1;
  const rest = text.slice(index);
  const endMatch = /[.!?\n]/.exec(rest);
  const to = endMatch ? index + (endMatch.index ?? 0) + 1 : text.length;
  return text.slice(from, to).replace(/\s+/g, ' ').trim().slice(0, QUOTE_LIMIT);
}

/** First place the address appears, preferring transcript (it carries a timestamp). */
function locate(record: VideoRecord, address: string): Located | null {
  for (const segment of record.transcript.segments) {
    if (!segment.text.includes(address)) continue;
    const quote = sentenceAround(segment.text, address);
    if (quote) return { quote, field: 'transcript', timestampMs: segment.startMs };
  }
  const fromDescription = sentenceAround(record.description, address);
  if (fromDescription) return { quote: fromDescription, field: 'description', timestampMs: null };
  const fromTitle = sentenceAround(record.title, address);
  if (fromTitle) return { quote: fromTitle, field: 'title', timestampMs: null };
  return null;
}

function claimFor(quote: string): string {
  const hit = strongestHit(scanLexicon(quote, 'description'));
  return hit ? hit.term : 'address_mentioned';
}

/** One candidate per detected address; stable id = `<videoId>:<address>`. */
export function buildShillCandidates(record: VideoRecord): ShillCandidate[] {
  const candidates: ShillCandidate[] = [];
  for (const detected of record.addresses) {
    const located = locate(record, detected.address);
    if (!located) continue;
    candidates.push({
      id: `${record.videoId}:${detected.address}`,
      videoId: record.videoId,
      channelId: record.channelId,
      address: detected.address,
      chain: detected.chain as ChainFamily,
      claim: claimFor(located.quote),
      quote: located.quote,
      timestampMs: located.timestampMs,
      field: located.field,
      publishedAt: record.publishedAt,
      status: 'candidate',
      provenance: record.provenance,
    });
  }
  return candidates;
}
