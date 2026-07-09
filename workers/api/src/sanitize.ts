const SUSPICIOUS_PATTERNS = [/<script/i, /javascript:/i];

export const ALLOWED_PROTOCOLS = new Set([
  'nostr',
  'farcaster',
  'lens',
  'bluesky',
  'threads',
  'rss',
  'mastodon',
  'ethereum',
  'solana',
]);

export function hasSuspiciousPayload(value: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(value));
}

function isControlChar(code: number): boolean {
  return (
    (code >= 0x00 && code <= 0x08) ||
    code === 0x0b ||
    code === 0x0c ||
    (code >= 0x0e && code <= 0x1f) ||
    code === 0x7f
  );
}

export function sanitizeString(input: unknown, maxLength: number): string {
  if (typeof input !== 'string') return '';
  let cleaned = '';
  for (const char of input) {
    if (isControlChar(char.charCodeAt(0))) continue;
    cleaned += char;
  }
  return cleaned.trim().slice(0, maxLength).trim();
}

export function sanitizeStringArray(input: unknown, maxLength: number, maxItems = 50): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => sanitizeString(item, maxLength))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

const AMOUNT_RE = /^(?!0+(?:\.0+)?$)\d+(?:\.\d{1,8})?$/;

export function isValidAmount(value: string): boolean {
  return AMOUNT_RE.test(value);
}

export function isAllowedProtocol(value: string): boolean {
  return ALLOWED_PROTOCOLS.has(value);
}

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidEvmAddress(value: string): boolean {
  return EVM_ADDRESS_RE.test(value);
}

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(value: string): boolean {
  return SOLANA_ADDRESS_RE.test(value);
}
