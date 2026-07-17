/**
 * Simple token detection from post text.
 *
 * Matches:
 *   - $TICKER patterns (2-10 uppercase letters after $)
 *   - EVM addresses (0x-prefixed, 40 hex chars)
 *   - Solana addresses (base58, 32-44 chars)
 *
 * Returns up to 3 unique token references per call.
 */

export interface TokenRef {
  symbol?: string;
  address?: string;
  chain?: string;
}

const TICKER_RE = /\$([A-Z]{2,10})\b/g;
const EVM_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

export function detectTokens(text: string): TokenRef[] {
  const tokens: TokenRef[] = [];

  // Match $TICKER patterns
  let match: RegExpExecArray | null;
  while ((match = TICKER_RE.exec(text)) !== null) {
    tokens.push({ symbol: match[1] });
  }

  // Match EVM addresses (0x...40 chars)
  while ((match = EVM_RE.exec(text)) !== null) {
    tokens.push({ address: match[0].toLowerCase(), chain: 'ethereum' });
  }

  // Match Solana addresses (base58, 32-44 chars)
  while ((match = SOL_RE.exec(text)) !== null) {
    // Avoid matching EVM addresses (already caught by EVM_RE) or hashes
    if (!match[0].startsWith('0x')) {
      tokens.push({ address: match[0], chain: 'solana' });
    }
  }

  // Deduplicate by symbol+address combo
  const seen = new Set<string>();
  return tokens
    .filter((t) => {
      const key = `${t.symbol ?? ''}:${t.address ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
}
