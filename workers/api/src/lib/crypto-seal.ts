/**
 * @degenfeed/api-worker — Crypto seal for KV credential storage
 *
 * AES-256-GCM encryption for PDS passwords, bot tokens, and other
 * sensitive values stored in Cloudflare KV.
 *
 * Key derivation: PBKDF2 (SHA-256, 100k iterations) from
 * AUTH_SECRET + purpose-specific salt.
 */

import type { Env } from '../types';

const ALGORITHM = { name: 'AES-GCM', length: 256 } as const;
const ITERATIONS = 100_000;
const _SALT_LENGTH = 16;
const IV_LENGTH = 12;

function encodeBase64Url(buffer: ArrayBuffer): string {
