/**
 * Nostr event creation, signing, and verification.
 *
 * Uses schnorr signatures via @noble/curves secp256k1.
 * Event format per NIP-01.
 */

import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface UnsignedEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

/** Generate a random secp256k1 secret key (32 bytes hex). */
export function generateSecretKey(): string {
  const sk = schnorr.utils.randomPrivateKey();
  return bytesToHex(sk);
}

/** Get the public key (32 bytes hex) from a secret key. */
export function getPublicKey(secretKey: string): string {
  const sk = hexToBytes(secretKey);
  const pk = schnorr.getPublicKey(sk);
  return bytesToHex(pk);
}

/** Compute the event id: sha256 of the serialized event. */
export function getEventHash(event: UnsignedEvent): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

/** Sign an event with the given secret key. Returns the full signed event. */
export function signEvent(event: UnsignedEvent, secretKey: string): NostrEvent {
  const id = getEventHash(event);
  const sk = hexToBytes(secretKey);
  const sig = schnorr.sign(hexToBytes(id), sk);
  return {
    ...event,
    id,
    sig: bytesToHex(sig),
  };
}

/** Verify an event's signature. */
export function verifyEvent(event: NostrEvent): boolean {
  try {
    const unsigned: UnsignedEvent = {
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
    };
    const id = getEventHash(unsigned);
    if (id !== event.id) return false;
    return schnorr.verify(
      hexToBytes(event.sig),
      hexToBytes(event.id),
      hexToBytes(event.pubkey),
    );
  } catch {
    return false;
  }
}

/** Serialize event to JSON string. */
export function serializeEvent(event: NostrEvent): string {
  return JSON.stringify(event);
}

/** Deserialize event from JSON. */
export function deserializeEvent(json: string): NostrEvent {
  return JSON.parse(json) as NostrEvent;
}

/**
 * Create a signed text note (kind 1).
 */
export function createTextNote(
  content: string,
  secretKey: string,
  tags: string[][] = [],
): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 1,
    tags,
    content,
  };
  return signEvent(unsigned, secretKey);
}

/**
 * Create a reaction event (kind 7).
 */
export function createReaction(
  content: '+' | '-' | string,
  reactedEventId: string,
  reactedPubkey: string,
  secretKey: string,
): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 7,
    tags: [
      ['e', reactedEventId],
      ['p', reactedPubkey],
    ],
    content,
  };
  return signEvent(unsigned, secretKey);
}

/**
 * Create a repost event (kind 6 — generic repost).
 */
export function createRepost(
  originalEvent: NostrEvent,
  secretKey: string,
): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 6,
    tags: [
      ['e', originalEvent.id],
      ['p', originalEvent.pubkey],
    ],
    content: JSON.stringify(originalEvent),
  };
  return signEvent(unsigned, secretKey);
}

/**
 * Create a deletion event (kind 5).
 */
export function createDeletion(
  eventIds: string[],
  reason: string,
  secretKey: string,
): NostrEvent {
  const pubkey = getPublicKey(secretKey);
  const unsigned: UnsignedEvent = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 5,
    tags: eventIds.map((id) => ['e', id]),
    content: reason,
  };
  return signEvent(unsigned, secretKey);
}
