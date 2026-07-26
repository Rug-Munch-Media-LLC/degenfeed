/**
 * @degenfeed/api-worker — Unified Room Encryption
 *
 * AES-256-GCM encryption helpers for room message content.
 */

import { fromBase64Url, toBase64Url } from './unified-room-constants';

export async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportRoomKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return toBase64Url(raw);
}

export async function importRoomKey(keyStr: string): Promise<CryptoKey> {
  const raw = fromBase64Url(keyStr);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptMessageContent(
  plaintext: string,
  key: CryptoKey,
): Promise<{ encryptedContent: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    encryptedContent: toBase64Url(encrypted),
    iv: toBase64Url(iv),
  };
}

export async function decryptMessageContent(
  encryptedContent: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  const ct = fromBase64Url(encryptedContent);
  const ivBytes = fromBase64Url(iv);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ct);
  return new TextDecoder().decode(decrypted);
}
