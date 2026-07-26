/**
 * /api/chat/preferences — Protocol Delivery Preferences
 *
 * Each user sets their preferred protocol for receiving DMs and group messages.
 * Messages are routed through Matrix and bridged to the user's preferred protocol.
 *
 * GET  /api/chat/preferences       — Get current preferences
 * PUT  /api/chat/preferences       — Update preferences
 * GET  /api/chat/preferences/resolve/:wallet  — Resolve best protocol for a user
 *
 * Protocol options:
 *   matrix    — Receive in Matrix client (DegenFeed chat)
 *   nostr     — Receive via NIP-17 encrypted DMs
 *   farcaster — Receive via direct cast / frame
 *   bluesky   — Receive via AT Protocol chat
 *   telegram  — Receive via Telegram bot
 *   signal    — Receive via Signal
 *   whatsapp  — Receive via WhatsApp
 *   irc       — Receive via IRC
 *   xmpp      — Receive via XMPP
 */

import { badRequest, jsonResponse, methodNotAllowed, noCacheJsonResponse, notFound, serverError } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

const VALID_PROTOCOLS = [
  'matrix',
  'nostr',
  'farcaster',
  'bluesky',
  'mastodon',
  'activitypub',
  'telegram',
  'discord',
  'irc',
  'xmpp',
  'signal',
  'whatsapp',
  'lens',
] as const;

type PrefProtocol = (typeof VALID_PROTOCOLS)[number];

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/preferences
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGetPreferences(request: Request, env: Env): Promise<Response> {
