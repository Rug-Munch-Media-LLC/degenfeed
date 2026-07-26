import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { rateLimit, recordBruteForceFailure } from '../index';
import { extractRequestMetadata, logSecurityEvent } from '../lib/security-log';
import { log } from '../logger';
import { jsonResponse, rateLimitResponse } from '../response-helpers';
import { createSession, generateCsrfToken, parseSessionCookie, storeCsrfToken } from '../session';
import type { Env } from '../types';
import { storeSessionMeta } from './sessions';

const GTS_SCOPES = 'read write follow push';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(input: string): Uint8Array {
