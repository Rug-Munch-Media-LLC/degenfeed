/**
 * Promo / presale lexicon.
 *
 * Strength is lexical, not a verdict: `high` = guarantee or "send funds" language,
 * `medium` = presale/airdrop mechanics, `low` = disclaimer/hype-only.
 */
import type { LexiconField, LexiconHit, LexiconStrength } from '../types';

export interface LexiconTerm {
  term: string;
  family: string;
  strength: LexiconStrength;
}

export const LEXICON: readonly LexiconTerm[] = [
  { term: 'presale', family: 'presale', strength: 'medium' },
  { term: 'pre-sale', family: 'presale', strength: 'medium' },
  { term: 'fair launch', family: 'presale', strength: 'medium' },
  { term: 'stealth launch', family: 'presale', strength: 'medium' },
  { term: 'whitelist', family: 'presale', strength: 'medium' },
  { term: 'early access', family: 'presale', strength: 'medium' },
  { term: 'airdrop', family: 'giveaway', strength: 'medium' },
  { term: 'giveaway', family: 'giveaway', strength: 'medium' },
  { term: 'claim now', family: 'giveaway', strength: 'high' },
  { term: 'double your', family: 'guarantee', strength: 'high' },
  { term: 'guaranteed', family: 'guarantee', strength: 'high' },
  { term: 'risk-free', family: 'guarantee', strength: 'high' },
  { term: 'send to', family: 'guarantee', strength: 'high' },
  { term: 'connect wallet', family: 'promo', strength: 'high' },
  { term: 'limited spots', family: 'urgency', strength: 'high' },
  { term: 'act fast', family: 'urgency', strength: 'high' },
  { term: 'before it', family: 'urgency', strength: 'medium' },
  { term: 'last chance', family: 'urgency', strength: 'high' },
  { term: '100x', family: 'hype', strength: 'high' },
  { term: '1000x', family: 'hype', strength: 'high' },
  { term: 'next 100x', family: 'hype', strength: 'high' },
  { term: 'guaranteed gains', family: 'guarantee', strength: 'high' },
  { term: 'link in description', family: 'promo', strength: 'medium' },
  { term: 'link below', family: 'promo', strength: 'medium' },
  { term: 'join telegram', family: 'promo', strength: 'medium' },
  { term: 't.me/', family: 'promo', strength: 'medium' },
  { term: 'not financial advice', family: 'disclaimer', strength: 'low' },
  { term: 'dyor', family: 'disclaimer', strength: 'low' },
  { term: 'to the moon', family: 'hype', strength: 'low' },
  { term: 'gem', family: 'hype', strength: 'low' },
] as const;

const STRENGTH_ORDER: Record<LexiconStrength, number> = { low: 0, medium: 1, high: 2 };

/** Scan one field; hits are de-duplicated per term. */
export function scanLexicon(text: string, field: LexiconField): LexiconHit[] {
  const haystack = text.toLowerCase();
  const hits: LexiconHit[] = [];
  for (const entry of LEXICON) {
    if (!haystack.includes(entry.term)) continue;
    hits.push({
      term: entry.term,
      family: entry.family,
      strength: entry.strength,
      field,
    });
  }
  return hits;
}

/** Strongest hit in a hit list, or null. */
export function strongestHit(hits: readonly LexiconHit[]): LexiconHit | null {
  let best: LexiconHit | null = null;
  for (const hit of hits) {
    if (!best || STRENGTH_ORDER[hit.strength] > STRENGTH_ORDER[best.strength]) best = hit;
  }
  return best;
}
