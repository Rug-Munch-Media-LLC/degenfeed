/** Cashtag extraction — `$SOL`, `$PEPE`. Money amounts ($100) never match. */

const CASHTAG_RE = /\$([A-Za-z][A-Za-z0-9]{1,9})\b/g;

/** Uppercase ticker symbols, de-duplicated, first appearance order. */
export function extractCashtags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(CASHTAG_RE)) {
    const raw = match[1];
    if (!raw) continue;
    if (!/[A-Za-z]/.test(raw)) continue;
    seen.add(raw.toUpperCase());
  }
  return [...seen];
}
