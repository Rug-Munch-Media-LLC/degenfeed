/**
 * @degenfeed/crypto — Crypto seal for KV credential storage
 *
 * AES-256-GCM encryption for PDS passwords, bot tokens, and other
 * sensitive values stored in Cloudflare KV.
 *
 * Key derivation: PBKDF2 (SHA-256, 100k iterations) from
 * AUTH_SECRET + purpose-specific salt.
 *
 * NOTE: This is a Cloudflare Workers-compatible implementation
 * that uses the Web Crypto API (SubtleCrypto). It will NOT
 * work in Node.js without a Web Crypto polyfill.
 */

import type { Env } from '@degenfeed/types';

const ALGORITHM = { name: 'AES-GCM', length: 256 } as const;
const ITERATIONS = 100_000;
const IV_LENGTH = 12;

function encodeBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const raw = atob(str + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(env: Env, purpose: string): Promise<CryptoKey> {
  const secret = env.AUTH_SECRET;
  if (!secret) {
    throw new Error('[crypto-seal] AUTH_SECRET is not configured — cannot derive encryption key');
  }
  const salt = new TextEncoder().encode(`degenfeed:${purpose}:v1`);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    ALGORITHM,
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a plaintext value with AES-256-GCM.
 * Returns base64url-encoded "iv:ciphertext" string for KV storage.
 */
export async function seal(env: Env, plaintext: string, purpose: string): Promise<string> {
  const key = await deriveKey(env, purpose);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return encodeBase64Url(combined.buffer);
}

/**
 * Decrypt a sealed value from KV.
 * Returns the original plaintext or null if decryption fails.
 */
export async function unseal(env: Env, sealed: string, purpose: string): Promise<string | null> {
  try {
    const key = await deriveKey(env, purpose);
    const data = decodeBase64Url(sealed);
    if (data.length < IV_LENGTH + 16) return null;
    const iv = data.slice(0, IV_LENGTH);
    const ciphertext = data.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('[crypto-seal] unseal failed:', err);
    return null;
  }
}
