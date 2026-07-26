/**
 * @degenfeed/api-worker — Comprehensive Input Validation Middleware
 *
 * Validates request inputs against:
 *   1. SQL/XSS injection patterns
 *   2. Protocol identifier formats (Nostr, Farcaster, Bluesky)
 *   3. Wallet addresses (Ethereum, Solana)
 *   4. URL safety (reject javascript:, data: URIs)
 *   5. Per-endpoint body size limits
 *   6. Content-Type enforcement
 *
 * Designed to run as middleware BEFORE route handlers.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export interface BodySizeLimit {
  /** Maximum body size in bytes for this endpoint group */
  maxBytes: number;
}

// ─── Injection patterns ──────────────────────────────────────────────

/**
 * XSS and injection patterns that should never appear in user input.
 * These are checked against query params, header values, and body fields.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // XSS vectors
  /<script[\s>]/i,
  /<img[^>]*onerror/i,
  /<svg[^>]*onload/i,
  /<iframe[\s>]/i,
  /<object[\s>]/i,
  /<embed[\s>]/i,
  /on\w+\s*=\s*(?:'|")?javascript/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
  /expression\s*\(/i,
  /<[^>]*\s+on\w+\s*=/i,

  // Prototype pollution
  /__proto__/i,
  /constructor\s*\.\s*prototype/i,

  // SQL injection indicators (parameterized queries used, but defense-in-depth)
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i,
  /(\bUNION\b)\s+\bSELECT\b/i,
  /'\s*\bOR\b\s*'[^']*'\s*=\s*'/i,
  /;\s*\bDROP\b/i,
  /;\s*\bDELETE\b/i,
  /;\s*\bINSERT\b/i,
  /;\s*\bUPDATE\b/i,
  /'\s*--/,
  /\bEXEC\b.*\(/i,
  /\bXP_/i,

  // Path traversal
  /\.\.\//,
  /\.\.\\/,
  /~[^/]*\//,

  // Command injection
  /[`$]/,
  /(?:\||;)\s*(?:rm|wget|curl|bash|sh|powershell|cmd)\s/i,
  /\$\{/,
  /<%\s*=?/,
];

/**
 * Check a string value for injection patterns.
 * Returns true if the value is clean (no injection patterns found).
 */
export function isCleanInput(value: string): boolean {
  if (typeof value !== 'string') return false;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) return false;
  }
  return true;
}

/**
 * Recursively sanitize-check all string values in an object.
 * Returns the first field name that fails, or null if all clean.
 */
export function findInjectionInObject(obj: Record<string, unknown>, prefix = ''): string | null {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      if (!isCleanInput(value)) return path;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = findInjectionInObject(value as Record<string, unknown>, path);
      if (nested) return nested;
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === 'string') {
          if (!isCleanInput(item)) return `${path}[${i}]`;
        } else if (typeof item === 'object' && item !== null) {
          const nested = findInjectionInObject(item as Record<string, unknown>, `${path}[${i}]`);
          if (nested) return nested;
        }
      }
    }
  }
  return null;
}

// ─── Protocol identifier validation ──────────────────────────────────

/**
 * Nostr npub/nsec/note format validation.
 * Bech32-encoded with hrp: npub, nsec, note, nprofile, nevent.
 */
const NOSTR_BECH32_RE = /^(npub|nsec|note|nprofile|nevent)1[ac-hj-np-z02-9]{6,}$/;

export function isValidNostrId(value: string): boolean {
  return NOSTR_BECH32_RE.test(value);
}

/**
 * Farcaster FID validation.
 * FIDs are integers in range [1, 2^32-1].
 */
export function isValidFarcasterFid(value: string): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num >= 1 && num <= 4_294_967_295;
}

/**
 * Bluesky DID validation.
 * Format: did:plc:<base32> or did:web:<domain>
 */
const BSKY_DID_RE = /^did:(plc:[a-z2-7]{24}|web:[a-zA-Z0-9.-]+)$/;

export function isValidBlueskyDid(value: string): boolean {
  return BSKY_DID_RE.test(value);
}

/**
 * Bluesky handle validation.
 * Format: handle.bsky.social or custom domain
 */
const BSKY_HANDLE_RE = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidBlueskyHandle(value: string): boolean {
  if (value.length > 253) return false;
  return BSKY_HANDLE_RE.test(value);
}

/**
 * Validate any protocol-specific identifier.
 */
export function isValidProtocolId(protocol: string, value: string): boolean {
  switch (protocol.toLowerCase()) {
    case 'nostr':
      return isValidNostrId(value);
    case 'farcaster':
      return isValidFarcasterFid(value);
    case 'bluesky':
    case 'bsky':
      return isValidBlueskyDid(value) || isValidBlueskyHandle(value);
    default:
      // Unknown protocol — accept if no injection patterns
      return isCleanInput(value);
  }
}

// ─── Wallet address validation ───────────────────────────────────────

/**
 * Ethereum address: 0x + 40 hex chars (with or without checksum)
 */
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidEvmAddress(value: string): boolean {
  return EVM_ADDRESS_RE.test(value);
}

/**
 * Solana address: base58, 32-44 chars
 * Uses the same regex as the existing sanitize.ts implementation.
 */
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(value: string): boolean {
  return SOLANA_ADDRESS_RE.test(value);
}

/**
 * Validate a wallet address by chain type.
 */
export function isValidWalletAddress(chain: string, address: string): boolean {
  switch (chain.toLowerCase()) {
    case 'ethereum':
    case 'eth':
    case 'evm':
      return isValidEvmAddress(address);
    case 'solana':
    case 'sol':
      return isValidSolanaAddress(address);
    default:
      // Unknown chain — basic safety check
      return isCleanInput(address) && address.length >= 10 && address.length <= 100;
  }
}

// ─── URL validation ──────────────────────────────────────────────────

/**
 * Validates that a URL is safe to process.
 * Rejects javascript:, data:, vbscript:, and file: protocols.
 */
export function isValidSafeUrl(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (value.length > 2048) return false;

  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();

    // Only allow http and https
    if (protocol !== 'https:' && protocol !== 'http:') return false;

    // Reject empty hostnames
    if (!url.hostname || url.hostname.length === 0) return false;

    // Reject IP-literal localhost
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ─── Content-Type validation ─────────────────────────────────────────

const VALID_JSON_CONTENT_TYPES = [
  'application/json',
  'application/json; charset=utf-8',
  'application/json;charset=utf-8',
];

export function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase().trim();
  return (
    VALID_JSON_CONTENT_TYPES.some((valid) => lower === valid) ||
    lower.startsWith('application/json')
  );
}

// ─── Per-endpoint body size limits ───────────────────────────────────

/**
 * Maximum body sizes per endpoint group (in bytes).
 * These are checked BEFORE any parsing to prevent OOM attacks.
 */
export const ENDPOINT_BODY_LIMITS: Record<string, number> = {
  // Default limit
  default: 1_048_576, // 1 MB

  // Auth endpoints — small payloads
  '/api/auth/wallet/verify': 16_384, // 16 KB
  '/api/auth/wallet/nonce': 512, // 512 B (GET with query params)
  '/api/auth/email/register': 4_096, // 4 KB
  '/api/auth/email/signin': 4_096, // 4 KB
  '/api/auth/email/verify': 2_048, // 2 KB
  '/api/auth/email/password-reset': 2_048, // 2 KB
  '/api/auth/webauthn': 32_768, // 32 KB (large challenge objects)

  // API key management
  '/api/admin': 4_096, // 4 KB
  '/v1/api-keys': 4_096, // 4 KB

  // Feed endpoints — mostly GET, no body
  '/api/feed': 1_024, // 1 KB
  '/api/discover': 1_024, // 1 KB

  // Publish endpoints — can have larger content
  '/api/publish': 524_288, // 512 KB (posts with images as base64)
  '/api/shorts/create': 2_097_152, // 2 MB (video uploads)
  '/api/shorts/publish': 2_097_152, // 2 MB

  // Tip endpoints — small
  '/api/tip': 4_096, // 4 KB
  '/api/tip/unified': 4_096, // 4 KB

  // Embed resolve — URLs only
  '/api/embed/resolve': 512, // 512 B

  // Content permanence
  '/api/permanence': 65_536, // 64 KB

  // Webhook endpoints
  '/api/webhooks': 65_536, // 64 KB

  // Newsletter — can have large content
  '/api/newsletter/send': 524_288, // 512 KB
  '/api/newsletter/draft': 524_288, // 512 KB
};

/**
 * Get the body size limit for a given path.
 * Walks up the path to find the best match, then falls back to default.
 */
export function getBodySizeLimit(pathname: string): number {
  // Exact match first
  if (ENDPOINT_BODY_LIMITS[pathname] !== undefined) {
    return ENDPOINT_BODY_LIMITS[pathname];
  }

  // Prefix match (longest prefix wins)
  let best = ENDPOINT_BODY_LIMITS.default;
  let bestLen = 0;
  for (const [prefix, limit] of Object.entries(ENDPOINT_BODY_LIMITS)) {
    if (prefix !== 'default' && pathname.startsWith(prefix) && prefix.length > bestLen) {
      best = limit;
      bestLen = prefix.length;
    }
  }

  return best;
}

// ─── Request validation ──────────────────────────────────────────────

export interface RequestValidationOptions {
  /** Expected content type (null = skip content type check) */
  expectedContentType?: string | null;
  /** Max body size in bytes (null = use automatic detection) */
  maxBodyBytes?: number | null;
  /** Whether to validate all query params for injection */
  checkQueryParams?: boolean;
}

/**
 * Validate an incoming request before it reaches the route handler.
 * Checks content type, body size, query params, and header injection.
 */
export function validateRequest(
  request: Request,
  options: RequestValidationOptions = {},
): ValidationResult {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const contentType = request.headers.get('content-type');
  const method = request.method;

  // ── Content-Type validation for state-changing methods ──
  const expectedCt = options.expectedContentType;
  if (expectedCt !== null && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    if (!options.expectedContentType || options.expectedContentType === 'application/json') {
      // For JSON endpoints, validate content type
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        if (!isJsonContentType(contentType) && contentType !== null) {
          return {
            valid: false,
            error: 'Content-Type must be application/json',
            code: 'DF-415',
          };
        }
      }
    }
  }

  // ── Body size validation ──
  const maxBytes = options.maxBodyBytes ?? getBodySizeLimit(pathname);
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    const bytes = parseInt(contentLength, 10);
    if (!Number.isNaN(bytes) && bytes > maxBytes) {
      return {
        valid: false,
        error: `Request body too large (max ${maxBytes} bytes)`,
        code: 'DF-413',
      };
    }
  }

  // ── Query parameter injection check ──
  if (options.checkQueryParams !== false) {
    for (const [key, value] of url.searchParams.entries()) {
      if (!isCleanInput(value)) {
        return {
          valid: false,
          error: `Invalid characters in query parameter: ${key}`,
          code: 'DF-400',
        };
      }
      // Check key too
      if (!isCleanInput(key)) {
        return {
          valid: false,
          error: 'Invalid query parameter name',
          code: 'DF-400',
        };
      }
    }
  }

  // ── Header injection check ──
  // Check common user-supplied headers
  const headersToCheck = ['referer', 'origin', 'x-forwarded-for', 'user-agent', 'x-csrf-token'];
  for (const headerName of headersToCheck) {
    const headerValue = request.headers.get(headerName);
    if (headerValue && !isCleanInput(headerValue)) {
      return {
        valid: false,
        error: `Invalid characters in header: ${headerName}`,
        code: 'DF-400',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate parsed JSON body fields for injection patterns.
 * Call this AFTER request.json() has been called.
 */
export function validateJsonBody(body: Record<string, unknown>): ValidationResult {
  const infectedField = findInjectionInObject(body);
  if (infectedField) {
    return {
      valid: false,
      error: `Invalid characters in field: ${infectedField}`,
      code: 'DF-400',
    };
  }
  return { valid: true };
}

// ─── Specific field validators ───────────────────────────────────────

export interface ValidatedField<T> {
  valid: boolean;
  value?: T;
  error?: string;
}

/**
 * Validate and sanitize a string field.
 */
export function validateStringField(
  value: unknown,
  maxLength: number,
  required = true,
): ValidatedField<string> {
  if (value === undefined || value === null) {
    if (required) return { valid: false, error: 'Field is required' };
    return { valid: true, value: '' };
  }
  if (typeof value !== 'string') {
    return { valid: false, error: 'Field must be a string' };
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    return { valid: false, error: 'Field must not be empty' };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Field exceeds max length of ${maxLength}` };
  }
  if (!isCleanInput(trimmed)) {
    return { valid: false, error: 'Field contains invalid characters' };
  }
  return { valid: true, value: trimmed };
}

/**
 * Validate an enum field.
 */
export function validateEnumField<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
): ValidatedField<T> {
  if (typeof value !== 'string') {
    return { valid: false, error: 'Field must be a string' };
  }
  const matched = allowedValues.find((v) => v === value);
  if (!matched) {
    return {
      valid: false,
      error: `Field must be one of: ${allowedValues.join(', ')}`,
    };
  }
  return { valid: true, value: matched };
}

/**
 * Validate a numeric field (string or number input).
 */
export function validateNumericField(
  value: unknown,
  min?: number,
  max?: number,
): ValidatedField<number> {
  let num: number;
  if (typeof value === 'string') {
    num = Number(value);
    if (Number.isNaN(num)) {
      return { valid: false, error: 'Field must be a number' };
    }
  } else if (typeof value === 'number') {
    num = value;
  } else {
    return { valid: false, error: 'Field must be a number' };
  }

  if (min !== undefined && num < min) {
    return { valid: false, error: `Field must be >= ${min}` };
  }
  if (max !== undefined && num > max) {
    return { valid: false, error: `Field must be <= ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Validate an email field (basic format check).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailField(value: unknown): ValidatedField<string> {
  if (typeof value !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email too long' };
  }
  if (!EMAIL_RE.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true, value: trimmed };
}
