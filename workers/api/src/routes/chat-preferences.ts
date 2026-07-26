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

import {
  badRequest,
  jsonResponse,
  methodNotAllowed,
  noCacheJsonResponse,
  notFound,
  serverError,
} from '../response-helpers';
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
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const { getProtocolPreferences } = await import('../lib/chat-matrix');

    const preferences = await getProtocolPreferences(env, session.address);

    return noCacheJsonResponse({
      ok: true,
      preferences: {
        primary: preferences.primary,
        fallback: preferences.fallback,
        enabled: preferences.enabled,
        autoDetect: preferences.autoDetect,
        updatedAt: preferences.updatedAt,
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to get preferences');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/chat/preferences
// ═══════════════════════════════════════════════════════════════════════════

export async function handleUpdatePreferences(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'PUT') return methodNotAllowed(['PUT']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: {
    primary?: string;
    fallback?: string;
    enabled?: string[];
    autoDetect?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest('Invalid JSON body');
  }

  // Validate protocol values
  const validateProtocol = (p: string): p is PrefProtocol =>
    VALID_PROTOCOLS.includes(p as PrefProtocol);

  if (body.primary && !validateProtocol(body.primary)) {
    return badRequest(`Invalid primary protocol. Valid: ${VALID_PROTOCOLS.join(', ')}`);
  }
  if (body.fallback && !validateProtocol(body.fallback)) {
    return badRequest(`Invalid fallback protocol. Valid: ${VALID_PROTOCOLS.join(', ')}`);
  }
  if (body.enabled) {
    for (const p of body.enabled) {
      if (!validateProtocol(p)) {
        return badRequest(
          `Invalid protocol in enabled list: ${p}. Valid: ${VALID_PROTOCOLS.join(', ')}`,
        );
      }
    }
  }

  // Validate primary and fallback are not the same
  if (body.primary && body.fallback && body.primary === body.fallback) {
    return badRequest('Primary and fallback protocols must be different');
  }

  try {
    const { setProtocolPreferences } = await import('../lib/chat-matrix');

    const preferences = await setProtocolPreferences(env, session.address, {
      ...(body.primary ? { primary: body.primary as PrefProtocol } : {}),
      ...(body.fallback ? { fallback: body.fallback as PrefProtocol } : {}),
      ...(body.enabled ? { enabled: body.enabled as PrefProtocol[] } : {}),
      ...(body.autoDetect !== undefined ? { autoDetect: body.autoDetect } : {}),
    });

    return noCacheJsonResponse({
      ok: true,
      preferences: {
        primary: preferences.primary,
        fallback: preferences.fallback,
        enabled: preferences.enabled,
        autoDetect: preferences.autoDetect,
        updatedAt: preferences.updatedAt,
      },
      message: `DMs will be delivered via ${preferences.primary}${preferences.autoDetect ? ' (auto-detect enabled)' : ''}`,
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to update preferences');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/chat/preferences/resolve/:wallet
// ═══════════════════════════════════════════════════════════════════════════

export async function handleResolveProtocol(
  request: Request,
  env: Env,
  walletAddress: string,
): Promise<Response> {
  if (request.method !== 'GET') return methodNotAllowed(['GET']);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  if (!walletAddress?.trim()) {
    return badRequest('Wallet address is required');
  }

  try {
    const { getProtocolPreferences, resolveBestProtocol } = await import('../lib/chat-matrix');

    const [bestProtocol, preferences] = await Promise.all([
      resolveBestProtocol(env, walletAddress),
      getProtocolPreferences(env, walletAddress),
    ]);

    return noCacheJsonResponse({
      ok: true,
      wallet: walletAddress.toLowerCase(),
      bestProtocol,
      preferences: {
        primary: preferences.primary,
        fallback: preferences.fallback,
        enabled: preferences.enabled,
        autoDetect: preferences.autoDetect,
      },
    });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Failed to resolve protocol');
  }
}
