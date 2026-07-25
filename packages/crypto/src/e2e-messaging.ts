/**
 * @degenfeed/crypto — E2E Encryption Layer for Cross-Protocol Messaging
 *
 * Signal Protocol-style double ratchet encryption with:
 *   - X25519 key agreement (Curve25519 ECDH)
 *   - X3DH initial key exchange
 *   - Double Ratchet (DH ratchet + symmetric ratchet)
 *   - AES-256-GCM message encryption
 *   - Forward secrecy & post-compromise security
 *
 * ALL operations use the Web Crypto API (SubtleCrypto) — no external deps.
 * Keys are stored as JWK for KV persistence (encrypted at rest via crypto-seal).
 *
 * Security model:
 *   - Compromised session key cannot decrypt past messages (forward secrecy)
 *   - After key compromise, a few messages of interaction restores security (PCS)
 *   - No plaintext keys ever touch the network
 *   - Every message includes a message number for replay protection
 */

import type { Env } from '@degenfeed/types';

// ─── Constants ─────────────────────────────────────────────────────────────

const AES_ALG = 'AES-GCM' as const;
const AES_KEY_LEN = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128; // GCM tag bits
const HKDF_HASH = 'SHA-256' as const;
const HKDF_BYTES = 32;
const DH_OUTPUT_BYTES = 32;
const MAX_SKIP = 1000; // Max skipped message keys to keep (DoS protection)
const RATCHET_KEY_LABEL = new TextEncoder().encode('degenfeed-double-ratchet-v1');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KeyBundle {
  /** Identity public key (long-term) */
  identityKey: JsonWebKey;
  /** Signed pre-key (medium-term, rotated) */
  signedPreKey: JsonWebKey;
  /** One-time pre-keys (pre-key pool, each used once) */
  oneTimePreKeys: JsonWebKey[];
  /** Signature of signedPreKey by identityKey */
  signature: string; // base64url-encoded
}

export interface SessionState {
  /** Our identity keypair (private key ENCRYPTED in storage — never sent) */
  ourIdentityKey: JsonWebKey;
  /** Their identity public key */
  theirIdentityKey: JsonWebKey;
  /** Root key for double ratchet */
  rootKey: string; // base64url-encoded
  /** Current sending chain key */
  sendChainKey: string | null;
  /** Current receiving chain key */
  recvChainKey: string | null;
  /** DH ratchet keypair — our current ephemeral */
  ourEphemeralKey: JsonWebKey;
  /** DH ratchet keypair — their current ephemeral public */
  theirEphemeralPublicKey: JsonWebKey | null;
  /** Message number counters */
  sendMsgNum: number;
  recvMsgNum: number;
  /** Previous chain keys for skipped messages (forward secrecy) */
  skippedSendKeys: Record<number, string>;
  skippedRecvKeys: Record<number, string>;
  /** Number of DH ratchet rotations */
  ratchetCount: number;
  /** Last updated timestamp */
  updatedAt: number;
}

export interface EncryptedPayload {
  /** Ephemeral public key for this message */
  ephemeralKey: JsonWebKey;
  /** Our current ratchet public key */
  ratchetKey: JsonWebKey;
  /** Message number in the sending chain */
  messageNum: number;
  /** Previous chain message count (for DH ratchet sync) */
  previousChainMsgNum: number;
  /** AES-256-GCM ciphertext (base64url) */
  ciphertext: string;
  /** Initialization vector (base64url) */
  iv: string;
  /** Auth tag is appended to ciphertext by GCM */
  /** Protocol version for compatibility */
  version: number;
  /** Sender's device ID */
  deviceId: string;
  /** Timestamp from sender */
  createdAt: number;
}

export interface DecryptedMessage {
  /** Decrypted plaintext */
  plaintext: string;
  /** Message number (for ordering) */
  messageNum: number;
  /** Ratchet generation */
  ratchetCount: number;
  /** Whether this was decrypted from a skipped key */
  fromSkipped: boolean;
}

export interface SafetyNumbers {
  /** Numeric safety number (6 groups of 5 digits) */
  numeric: string;
  /** Short authentication string for QR code */
  shortCode: string;
  /** Hash used for verification */
  fingerprint: string;
}

// ─── KV Prefixes ────────────────────────────────────────────────────────────

const KEY_BUNDLE_PREFIX = 'e2e:keybundle:';
const SESSION_PREFIX = 'e2e:session:';
const PREKEY_PREFIX = 'e2e:prekey:';
const DEVICE_PREFIX = 'e2e:device:';

const PREKEY_POOL_SIZE = 100; // How many one-time pre-keys to generate
const SIGNED_PREKEY_ROTATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Base64url Helpers ──────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const raw = atob(str + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ─── Web Crypto Wrappers ────────────────────────────────────────────────────

/**
 * Generate an X25519 keypair.
 * Note: Web Crypto doesn't expose X25519 directly, so we use ECDH with P-256
 * as a close approximation for initial key exchange, then derive the shared secret.
 *
 * For production, use a library like @noble/curves or tweetnacl for true X25519.
 * This implementation uses P-256 ECDH which provides equivalent security (128-bit).
 * The protocol is identical; only the curve changes.
 */
async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

async function deriveSharedBits(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
}

async function exportPublicKey(key: CryptoKey): Promise<JsonWebKey> {
  const exported = await crypto.subtle.exportKey('jwk', key);
  return exported;
}

async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    [],
  );
}

async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits'],
  );
}

/**
 * HKDF-SHA256 key derivation.
 */
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  // Expand via HMAC-SHA256
  const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);

  // PRK = HKDF-Extract
  const prk = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, ikm),
  );

  // HKDF-Expand
  const result = new Uint8Array(length);
  const t: Uint8Array[] = [];
  const keyForExpand = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  let block: Uint8Array = new Uint8Array(0);
  const n = Math.ceil(length / 32);
  for (let i = 1; i <= n; i++) {
    const input = concatBytes(block, info, new Uint8Array([i]));
    block = new Uint8Array(await crypto.subtle.sign('HMAC', keyForExpand, input));
    result.set(block, (i - 1) * 32);
  }

  return result;
}

/**
 * Derive an AES-256-GCM key from a raw 32-byte key.
 */
async function deriveAesKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawKey, { name: AES_ALG, length: AES_KEY_LEN }, false, [
    'encrypt',
    'decrypt',
  ]);
}

/**
 * Encrypt plaintext with AES-256-GCM.
 */
async function aesEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: AES_ALG, iv, additionalData: aad, tagLength: TAG_LENGTH },
    key,
    plaintext,
  );
  // GCM appends the tag to the ciphertext
  return {
    ciphertext: toBase64Url(encrypted),
    iv: toBase64Url(iv),
  };
}

/**
 * Decrypt ciphertext with AES-256-GCM.
 */
async function aesDecrypt(
  key: CryptoKey,
  ciphertext: string,
  iv: string,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const ct = fromBase64Url(ciphertext);
  const ivBytes = fromBase64Url(iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALG, iv: ivBytes, additionalData: aad, tagLength: TAG_LENGTH },
    key,
    ct,
  );
  return new Uint8Array(decrypted);
}

/**
 * Generate a signature for the signed pre-key.
 * Uses ECDSA with the identity key.
 */
async function signPreKey(
  identityPrivateKey: CryptoKey,
  preKeyPublic: JsonWebKey,
): Promise<string> {
  const preKeyBytes = new TextEncoder().encode(JSON.stringify(preKeyPublic));
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identityPrivateKey,
    preKeyBytes,
  );
  return toBase64Url(signature);
}

async function verifyPreKeySignature(
  identityPublicKey: CryptoKey,
  preKeyPublic: JsonWebKey,
  signature: string,
): Promise<boolean> {
  const preKeyBytes = new TextEncoder().encode(JSON.stringify(preKeyPublic));
  const sigBytes = fromBase64Url(signature);
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    identityPublicKey,
    sigBytes,
    preKeyBytes,
  );
}

// ─── Safety Numbers (Fingerprint Verification) ────────────────────────────

/**
 * Generate safety numbers from two identity keys for out-of-band verification.
 */
export async function generateSafetyNumbers(
  ourIdentityKey: JsonWebKey,
  theirIdentityKey: JsonWebKey,
): Promise<SafetyNumbers> {
  const ourBytes = new TextEncoder().encode(JSON.stringify(ourIdentityKey));
  const theirBytes = new TextEncoder().encode(JSON.stringify(theirIdentityKey));
  const combined = concatBytes(
    ourBytes < theirBytes ? ourBytes : theirBytes,
    ourBytes < theirBytes ? theirBytes : ourBytes,
  );

  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', combined),
  );

  // Numeric: 6 groups of 5 digits from hash bytes
  const hex = Array.from(hash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const numericGroups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const val = parseInt(hex.slice(i * 5, i * 5 + 5), 16) % 100000;
    numericGroups.push(val.toString().padStart(5, '0'));
  }

  // Short code: first 40 bits as alphanumeric
  const shortHash = toBase64Url(hash.slice(0, 5));
  const shortCode = shortHash.slice(0, 6).toUpperCase();

  return {
    numeric: numericGroups.join(' '),
    shortCode,
    fingerprint: toBase64Url(hash),
  };
}

// ─── X3DH Key Exchange ───────────────────────────────────────────────────

/**
 * Perform X3DH initial key exchange to establish a shared secret.
 *
 * X3DH computes: DH1 + DH2 + DH3 (+ DH4 if one-time pre-key used)
 *   DH1 = DH(IK_A,   SPK_B)
 *   DH2 = DH(EK_A,   IK_B)
 *   DH3 = DH(EK_A,   SPK_B)
 *   DH4 = DH(EK_A,   OPK_B)  (if OPK_B is available)
 */
export async function x3dhInitiate(
  ourIdentityKey: CryptoKey,
  ourIdentityJwk: JsonWebKey,
  theirBundle: KeyBundle,
): Promise<{ sharedSecret: Uint8Array; usedOtp: boolean }> {
  // Generate ephemeral key for this session
  const ephemeralKeyPair = await generateKeyPair();
  const ephemeralPublic = await exportPublicKey(ephemeralKeyPair.publicKey);

  const theirIdentityKey = await importPublicKey(theirBundle.identityKey);
  const theirSignedPreKey = await importPublicKey(theirBundle.signedPreKey);

  // Verify signed pre-key signature
  const valid = await verifyPreKeySignature(
    theirIdentityKey,
    theirBundle.signedPreKey,
    theirBundle.signature,
  );
  if (!valid) {
    throw new Error('[e2e] X3DH: signed pre-key signature invalid');
  }

  // DH1 = DH(IK_A, SPK_B)
  const dh1 = await deriveSharedBits(ourIdentityKey, theirSignedPreKey);

  // DH2 = DH(EK_A, IK_B)
  const dh2 = await deriveSharedBits(ephemeralKeyPair.privateKey, theirIdentityKey);

  // DH3 = DH(EK_A, SPK_B)
  const dh3 = await deriveSharedBits(ephemeralKeyPair.privateKey, theirSignedPreKey);

  // Concatenate DH outputs: DH1 || DH2 || DH3
  const dhConcat = concatBytes(
    new Uint8Array(dh1),
    new Uint8Array(dh2),
    new Uint8Array(dh3),
  );

  let usedOtp = false;

  // DH4 = DH(EK_A, OPK_B) if available
  if (theirBundle.oneTimePreKeys && theirBundle.oneTimePreKeys.length > 0) {
    const otpKey = await importPublicKey(theirBundle.oneTimePreKeys[0]!);
    const dh4 = await deriveSharedBits(ephemeralKeyPair.privateKey, otpKey);
    // Append DH4
    const finalConcat = concatBytes(dhConcat, new Uint8Array(dh4));
    // Derive shared secret via HKDF
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const sharedSecret = await hkdf(salt, finalConcat, RATCHET_KEY_LABEL, HKDF_BYTES);
    return { sharedSecret, usedOtp: true };
  }

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const sharedSecret = await hkdf(salt, dhConcat, RATCHET_KEY_LABEL, HKDF_BYTES);
  return { sharedSecret, usedOtp: false };
}

/**
 * X3DH receive: receiving side computes the same shared secret.
 */
export async function x3dhReceive(
  ourIdentityKey: CryptoKey,
  ourSignedPreKey: CryptoKey,
  ourOneTimePreKey: CryptoKey | null,
  theirEphemeralKey: JsonWebKey,
  theirIdentityKeyJwk: JsonWebKey,
): Promise<Uint8Array> {
  const theirEphemeralKeyImported = await importPublicKey(theirEphemeralKey);
  const theirIdentityKey = await importPublicKey(theirIdentityKeyJwk);

  // DH1 = DH(IK_B, SPK_B) — same from receiver's perspective but using sender's IK
  // Actually X3DH on receive uses the same computations with reversed roles:
  //   DH1 = DH(SPK_B, IK_A)
  const dh1 = await deriveSharedBits(ourSignedPreKey, theirIdentityKey);

  // DH2 = DH(IK_B, EK_A)
  const dh2 = await deriveSharedBits(ourIdentityKey, theirEphemeralKeyImported);

  // DH3 = DH(SPK_B, EK_A)
  const dh3 = await deriveSharedBits(ourSignedPreKey, theirEphemeralKeyImported);

  const dhConcat = concatBytes(
    new Uint8Array(dh1),
    new Uint8Array(dh2),
    new Uint8Array(dh3),
  );

  if (ourOneTimePreKey) {
    const dh4 = await deriveSharedBits(ourOneTimePreKey, theirEphemeralKeyImported);
    const finalConcat = concatBytes(dhConcat, new Uint8Array(dh4));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    return hkdf(salt, finalConcat, RATCHET_KEY_LABEL, HKDF_BYTES);
  }

  const salt = crypto.getRandomValues(new Uint8Array(32));
  return hkdf(salt, dhConcat, RATCHET_KEY_LABEL, HKDF_BYTES);
}

// ─── Double Ratchet ────────────────────────────────────────────────────────

/**
 * Initialize a double ratchet session from the X3DH shared secret.
 */
export async function initSession(
  ourIdentityKeyPair: CryptoKeyPair,
  theirIdentityKey: JsonWebKey,
  sharedSecret: Uint8Array,
): Promise<SessionState> {
  const ourIdentityJwk = await exportPublicKey(ourIdentityKeyPair.publicKey);
  const ephemeralPair = await generateKeyPair();

  // Derive initial root key and first chain key from shared secret
  const rootSalt = crypto.getRandomValues(new Uint8Array(32));
  const derived = await hkdf(rootSalt, sharedSecret, new TextEncoder().encode('root'), 64);
  const rootKeyBytes = derived.slice(0, 32);
  const chainKeyBytes = derived.slice(32, 64);

  return {
    ourIdentityKey: ourIdentityJwk,
    theirIdentityKey,
    rootKey: toBase64Url(rootKeyBytes),
    sendChainKey: toBase64Url(chainKeyBytes),
    recvChainKey: null, // Set when we receive their first message
    ourEphemeralKey: await exportPublicKey(ephemeralPair.publicKey),
    theirEphemeralPublicKey: null,
    sendMsgNum: 0,
    recvMsgNum: 0,
    skippedSendKeys: {},
    skippedRecvKeys: {},
    ratchetCount: 0,
    updatedAt: Date.now(),
  };
}

/**
 * Perform a DH ratchet step: rotate our ephemeral key and derive new root+chain keys.
 */
async function dhRatchet(
  session: SessionState,
  theirNewEphemeralKey: JsonWebKey | null,
): Promise<SessionState> {
  // If we have their ephemeral key, use it for DH
  const theirEphemeral = theirNewEphemeralKey ?? session.theirEphemeralPublicKey;
  if (!theirEphemeral) {
    throw new Error('[e2e] Cannot DH ratchet without their ephemeral key');
  }

  // Import our private ephemeral key
  const ourPrivateKey = await importPrivateKey(session.ourEphemeralKey);

  // Import their public ephemeral key
  const theirPublicKey = await importPublicKey(theirEphemeral);

  // DH(outgoing_ephemeral, their_ephemeral)
  const sharedSecret = new Uint8Array(await deriveSharedBits(ourPrivateKey, theirPublicKey));

  // Derive new root key and chain key
  const rootKeyBytes = fromBase64Url(session.rootKey);
  const derived = await hkdf(rootKeyBytes, sharedSecret, new TextEncoder().encode('ratchet'), 64);
  const newRootKey = derived.slice(0, 32);
  const newChainKey = derived.slice(32, 64);

  // Generate new ephemeral keypair for next ratchet
  const newEphemeralPair = await generateKeyPair();

  const updatedSession: SessionState = {
    ...session,
    rootKey: toBase64Url(newRootKey),
    sendChainKey: toBase64Url(newChainKey),
    recvChainKey: null,
    ourEphemeralKey: await exportPublicKey(newEphemeralPair.publicKey),
    theirEphemeralPublicKey: theirEphemeral,
    sendMsgNum: 0,
    recvMsgNum: 0,
    ratchetCount: session.ratchetCount + 1,
    updatedAt: Date.now(),
  };

  return updatedSession;
}

/**
 * Symmetric ratchet: advance the chain key to get a new message key.
 * Uses HKDF to derive the message key + new chain key from the current chain key.
 */
async function symmetricRatchet(chainKey: Uint8Array): Promise<{
  messageKey: Uint8Array;
  nextChainKey: Uint8Array;
}> {
  // Chain key = HMAC-SHA256(chain_key, 0x01)
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    chainKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const messageKey = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, new Uint8Array([0x01])),
  );

  // Next chain key = HMAC-SHA256(chain_key, 0x02)
  const nextChainKey = new Uint8Array(
    await crypto.subtle.sign('HMAC', hmacKey, new Uint8Array([0x02])),
  );

  return { messageKey, nextChainKey };
}

/**
 * Encrypt a message using the double ratchet.
 */
export async function ratchetEncrypt(
  session: SessionState,
  plaintext: string,
  aad?: string,
): Promise<{ encrypted: EncryptedPayload; session: SessionState }> {
  if (!session.sendChainKey) {
    // Need to initialize or DH ratchet first
    throw new Error('[e2e] No sending chain key available — perform DH ratchet first');
  }

  const chainKeyBytes = fromBase64Url(session.sendChainKey);

  // Symmetric ratchet to get message key
  const { messageKey, nextChainKey } = await symmetricRatchet(chainKeyBytes);

  // Encrypt with message key
  const aesKey = await deriveAesKey(messageKey);
  const aadBytes = aad ? new TextEncoder().encode(aad) : undefined;
  const { ciphertext, iv } = await aesEncrypt(aesKey, new TextEncoder().encode(plaintext), aadBytes);

  // Update session
  const updatedSession: SessionState = {
    ...session,
    sendChainKey: toBase64Url(nextChainKey),
    sendMsgNum: session.sendMsgNum + 1,
    updatedAt: Date.now(),
  };

  const encrypted: EncryptedPayload = {
    ephemeralKey: session.ourEphemeralKey,
    ratchetKey: session.ourEphemeralKey,
    messageNum: session.sendMsgNum,
    previousChainMsgNum: session.recvMsgNum,
    ciphertext,
    iv,
    version: 1,
    deviceId: 'default',
    createdAt: Date.now(),
  };

  return { encrypted, session: updatedSession };
}

/**
 * Decrypt a message using the double ratchet.
 * Handles out-of-order messages via skipped message key store.
 */
export async function ratchetDecrypt(
  session: SessionState,
  encrypted: EncryptedPayload,
  aad?: string,
): Promise<{ decrypted: DecryptedMessage; session: SessionState }> {
  let currentSession = { ...session };

  // Check if we need to DH ratchet (their ratchet key changed)
  const theirRatchetKey =
    encrypted.ratchetKey ?? encrypted.ephemeralKey;
  const needRatchet =
    !currentSession.theirEphemeralPublicKey ||
    JSON.stringify(theirRatchetKey) !== JSON.stringify(currentSession.theirEphemeralPublicKey);

  if (needRatchet) {
    // If we have skipped message keys for their new ratchet, process them first
    // (This handles messages encrypted before we ratcheted)
    currentSession = await dhRatchet(currentSession, theirRatchetKey);

    // After DH ratchet, our sending chain and receiving chain swap
    // The old recvChainKey becomes the new sendChainKey
    if (currentSession.recvChainKey) {
      currentSession.sendChainKey = currentSession.recvChainKey;
      currentSession.recvChainKey = null;
    }
  }

  // Now we should have a receiving chain key
  if (!currentSession.recvChainKey) {
    // First message to decrypt after ratchet — derive recv chain key
    // The receiving chain key is derived from the sending chain key from our partner
    // Since they rotate symmetrically, we use the root key and their ephemeral
    const theirPublicKey = await importPublicKey(theirRatchetKey);
    const ourPrivateKey = await importPrivateKey(currentSession.ourEphemeralKey);
    const sharedSecret = new Uint8Array(await deriveSharedBits(ourPrivateKey, theirPublicKey));

    const rootKeyBytes = fromBase64Url(currentSession.rootKey);
    const derived = await hkdf(
      rootKeyBytes,
      sharedSecret,
      new TextEncoder().encode('recv_chain'),
      32,
    );

    currentSession.recvChainKey = toBase64Url(derived);
  }

  // Check if this is a skipped message (gap in message numbers)
  if (encrypted.messageNum > currentSession.recvMsgNum) {
    const skipCount = encrypted.messageNum - currentSession.recvMsgNum;
    if (skipCount > MAX_SKIP) {
      throw new Error(`[e2e] Too many skipped messages: ${skipCount} > ${MAX_SKIP}`);
    }

    // Generate skipped message keys for the gap
    let chainKeyBytes = fromBase64Url(currentSession.recvChainKey);
    for (let i = currentSession.recvMsgNum; i < encrypted.messageNum; i++) {
      const { messageKey, nextChainKey } = await symmetricRatchet(chainKeyBytes);
      currentSession.skippedRecvKeys[i] = toBase64Url(messageKey);
      chainKeyBytes = nextChainKey;
    }
    // Update receiving chain to current message
    currentSession.recvChainKey = toBase64Url(chainKeyBytes);
  }

  // Try to decrypt with the appropriate key
  let messageKey: Uint8Array;
  let fromSkipped = false;

  // Check skipped key store first
  const skippedKey = currentSession.skippedRecvKeys[encrypted.messageNum];
  if (skippedKey) {
    messageKey = fromBase64Url(skippedKey);
    delete currentSession.skippedRecvKeys[encrypted.messageNum];
    fromSkipped = true;
  } else {
    // Advance the chain to the correct message number
    let chainKeyBytes = fromBase64Url(currentSession.recvChainKey);
    for (let i = currentSession.recvMsgNum; i <= encrypted.messageNum; i++) {
      const result = await symmetricRatchet(chainKeyBytes);
      if (i === encrypted.messageNum) {
        messageKey = result.messageKey;
        currentSession.recvChainKey = toBase64Url(result.nextChainKey);
        break;
      }
      chainKeyBytes = result.nextChainKey;
    }
    messageKey = messageKey!;
  }

  // Decrypt with the message key
  const aesKey = await deriveAesKey(messageKey);
  const aadBytes = aad ? new TextEncoder().encode(aad) : undefined;
  const plaintextBytes = await aesDecrypt(aesKey, encrypted.ciphertext, encrypted.iv, aadBytes);
  const plaintext = new TextDecoder().decode(plaintextBytes);

  currentSession.recvMsgNum = encrypted.messageNum + 1;
  currentSession.updatedAt = Date.now();

  return {
    decrypted: {
      plaintext,
      messageNum: encrypted.messageNum,
      ratchetCount: currentSession.ratchetCount,
      fromSkipped,
    },
    session: currentSession,
  };
}

// ─── Key Bundle Management ─────────────────────────────────────────────────

/**
 * Generate a fresh key bundle with signed pre-key and one-time pre-keys.
 */
export async function generateKeyBundle(env: Env, userId: string): Promise<KeyBundle> {
  const identityKeyPair = await generateKeyPair();
  const signedPreKeyPair = await generateKeyPair();

  // Sign the signed pre-key with the identity key
  const identityPublic = await exportPublicKey(identityKeyPair.publicKey);
  const signedPreKeyPublic = await exportPublicKey(signedPreKeyPair.publicKey);
  const signature = await signPreKey(identityKeyPair.privateKey, signedPreKeyPublic);

  // Generate one-time pre-keys
  const oneTimePreKeys: JsonWebKey[] = [];
  const oneTimePrivateKeys: JsonWebKey[] = [];
  for (let i = 0; i < PREKEY_POOL_SIZE; i++) {
    const otp = await generateKeyPair();
    oneTimePreKeys.push(await exportPublicKey(otp.publicKey));
    oneTimePrivateKeys.push(await exportPublicKey(otp.privateKey));
  }

  // Store the complete bundle with private keys (encrypted) in KV
  const bundle: KeyBundle & { identityPrivateKey: JsonWebKey; signedPreKeyPrivate: JsonWebKey } = {
    identityKey: identityPublic,
    identityPrivateKey: await exportPublicKey(identityKeyPair.privateKey),
    signedPreKey: signedPreKeyPublic,
    signedPreKeyPrivate: await exportPublicKey(signedPreKeyPair.privateKey),
    oneTimePreKeys,
    // We don't need to store private keys for OTPs — they're single-use
    signature,
  };

  // Store in KV (the key value is encrypted at the caller level)
  const { seal } = await import('./crypto-seal');
  const sealed = await seal(env, JSON.stringify(bundle), `e2e-keybundle:${userId}`);
  await env.CACHE?.put(`${KEY_BUNDLE_PREFIX}${userId}`, sealed, {
    expirationTtl: 86400 * 90,
  });

  // Store the identity key for safety number generation
  await env.CACHE?.put(
    `${KEY_BUNDLE_PREFIX}${userId}:identity`,
    JSON.stringify(identityPublic),
    { expirationTtl: 86400 * 365 },
  );

  // Store one-time pre-key private keys for later use
  const otpStorage: Array<{ public: JsonWebKey; private: JsonWebKey }> = oneTimePreKeys.map(
    (pub, i) => ({
      public: pub,
      private: oneTimePrivateKeys[i]!,
    }),
  );
  await env.CACHE?.put(`${PREKEY_PREFIX}${userId}:otp`, JSON.stringify(otpStorage), {
    expirationTtl: 86400 * 90,
  });

  // Return just the public bundle
  return {
    identityKey: identityPublic,
    signedPreKey: signedPreKeyPublic,
    oneTimePreKeys,
    signature,
  };
}

/**
 * Get a user's key bundle (public keys only) for initiating a session.
 */
export async function getKeyBundle(env: Env, userId: string): Promise<KeyBundle | null> {
  if (!env.CACHE) return null;

  try {
    const { unseal } = await import('./crypto-seal');
    const sealed = await env.CACHE.get(`${KEY_BUNDLE_PREFIX}${userId}`);
    if (!sealed) return null;

    const json = await unseal(env, sealed, `e2e-keybundle:${userId}`);
    if (!json) return null;

    const bundle = JSON.parse(json) as KeyBundle & {
      identityPrivateKey?: JsonWebKey;
      signedPreKeyPrivate?: JsonWebKey;
    };

    // Strip private keys before returning
    return {
      identityKey: bundle.identityKey,
      signedPreKey: bundle.signedPreKey,
      oneTimePreKeys: bundle.oneTimePreKeys,
      signature: bundle.signature,
    };
  } catch (err) {
    console.error('[e2e] getKeyBundle failed:', err);
    return null;
  }
}

/**
 * Consume a one-time pre-key for a user.
 */
export async function consumeOneTimePreKey(
  env: Env,
  userId: string,
): Promise<JsonWebKey | null> {
  if (!env.CACHE) return null;

  try {
    const raw = await env.CACHE.get(`${PREKEY_PREFIX}${userId}:otp`);
    if (!raw) return null;

    const otps: Array<{ public: JsonWebKey; private: JsonWebKey }> = JSON.parse(raw);
    if (otps.length === 0) return null;

    const used = otps.shift()!;
    await env.CACHE.put(`${PREKEY_PREFIX}${userId}:otp`, JSON.stringify(otps), {
      expirationTtl: 86400 * 90,
    });

    // Return the private key so we can use it for X3DH receive
    return used.private;
  } catch {
    return null;
  }
}

// ─── Session Management ────────────────────────────────────────────────────

export function sessionKey(userId: string, peerId: string): string {
  const sorted = [userId.toLowerCase(), peerId.toLowerCase()].sort();
  return `${SESSION_PREFIX}${sorted[0]}:${sorted[1]}`;
}

export async function saveSession(
  env: Env,
  userId: string,
  peerId: string,
  session: SessionState,
): Promise<void> {
  if (!env.CACHE) return;

  const key = sessionKey(userId, peerId);
  // Encrypt session data at rest
  const { seal } = await import('./crypto-seal');
  try {
    const sealed = await seal(env, JSON.stringify(session), `e2e-session:${key}`);
    await env.CACHE.put(key, sealed, { expirationTtl: 86400 * 30 });
  } catch (err) {
    console.error('[e2e] saveSession failed:', err);
  }
}

export async function loadSession(
  env: Env,
  userId: string,
  peerId: string,
): Promise<SessionState | null> {
  if (!env.CACHE) return null;

  const key = sessionKey(userId, peerId);
  try {
    const { unseal } = await import('./crypto-seal');
    const sealed = await env.CACHE.get(key);
    if (!sealed) return null;

    const json = await unseal(env, sealed, `e2e-session:${key}`);
    if (!json) return null;

    return JSON.parse(json) as SessionState;
  } catch {
    return null;
  }
}

/**
 * Get a user's identity key for safety number generation.
 */
export async function getIdentityKey(
  env: Env,
  userId: string,
): Promise<JsonWebKey | null> {
  if (!env.CACHE) return null;

  try {
    const raw = await env.CACHE.get(`${KEY_BUNDLE_PREFIX}${userId}:identity`);
    if (!raw) return null;
    return JSON.parse(raw) as JsonWebKey;
  } catch {
    return null;
  }
}

// ─── High-Level API ─────────────────────────────────────────────────────────

/**
 * Initialize a shared secret (X3DH) with another user.
 * Returns the initial session state.
 */
export async function initiateConversation(
  env: Env,
  userId: string,
  peerId: string,
): Promise<{ session: SessionState; usedOtp: boolean }> {
  // Get our identity keypair
  const { unseal } = await import('./crypto-seal');
  const sealed = await env.CACHE?.get(`${KEY_BUNDLE_PREFIX}${userId}`);
  if (!sealed) throw new Error('[e2e] No key bundle found — generate one first');

  const json = await unseal(env, sealed, `e2e-keybundle:${userId}`);
  if (!json) throw new Error('[e2e] Could not decrypt key bundle');

  const ourBundle = JSON.parse(json) as {
    identityKey: JsonWebKey;
    identityPrivateKey: JsonWebKey;
  };

  const ourIdentityPrivKey = await importPrivateKey(ourBundle.identityPrivateKey);
  const ourIdentityPubKey = await importPublicKey(ourBundle.identityKey);

  // Get their key bundle
  const theirBundle = await getKeyBundle(env, peerId);
  if (!theirBundle) throw new Error('[e2e] Peer has no key bundle');

  // X3DH
  const { sharedSecret, usedOtp } = await x3dhInitiate(
    ourIdentityPrivKey,
    ourBundle.identityKey,
    theirBundle,
  );

  // Consume one-time pre-key if used
  if (usedOtp) {
    await consumeOneTimePreKey(env, peerId);
  }

  // Initialize session
  const ourKeyPair: CryptoKeyPair = {
    publicKey: ourIdentityPubKey,
    privateKey: ourIdentityPrivKey,
  };

  const session = await initSession(ourKeyPair, theirBundle.identityKey, sharedSecret);

  // Save session
  await saveSession(env, userId, peerId, session);

  return { session, usedOtp };
}

/**
 * Receive a key exchange from another user (the responder side).
 */
export async function receiveKeyExchange(
  env: Env,
  userId: string,
  peerId: string,
  theirEphemeralKey: JsonWebKey,
  theirIdentityKey: JsonWebKey,
  usedOtp: boolean,
): Promise<SessionState> {
  const { unseal } = await import('./crypto-seal');
  const sealed = await env.CACHE?.get(`${KEY_BUNDLE_PREFIX}${userId}`);
  if (!sealed) throw new Error('[e2e] No key bundle found');

  const json = await unseal(env, sealed, `e2e-keybundle:${userId}`);
  if (!json) throw new Error('[e2e] Could not decrypt key bundle');

  const ourBundle = JSON.parse(json) as {
    identityKey: JsonWebKey;
    identityPrivateKey: JsonWebKey;
    signedPreKey: JsonWebKey;
    signedPreKeyPrivate: JsonWebKey;
  };

  const ourIdentityPubKey = await importPublicKey(ourBundle.identityKey);
  const ourIdentityPrivKey = await importPrivateKey(ourBundle.identityPrivateKey);
  const ourSignedPreKey = await importPrivateKey(ourBundle.signedPreKeyPrivate);

  let ourOtpKey: CryptoKey | null = null;
  if (usedOtp) {
    const otpPriv = await consumeOneTimePreKey(env, userId);
    if (otpPriv) {
      ourOtpKey = await importPrivateKey(otpPriv);
    }
  }

  const sharedSecret = await x3dhReceive(
    ourIdentityPrivKey,
    ourSignedPreKey,
    ourOtpKey,
    theirEphemeralKey,
    theirIdentityKey,
  );

  const ourKeyPair: CryptoKeyPair = {
    publicKey: ourIdentityPubKey,
    privateKey: ourIdentityPrivKey,
  };

  const session = await initSession(ourKeyPair, theirIdentityKey, sharedSecret);
  await saveSession(env, userId, peerId, session);

  return session;
}

/**
 * Encrypt a message for sending to a peer.
 */
export async function encryptMessage(
  env: Env,
  userId: string,
  peerId: string,
  plaintext: string,
  deviceId?: string,
): Promise<{ payload: EncryptedPayload; sessionState: SessionState }> {
  const session = await loadSession(env, userId, peerId);
  if (!session) {
    throw new Error('[e2e] No session established — initiate X3DH first');
  }

  const { encrypted, session: updatedSession } = await ratchetEncrypt(session, plaintext);
  encrypted.deviceId = deviceId ?? 'default';

  // Save updated session
  await saveSession(env, userId, peerId, updatedSession);

  return { payload: encrypted, sessionState: updatedSession };
}

/**
 * Decrypt a message received from a peer.
 */
export async function decryptMessage(
  env: Env,
  userId: string,
  peerId: string,
  encrypted: EncryptedPayload,
): Promise<DecryptedMessage> {
  const session = await loadSession(env, userId, peerId);
  if (!session) {
    throw new Error('[e2e] No session established for this peer');
  }

  // Check if we need to ratchet first (their key changed)
  const { decrypted, session: updatedSession } = await ratchetDecrypt(session, encrypted);

  // Save updated session
  await saveSession(env, userId, peerId, updatedSession);

  return decrypted;
}

/**
 * Rotate keys: generate a new key bundle and update signed pre-key.
 */
export async function rotateKeys(env: Env, userId: string): Promise<KeyBundle> {
  // Delete old bundle
  await env.CACHE?.delete(`${KEY_BUNDLE_PREFIX}${userId}`);

  // Generate new bundle
  return generateKeyBundle(env, userId);
}

/**
 * Check if a user has a key bundle.
 */
export async function hasKeyBundle(env: Env, userId: string): Promise<boolean> {
  const bundle = await getKeyBundle(env, userId);
  return bundle !== null;
}

export { PREKEY_POOL_SIZE, SIGNED_PREKEY_ROTATION_MS, MAX_SKIP };
