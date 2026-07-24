/**
 * @degenfeed/cross-protocol-bridge — Identity Linking
 *
 * Links user identities across protocols so the bridge knows which
 * accounts belong to the same user. When identities are linked,
 * cross-posting and cross-protocol notifications work automatically.
 */

import type { Protocol } from '@degenfeed/types';
import type { LinkedIdentity, LinkedProtocolIdentity } from './types';
import { extractMentions } from './normalization';

// ─── In-memory store (replaced by KV in production) ──────────────────────

const identityStore = new Map<string, LinkedIdentity>();

// ─── Identity Linking ────────────────────────────────────────────────────

/**
 * Link a protocol identity to a DegenFeed user.
 */
export function linkIdentity(
  dfId: string,
  walletAddress: string,
  protocol: Protocol,
  id: string,
  handle: string,
  options?: {
    displayName?: string;
    avatarUrl?: string;
    verificationMethod?: 'signature' | 'biography' | 'nip05' | 'manual' | 'oauth';
  },
): LinkedIdentity {
  const now = Date.now();
  const existing = identityStore.get(dfId);

  const protocolIdentity: LinkedProtocolIdentity = {
    protocol,
    id,
    handle,
    displayName: options?.displayName,
    avatarUrl: options?.avatarUrl,
    verified: options?.verificationMethod !== undefined,
    verificationMethod: options?.verificationMethod ?? 'manual',
    linkedAt: now,
  };

  if (existing) {
    // Add or update protocol identity
    const existingIdx = existing.protocols.findIndex(
      (p) => p.protocol === protocol,
    );
    if (existingIdx >= 0) {
      existing.protocols[existingIdx] = protocolIdentity;
    } else {
      existing.protocols.push(protocolIdentity);
    }
    existing.lastVerified = now;
    identityStore.set(dfId, existing);
    return existing;
  }

  const linked: LinkedIdentity = {
    dfId,
    walletAddress,
    displayName: options?.displayName ?? handle,
    protocols: [protocolIdentity],
    linkedAt: now,
    lastVerified: now,
  };

  identityStore.set(dfId, linked);
  return linked;
}

/**
 * Unlink a protocol identity from a DegenFeed user.
 */
export function unlinkIdentity(dfId: string, protocol: Protocol): boolean {
  const existing = identityStore.get(dfId);
  if (!existing) return false;

  const initialLength = existing.protocols.length;
  existing.protocols = existing.protocols.filter((p) => p.protocol !== protocol);
  existing.lastVerified = Date.now();

  if (existing.protocols.length === 0) {
    identityStore.delete(dfId);
  }

  return existing.protocols.length < initialLength;
}

// ─── Identity Resolution ─────────────────────────────────────────────────

/**
 * Resolve a DegenFeed user by their linked protocol identity.
 */
export function resolveByIdentity(
  protocol: Protocol,
  id: string,
): LinkedIdentity | undefined {
  for (const identity of identityStore.values()) {
    if (identity.protocols.some((p) => p.protocol === protocol && p.id === id)) {
      return identity;
    }
  }
  return undefined;
}

/**
 * Resolve a DegenFeed user by wallet address.
 */
export function resolveByWallet(walletAddress: string): LinkedIdentity | undefined {
  const lower = walletAddress.toLowerCase();
  for (const identity of identityStore.values()) {
    if (identity.walletAddress.toLowerCase() === lower) {
      return identity;
    }
  }
  return undefined;
}

/**
 * Resolve a DegenFeed user by any handle across protocols.
 */
export function resolveByHandle(
  protocol: Protocol,
  handle: string,
): LinkedIdentity | undefined {
  const normalized = handle.replace(/^@/, '').toLowerCase();
  for (const identity of identityStore.values()) {
    if (
      identity.protocols.some(
        (p) => p.protocol === protocol && p.handle.toLowerCase() === normalized,
      )
    ) {
      return identity;
    }
  }
  return undefined;
}

// ─── Identity discovery from mentions ────────────────────────────────────

/**
 * Given a text, extract mentions and attempt to resolve them
 * to DegenFeed identities. Returns resolved identities.
 */
export function resolveMentions(
  text: string,
  contextProtocol?: Protocol,
): Array<{ mention: string; identity?: LinkedIdentity; linked: boolean }> {
  const mentions = extractMentions(text, contextProtocol);
  return mentions.map((m) => {
    // Try resolving by handle first, then ID
    const byHandle = resolveByHandle(m.protocol, m.handle);
    const byId = resolveByIdentity(m.protocol, m.id);
    const identity = byHandle ?? byId;
    return {
      mention: m.raw,
      identity,
      linked: !!identity,
    };
  });
}

// ─── Cross-posting awareness ─────────────────────────────────────────────

/**
 * Check if content mentions any linked identities.
 * Used to trigger cross-protocol notifications when someone
 * interacts with cross-posted content.
 */
export function findLinkedIdentitiesInText(text: string): LinkedIdentity[] {
  const found = new Set<string>();
  const identities: LinkedIdentity[] = [];

  // Check for @mentions matching any linked handle
  for (const identity of identityStore.values()) {
    for (const proto of identity.protocols) {
      const handlePattern = new RegExp(
        `@${escapeRegex(proto.handle)}\\b`,
        'i',
      );
      if (handlePattern.test(text) && !found.has(identity.dfId)) {
        found.add(identity.dfId);
        identities.push(identity);
      }

      // Also check display name
      if (proto.displayName) {
        const namePattern = new RegExp(
          escapeRegex(proto.displayName),
          'i',
        );
        if (namePattern.test(text) && !found.has(identity.dfId)) {
          found.add(identity.dfId);
          identities.push(identity);
        }
      }
    }
  }

  return identities;
}

/**
 * Get all protocols a user is linked to.
 * Used to determine which protocols to cross-post to.
 */
export function getLinkedProtocols(dfId: string): Protocol[] {
  const identity = identityStore.get(dfId);
  if (!identity) return [];
  return identity.protocols.map((p) => p.protocol);
}

/**
 * Check if a user has a specific protocol linked.
 */
export function hasLinkedProtocol(dfId: string, protocol: Protocol): boolean {
  const identity = identityStore.get(dfId);
  if (!identity) return false;
  return identity.protocols.some((p) => p.protocol === protocol);
}

/**
 * Get the display info for a user across all linked protocols.
 */
export function getCrossProtocolDisplay(dfId: string): {
  primary: LinkedProtocolIdentity | undefined;
  allHandles: string[];
  protocolCount: number;
  alsoPostedOn: Protocol[];
} {
  const identity = identityStore.get(dfId);
  if (!identity) {
    return { primary: undefined, allHandles: [], protocolCount: 0, alsoPostedOn: [] };
  }

  const primary = identity.protocols[0];
  const allHandles = identity.protocols.map(
    (p) => `@${p.handle} (${p.protocol})`,
  );
  const alsoPostedOn = identity.protocols
    .filter((p) => p.protocol !== primary?.protocol)
    .map((p) => p.protocol);

  return { primary, allHandles, protocolCount: identity.protocols.length, alsoPostedOn };
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
