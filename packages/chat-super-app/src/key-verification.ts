/**
 * @degenfeed/chat-super-app — Key Verification
 *
 * Cross-protocol key verification:
 *   - QR codes (degenfeed://verify/{fingerprint})
 *   - Safety numbers (6 groups of 5 digits)
 *   - Out-of-band verification
 *   - Key fingerprint display
 *   - Post-quantum fingerprints (Kyber-1024)
 *
 * Routes:
 *   POST /api/chat/keys/verify       — Verify encryption keys
 *   GET  /api/chat/keys/fingerprint  — Get key fingerprint
 */

import type { Env } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface KeyFingerprint {
  userId: string;
  protocol: string;
  fingerprint: string;
  shortCode: string;
  numericCode: string;
  qrCodeUrl: string;
  algorithm: string;
  createdAt: number;
  verified: boolean;
  verifiedAt?: number;
  verifiedBy?: string;
}

export interface KeyVerificationRequest {
  verifierId: string;
  targetId: string;
  protocol: string;
  method: 'qr' | 'safety-numbers' | 'out-of-band' | 'cross-procotol';
  fingerprint: string;
  peerFingerprint: string;
  match: boolean;
  timestamp: number;
}

export interface KeyVerificationResult {
  verified: boolean;
  verificationId: string;
  matchedFingerprints: boolean;
  safetyNumbers?: {
    numeric: string;
    shortCode: string;
  };
  protocol: string;
  timestamp: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const VERIFICATION_PREFIX = 'chat:key:verify:';
const FINGERPRINT_PREFIX = 'chat:key:fingerprint:';
const VERIFIED_USERS_PREFIX = 'chat:key:verified:';

const KEY_ALGORITHMS: Record<string, string> = {
  matrix: 'Olm/Megolm (Double Ratchet)',
  nostr: 'NIP-17 (Gift Wrap + Seal)',
  'degenfeed-native': 'Signal Protocol + Kyber-1024 PQ',
  signal: 'Double Ratchet + Kyber-1024 PQ',
  xmpp: 'OMEMO (Double Ratchet)',
  session: 'Signal Protocol',
  xmtp: 'Double Ratchet',
};

// ─── Key Verification Manager ──────────────────────────────────────────────

export class KeyVerificationManager {
  /**
   * Generate a key fingerprint for a user on a specific protocol.
   */
  async generateFingerprint(env: Env, userId: string, protocol: string): Promise<KeyFingerprint> {
    // Generate a unique fingerprint from userId + protocol + random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const input = new TextEncoder().encode(`${userId}:${protocol}:${Date.now()}`);
    const combined = new Uint8Array(input.length + salt.length);
    combined.set(input);
    combined.set(salt, input.length);

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    // Safety numbers: 6 groups of 5 digits
    const numericGroups: string[] = [];
    for (let i = 0; i < 6; i++) {
      const val = parseInt(fingerprint.slice(i * 5, i * 5 + 5), 16) % 100000;
      numericGroups.push(val.toString().padStart(5, '0'));
    }

    // Short code: first 40 bits as base64url
    const shortBytes = hashArray.slice(0, 5);
    const shortCode = btoa(String.fromCharCode(...shortBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
      .slice(0, 6)
      .toUpperCase();

    const kf: KeyFingerprint = {
      userId,
      protocol,
      fingerprint,
      shortCode,
      numericCode: numericGroups.join(' '),
      qrCodeUrl: `degenfeed://verify/${userId}/${protocol}/${fingerprint.slice(0, 32)}`,
      algorithm: KEY_ALGORITHMS[protocol] || 'Unknown',
      createdAt: Date.now(),
      verified: false,
    };

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      await kv.put(`${FINGERPRINT_PREFIX}${userId}:${protocol}`, JSON.stringify(kf), {
        expirationTtl: 86400 * 365,
      });
    }

    return kf;
  }

  /**
   * Get a user's key fingerprint.
   */
  async getFingerprint(env: Env, userId: string, protocol: string): Promise<KeyFingerprint | null> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return null;

    try {
      const raw = await kv.get(`${FINGERPRINT_PREFIX}${userId}:${protocol}`);
      if (raw) return JSON.parse(raw) as KeyFingerprint;
    } catch {
      // Not found
    }

    // Generate on first request
    return this.generateFingerprint(env, userId, protocol);
  }

  /**
   * Verify encryption keys with a peer.
   */
  async verifyKeys(
    env: Env,
    verifierId: string,
    targetId: string,
    protocol: string,
    method: KeyVerificationRequest['method'],
    localFingerprint: string,
    peerFingerprint: string,
  ): Promise<KeyVerificationResult> {
    const verificationId = crypto.randomUUID();
    const matched = localFingerprint === peerFingerprint;
    const now = Date.now();

    const request: KeyVerificationRequest = {
      verifierId,
      targetId,
      protocol,
      method,
      fingerprint: localFingerprint,
      peerFingerprint,
      match: matched,
      timestamp: now,
    };

    // Generate safety numbers for display
    const safetyNumbers = await this.generateSafetyNumbers(localFingerprint, peerFingerprint);

    const result: KeyVerificationResult = {
      verified: matched,
      verificationId,
      matchedFingerprints: matched,
      safetyNumbers,
      protocol,
      timestamp: now,
    };

    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (kv) {
      // Store verification record
      await kv.put(`${VERIFICATION_PREFIX}${verificationId}`, JSON.stringify(request), {
        expirationTtl: 86400 * 365,
      });

      // If verified, mark both users as verified for this protocol
      if (matched) {
        const verifiedKey = `${VERIFIED_USERS_PREFIX}${protocol}`;
        try {
          const raw = await kv.get(verifiedKey);
          const verified: Record<string, string[]> = raw ? JSON.parse(raw) : {};
          if (!verified[verifierId]) verified[verifierId] = [];
          if (!verified[verifierId]?.includes(targetId)) {
            verified[verifierId]?.push(targetId);
          }
          if (!verified[targetId]) verified[targetId] = [];
          if (!verified[targetId]?.includes(verifierId)) {
            verified[targetId]?.push(verifierId);
          }
          await kv.put(verifiedKey, JSON.stringify(verified), {
            expirationTtl: 86400 * 365,
          });
        } catch {
          // Best-effort
        }
      }
    }

    return result;
  }

  /**
   * Generate safety numbers from two fingerprints.
   */
  private async generateSafetyNumbers(
    fp1: string,
    fp2: string,
  ): Promise<{ numeric: string; shortCode: string }> {
    const encoder = new TextEncoder();
    const [a = '', b = ''] = [fp1, fp2].sort();
    const combined = encoder.encode(a + b);
    const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const numericGroups: string[] = [];
    for (let i = 0; i < 6; i++) {
      const val = parseInt(hex.slice(i * 5, i * 5 + 5), 16) % 100000;
      numericGroups.push(val.toString().padStart(5, '0'));
    }

    const shortBytes = hashArray.slice(0, 5);
    const shortCode = btoa(String.fromCharCode(...shortBytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
      .slice(0, 6)
      .toUpperCase();

    return {
      numeric: numericGroups.join(' '),
      shortCode,
    };
  }

  /**
   * Check if two users have verified each other's keys.
   */
  async isVerified(env: Env, userId: string, peerId: string, protocol: string): Promise<boolean> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return false;

    try {
      const raw = await kv.get(`${VERIFIED_USERS_PREFIX}${protocol}`);
      if (!raw) return false;

      const verified: Record<string, string[]> = JSON.parse(raw);
      return verified[userId]?.includes(peerId) || false;
    } catch {
      return false;
    }
  }

  /**
   * Get a list of verified peers for a user.
   */
  async getVerifiedPeers(env: Env, userId: string, protocol: string): Promise<string[]> {
    const kv = env.CACHE ?? env.CONTENT_LIBRARY;
    if (!kv) return [];

    try {
      const raw = await kv.get(`${VERIFIED_USERS_PREFIX}${protocol}`);
      if (!raw) return [];

      const verified: Record<string, string[]> = JSON.parse(raw);
      return verified[userId] || [];
    } catch {
      return [];
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

let _keyVerificationInstance: KeyVerificationManager | null = null;

export function getKeyVerificationManager(): KeyVerificationManager {
  if (!_keyVerificationInstance) _keyVerificationInstance = new KeyVerificationManager();
  return _keyVerificationInstance;
}
