/** Shared utilities for the Telegram bot module. */

import type { Env } from '../../index';

export async function sendTelegramMessage(
  botToken: string, chatId: number, text: string,
  options?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: Record<string, unknown>; reply_to_message_id?: number },
): Promise<Response> {
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: options?.parse_mode ?? 'HTML' };
  if (options?.reply_markup) payload.reply_markup = options.reply_markup;
  if (options?.reply_to_message_id) payload.reply_to_message_id = options.reply_to_message_id;

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[telegram] sendMessage failed:', err.slice(0, 200));
    }
    return res;
  } catch (err) {
    console.error('[telegram] sendMessage error:', err);
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 502 });
  }
}

export async function sendTelegramChatAction(
  botToken: string, chatId: number, action: 'typing' | 'upload_photo' | 'find_location',
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch { /* best-effort */ }
}

export async function validateTelegramInitDataAsync(initData: string, botToken: string): Promise<boolean> {
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
    const webAppKey = await crypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const secretKey = await crypto.subtle.sign('HMAC', webAppKey, encoder.encode(botToken));
    const secretCryptoKey = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const computedHash = await crypto.subtle.sign('HMAC', secretCryptoKey, encoder.encode(sorted));
    const computedHashHex = Array.from(new Uint8Array(computedHash)).map((b) => b.toString(16).padStart(2, '0')).join('');

    return computedHashHex === hash;
  } catch (err) {
    console.error('[telegram] init data validation error:', err);
    return false;
  }
}
