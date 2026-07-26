/**
 * @degenfeed/api-worker — Protocol-Agnostic Encrypted Message Transport
 *
 * Routes encrypted (or plaintext) messages through ANY protocol.
 * The encrypted blob is protocol-agnostic — we transport it through
 * whatever protocol the recipient prefers.
 *
 * Supported transports:
 *   1. Nostr   — NIP-04/NIP-17 encrypted DMs
 *   2. Matrix  — Encrypted room messages (Olm)
 *   3. Bluesky — AT Protocol chat (chat.bsky.conversation)
 *   4. Mastodon — Direct messages (with additional encryption layer)
 *   5. XMTP    — If available via XMTP network
 *   6. Direct WebSocket — Fallback via our realtime server
 *
 * The EncryptedPayload from the E2E layer is serialized as the message body,
 * so transport providers never see the plaintext.
 */

import type { Env } from '../types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TransportProtocol =
  | 'nostr'
  | 'matrix'
  | 'bluesky'
  | 'farcaster'
  | 'mastodon'
  | 'xmtp'
  | 'direct-ws';

export type TransportMessage = {};
