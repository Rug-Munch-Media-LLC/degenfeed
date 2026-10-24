/**
 * Contract/address extraction from free text (description, transcript).
 *
 * Chain is inferred from address shape only. Solana candidates must base58-decode
 * to exactly 32 bytes, so ordinary words cannot be reported as wallets.
 */
import type { ChainFamily, DetectedAddress } from '../types';

const EVM_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const BTC_BECH32_RE = /\bbc1[02-9ac-hj-np-z]{11,71}\b/gi;
const BTC_LEGACY_RE = /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g;
const SOL_CANDIDATE_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Byte length of a base58 string, or -1 when a character is not base58. */
function base58ByteLength(value: string): number {
  let acc = 0n;
  for (const char of value) {
    const digit = BASE58.indexOf(char);
    if (digit < 0) return -1;
    acc = acc * 58n + BigInt(digit);
  }
  let leadingZeros = 0;
  for (const char of value) {
    if (char !== '1') break;
    leadingZeros++;
  }
  const hex = acc === 0n ? '' : acc.toString(16);
  return leadingZeros + Math.ceil(hex.length / 2);
}

/** A Solana pubkey is 32 bytes; real keys are 43-44 base58 chars and mix case. */
function looksLikeSolana(value: string): boolean {
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value)) return false;
  return base58ByteLength(value) === 32;
}

/** Extract every distinct address, grouped by chain family (EVM, BTC, Solana). */
export function extractAddresses(text: string): DetectedAddress[] {
  const found = new Map<string, ChainFamily>();
  const take = (regex: RegExp, chain: ChainFamily): void => {
    for (const match of text.matchAll(regex)) {
      const value = match[0];
      if (!value) continue;
      if (chain === 'solana' && !looksLikeSolana(value)) continue;
      if (!found.has(value)) found.set(value, chain);
    }
  };
  take(EVM_RE, 'evm');
  take(BTC_BECH32_RE, 'bitcoin');
  take(BTC_LEGACY_RE, 'bitcoin');
  take(SOL_CANDIDATE_RE, 'solana');
  return [...found.entries()].map(([address, chain]) => ({ address, chain }));
}
