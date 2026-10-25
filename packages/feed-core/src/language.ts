// ─── Language gate ────────────────────────────────────────────────────
// Single responsibility: decide whether a post reads as English.

import { ENGLISH_STOPWORDS } from './stopwords';

export function isEnglishPost(text: string): boolean {
  if (!text || text.length < 10) return true;
  const words = text.toLowerCase().split(/\s+/);
  let hits = 0;
  for (const w of words) {
    if (ENGLISH_STOPWORDS.has(w)) hits++;
    if (hits >= 3) return true;
  }
  return hits >= 3;
}
