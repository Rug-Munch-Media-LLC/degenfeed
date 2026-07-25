/**
 * telegram-auth — Telegram authentication and account linking.
 *
 * HMAC validation for Telegram Login Widget / Mini App init data,
 * auth route handler, and account linking/unlinking endpoints.
 *
 * Separated from telegram.ts during de-godding.
 */

import { type Env, jsonResponse } from '../index';
import { requireSession } from '../session';
import { type TelegramLinkedUser, telegramUserKey, telegramWalletIndex } from './telegram-bot';

// ─── HMAC validation helper ────────────────────────────────────────────────

/**
 * Validates Telegram Login Widget / Mini App init data.
 * Uses HMAC-SHA256 with the bot token as the secret.
 *
 * @param initData - Raw query string from Telegram (e.g., "query_id=...&hash=...")
 * @param botToken - Telegram bot token
 * @returns Whether the data is authentic
 */
export async function validateTelegramInitDataAsync(
  initData: string,
  botToken: string,
): Promise<boolean> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;

    params.delete('hash');

    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const encoder = new TextEncoder();

    const webAppKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode('WebAppData'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const secretKey = await crypto.subtle.sign('HMAC', webAppKey, encoder.encode(botToken));

    const secretCryptoKey = await crypto.subtle.importKey(
      'raw',
      secretKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );

    const computedHash = await crypto.subtle.sign('HMAC', secretCryptoKey, encoder.encode(sorted));
    const computedHashHex = Array.from(new Uint8Array(computedHash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return computedHashHex === hash;
  } catch (err) {
    console.error('[telegram] init data validation error:', err);
    return false;
  }
}

// ─── Telegram auth route ───────────────────────────────────────────────────

/**
 * POST /api/telegram/auth
 * Verifies Telegram Login Widget or Mini App init data and links to wallet.
 *
 * Body: { initData: string }
 */
export async function handleTelegramAuth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return jsonResponse({ error: 'Telegram bot not configured' }, 501);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { initData?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.initData) {
    return jsonResponse({ error: 'initData is required' }, 400);
  }

  const isValid = await validateTelegramInitDataAsync(body.initData, botToken);
  if (!isValid) {
    return jsonResponse({ error: 'Invalid Telegram authentication data' }, 403);
  }

  const params = new URLSearchParams(body.initData);
  const userRaw = params.get('user');
  if (!userRaw) {
    return jsonResponse({ error: 'No user data in init data' }, 400);
  }

  let tgUser: { id: number; username?: string; first_name?: string };
  try {
    tgUser = JSON.parse(userRaw) as typeof tgUser;
  } catch {
    return jsonResponse({ error: 'Invalid user data' }, 400);
  }

  const telegramId = String(tgUser.id);

  try {
    const existing = await env.CACHE?.get(telegramUserKey(telegramId));
    if (existing) {
      const user = JSON.parse(existing) as TelegramLinkedUser;
      if (user.wallet === session.address) {
        return jsonResponse({ ok: true, alreadyLinked: true, telegramId });
      }
    }

    const linkedUser: TelegramLinkedUser = {
      telegramId,
      wallet: session.address,
      username: tgUser.username,
      firstName: tgUser.first_name,
      linkedAt: Date.now(),
      preferences: {
        priceAlerts: true,
        mentionAlerts: true,
        feedAlerts: false,
        tipNotifications: true,
      },
    };

    await env.CACHE?.put(telegramUserKey(telegramId), JSON.stringify(linkedUser), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(telegramWalletIndex(session.address), telegramId, {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    return jsonResponse({
      ok: true,
      telegramId,
      username: tgUser.username,
      firstName: tgUser.first_name,
    });
  } catch {
    return jsonResponse({ error: 'Failed to link Telegram account' }, 500);
  }
}

// ─── Link Telegram account (OAuth-style) ────────────────────────────────────

/**
 * POST /api/telegram/link-account
 * Associates a Telegram user ID with the authenticated session wallet.
 */
export async function handleTelegramLinkAccount(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { telegramId?: string; username?: string; firstName?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  if (!body.telegramId) {
    return jsonResponse({ error: 'telegramId required' }, 400);
  }

  try {
    const user: TelegramLinkedUser = {
      telegramId: body.telegramId,
      wallet: session.address,
      username: body.username,
      firstName: body.firstName,
      linkedAt: Date.now(),
      preferences: {
        priceAlerts: true,
        mentionAlerts: true,
        feedAlerts: false,
        tipNotifications: true,
      },
    };

    await env.CACHE?.put(telegramUserKey(body.telegramId), JSON.stringify(user), {
      expirationTtl: 60 * 60 * 24 * 365,
    });
    await env.CACHE?.put(telegramWalletIndex(session.address), body.telegramId, {
      expirationTtl: 60 * 60 * 24 * 365,
    });

    return jsonResponse({ ok: true, telegramId: body.telegramId });
  } catch {
    return jsonResponse({ error: 'Failed to link account' }, 500);
  }
}

/**
 * GET /api/telegram/linked
 * Returns the Telegram account linked to the session wallet.
 */
export async function handleTelegramGetLinked(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const tgId = await env.CACHE?.get(telegramWalletIndex(session.address));
    if (!tgId) return jsonResponse({ linked: false });

    const raw = await env.CACHE?.get(telegramUserKey(tgId));
    if (!raw) return jsonResponse({ linked: false });

    const user = JSON.parse(raw) as TelegramLinkedUser;
    return jsonResponse({
      linked: true,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      linkedAt: user.linkedAt,
      preferences: user.preferences,
    });
  } catch {
    return jsonResponse({ linked: false, error: 'Failed to check' });
  }
}

/**
 * DELETE /api/telegram/link-account
 * Unlinks the Telegram account from the session wallet.
 */
export async function handleTelegramUnlinkAccount(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'DELETE') return jsonResponse({ error: 'Method not allowed' }, 405);

  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  try {
    const tgId = await env.CACHE?.get(telegramWalletIndex(session.address));
    if (tgId) {
      await env.CACHE?.delete(telegramUserKey(tgId));
      await env.CACHE?.delete(telegramWalletIndex(session.address));
    }
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'Failed to unlink' }, 500);
  }
}
