/**
 * @degenfeed/security — Security utilities for DegenFeed
 *
 * Provides input sanitization, webhook signature verification,
 * token bucket rate limiting, and CSRF token generation/validation.
 */

// == Input Sanitization ==================================================

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=\s*"[^"]*"/gi,
  /on\w+\s*=\s*'[^']*'/gi,
  /javascript\s*:/gi,
  /<iframe\b[^>]*>/gi,
  /<object\b[^>]*>/gi,
  /<embed\b[^>]*>/gi,
  /<svg\b[^>]*>/gi,
  /<math\b[^>]*>/gi,
  /<form\b[^>]*>/gi,
  /<input\b[^>]*>/gi,
  /<textarea\b[^>]*>/gi,
  /<select\b[^>]*>/gi,
  /<button\b[^>]*>/gi,
];

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  // Remove XSS patterns
  let cleaned = input;
  for (const pattern of XSS_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // HTML-encode special characters
  cleaned = cleaned.replace(/[&<>"'/]/g, (ch) => HTML_ENTITIES[ch] ?? ch);

  return cleaned.trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeInput(value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeInput(item)
          : item && typeof item === 'object'
            ? sanitizeObject(item as Record<string, unknown>)
            : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// == Webhook Signature Verification ======================================

export interface WebhookVerificationOptions {
  signatureHeader?: string;
  timestampHeader?: string;
  toleranceMs?: number;
  encoding?: 'hex' | 'base64';
}

const DEFAULT_WEBHOOK_OPTIONS: Required<WebhookVerificationOptions> = {
  signatureHeader: 'x-signature-256',
  timestampHeader: 'x-timestamp',
  toleranceMs: 300_000, // 5 minutes
  encoding: 'hex',
};

async function encodeHex(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyWebhookSignature(
  payload: string | BufferSource,
  signature: string,
  secret: string,
  options?: WebhookVerificationOptions,
): Promise<boolean> {
  const opts = { ...DEFAULT_WEBHOOK_OPTIONS, ...options };

  if (!payload || !signature || !secret) {
    return false;
  }

  try {
    const payloadStr = typeof payload === 'string' ? payload : new TextDecoder().decode(payload);
    const expectedSig = await encodeHex(payloadStr, secret);
    return expectedSig === signature;
  } catch {
    return false;
  }
}

// == Rate Limiter (Token Bucket, in-memory) ==============================

export interface TokenBucketConfig {
  capacity: number;
  refillRate: number; // tokens per second
  refillIntervalMs?: number;
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class TokenBucketRateLimiter {
  private buckets: Map<string, BucketState> = new Map();
  private capacity: number;
  private refillRate: number;
  private refillIntervalMs: number;

  constructor(config: TokenBucketConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRate;
    this.refillIntervalMs = config.refillIntervalMs ?? 1000;
  }

  private refill(key: string): void {
    const now = Date.now();
    const state = this.buckets.get(key);
    if (!state) return;

    const elapsed = now - state.lastRefill;
    if (elapsed < this.refillIntervalMs) return;

    const tokensToAdd = (elapsed / 1000) * this.refillRate;
    state.tokens = Math.min(this.capacity, state.tokens + tokensToAdd);
    state.lastRefill = now;
  }

  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    let state = this.buckets.get(key);
    if (!state) {
      state = { tokens: this.capacity, lastRefill: Date.now() };
      this.buckets.set(key, state);
    }

    this.refill(key);

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return {
        allowed: true,
        remaining: Math.floor(state.tokens),
        resetTime: state.lastRefill + this.refillIntervalMs,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetTime: state.lastRefill + this.refillIntervalMs,
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  clear(): void {
    this.buckets.clear();
  }

  get size(): number {
    return this.buckets.size;
  }
}

// == CSRF Token Generation/Validation ====================================

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface CsrfStore {
  get(key: string): string | undefined;
  set(key: string, token: string, ttlMs: number): void;
  delete(key: string): void;
}

export class MemoryCsrfStore implements CsrfStore {
  private store: Map<string, { token: string; expires: number }> = new Map();

  get(key: string): string | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.token;
  }

  set(key: string, token: string, ttlMs: number): void {
    this.store.set(key, { token, expires: Date.now() + ttlMs });
    // Auto-cleanup expired entries periodically
    if (this.store.size > 1000) {
      this.cleanup();
    }
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expires) {
        this.store.delete(key);
      }
    }
  }
}

export function validateCsrfToken(
  store: CsrfStore,
  key: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const stored = store.get(key);
  if (!stored) return false;
  if (stored !== token) return false;
  store.delete(key); // One-time use
  return true;
}
