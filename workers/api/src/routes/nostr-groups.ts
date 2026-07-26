/**
 * @degenfeed/api-worker — Nostr NIP-29 Groups API Routes
 *
 * Full NIP-29 group chat integration:
 *   - Group discovery across relays
 *   - Join/leave groups
 *   - Send/receive messages
 *   - Cross-protocol bridging to Matrix/IRC/XMPP
 *   - Unified chat integration
 *
 * Routes:
 *   GET  /api/nostr/groups           — Discover groups (with search, tags, relays)
 *   GET  /api/nostr/groups/:id       — Get group details
 *   POST /api/nostr/groups/join      — Join a group
 *   POST /api/nostr/groups/leave     — Leave a group
 *   POST /api/nostr/groups/message   — Send a message to a group
 *   GET  /api/nostr/groups/:id/messages  — Get messages from a group
 *   POST /api/nostr/groups/bridge    — Bridge group to cross-protocol chat
 *
 * Every provider integration has: error handling, rate limit tracking,
 * response validation, fallback. No silent failures. No unhandled API changes.
 */

import type { Nip29Group, Nip29GroupSearchResult } from '@degenfeed/nostr-sdk';
import { CrossProtocolGroupChat, getGroupChat } from '@degenfeed/realtime';
import { Hono } from 'hono';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Router ─────────────────────────────────────────────────────────────────

const nostrGroups = new Hono<{ Bindings: Env }>();

// ─── NIP-29 Relay URLs ─────────────────────────────────────────────────────

const DEFAULT_NIP29_RELAYS = [
  'wss://relay.groups.nip29.com',
  'wss://groups.nostr.com',
  'wss://nos.lol',
  'wss://relay.damus.io',
];

/**
 * Get the configured relays for NIP-29.
 */
function getRelays(env: Env): string[] {
