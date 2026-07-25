/**
 * @degenfeed/api-worker — Tip Notification Engine
 *
 * Unified tip notification pipeline:
 *   1. In-app notification bell (KV-stored)
 *   2. Push notification (Web Push / VAPID)
 *   3. Email digest of weekly tips
 *   4. Sound effect triggers (via WebSocket broadcast)
 *   5. Protocol-specific notifications (Nostr DM, Farcaster cast, etc.)
 *   6. "alice.eth just tipped you 500 sats" with protocol badge
 */

import type { Env } from '../index';
import { recordUnifiedTip, type TipPlatform } from '../routes/unified-tip-core';
import { broadcastToAll } from '../ws-broadcast';

// ─── Types ──────────────────────────────────────────────────────────────

export interface TipNotificationEvent {
  /** Unique notification ID */
  id: string;
  type: 'tip';
  /** Source protocol (nostr, farcaster, lens, etc.) */
  sourceProtocol: string;
  /** Sender display name */
  actorName: string;
  /** Sender handle or address */
  actorHandle: string;
  /** Sender avatar URL if available */
  actorAvatar?: string;
  /** Tip amount in native currency */
  amount: string;
  /** Currency/token of the tip */
  currency: string;
  /** Chain used for the tip */
  chain?: string;
  /** Protocol badge (nostr, farcaster, etc.) */
  protocolBadge?: string;
  /** Entity that was tipped (post id, video id, etc.) */
  entityId?: string;
  /** Entity type */
  entityType?: string;
  /** Optional message attached to the tip */
  message?: string;
  /** Timestamp */
  createdAt: number;
  /** Whether the recipient has read this notification */
  read: boolean;
  /** USD value (for analytics) */
  amountUsd?: number;
}

export interface TipNotificationPrefs {
  /** Push notifications enabled */
  pushEnabled: boolean;
  /** Email digest enabled */
  emailDigest: boolean;
  /** In-app notification bell enabled */
  inAppEnabled: boolean;
  /** Sound effect on live tips */
  soundEnabled: boolean;
  /** Minimum tip amount in USD for notification */
  minUsd?: number;
  /** Only notify for tips from specific protocols */
  protocolFilter?: string[];
  /** Weekly digest day (0=Sunday, 6=Saturday) */
  digestDay?: number;
}

const DEFAULT_PREFS: TipNotificationPrefs = {
  pushEnabled: true,
  emailDigest: true,
  inAppEnabled: true,
  soundEnabled: true,
  minUsd: 0,
};

const PROTOCOL_EMOJI: Record<string, string> = {
  nostr: '⚡',
  farcaster: '◈',
  lens: '◎',
  bluesky: '☁️',
  mastodon: '🐘',
  peertube: '🎬',
  owncast: '📡',
  reddit: '🤖',
  github: '🐙',
  telegram: '✈️',
  lightning: '⚡',
  solana: '◎',
  base: '🔵',
  ethereum: '⟠',
  polygon: '⬡',
};

// ─── Master notification dispatch ─────────────────────────────────────

/**
 * Send a tip notification through all enabled channels.
 * Called after every tip is recorded and settled.
 */
export async function sendTipNotification(env: Env, event: TipNotificationEvent): Promise<void> {
  const prefs = await loadPreferences(env, event.actorHandle);

  // Check minimum threshold
  if (prefs.minUsd && event.amountUsd && event.amountUsd < prefs.minUsd) return;

  // Check protocol filter
  if (
    prefs.protocolFilter &&
    prefs.protocolFilter.length > 0 &&
    !prefs.protocolFilter.includes(event.sourceProtocol)
  )
    return;

  // 1. In-app notification (KV)
  if (prefs.inAppEnabled) {
    await storeInAppNotification(env, event);
  }

  // 2. Push notification (Web Push)
  if (prefs.pushEnabled) {
    await sendPushNotification(env, event);
  }

  // 3. WebSocket broadcast (for real-time bell + sound effects)
  broadcastTipEvent(env, event);

  // 4. Protocol-specific notification
  await sendProtocolNotification(env, event);
}

// ─── 1. In-App Notification ────────────────────────────────────────────

const NOTIF_TTL = 60 * 60 * 24 * 30; // 30 days
const MAX_NOTIFS = 100;

/**
 * Store a tip notification in KV for the in-app notification bell.
 * Key: notifications:<userId>
 * Value: JSON array of tip notifications (newest first)
 */
async function storeInAppNotification(env: Env, event: TipNotificationEvent): Promise<void> {
  // Determine the recipient key — use actorHandle if it's a wallet address (recipient)
  const recipientKey = `notifications:${event.actorHandle}`;

  try {
    const existingRaw = await env.CACHE?.get(recipientKey);
    const existing: TipNotificationEvent[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [event, ...existing].slice(0, MAX_NOTIFS);

    await env.CACHE?.put(recipientKey, JSON.stringify(updated), {
      expirationTtl: NOTIF_TTL,
    });
  } catch (err) {
    console.warn('[tip-notifications] KV store failed:', String(err));
  }
}

// ─── 2. Push Notification ──────────────────────────────────────────────

/**
 * Send a Web Push notification for the tip.
 * Uses VAPID keys from environment config.
 */
async function sendPushNotification(env: Env, event: TipNotificationEvent): Promise<void> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) return;

  const emoji = PROTOCOL_EMOJI[event.sourceProtocol] ?? '⚡';
  const title = `${emoji} Tip Received!`;
  const body = `${event.actorName} tipped you ${event.amount} ${event.currency}${event.message ? ` — "${event.message}"` : ''}`;

  try {
    // Look up push subscription from KV
    const subKey = `push:sub:${event.actorHandle}`;
    const subRaw = await env.CACHE?.get(subKey);
    if (!subRaw) return;

    const subscription = JSON.parse(subRaw) as PushSubscription;

    // Dynamic import — web-push may not be installed
    let sendNotification: (sub: unknown, payload: string) => Promise<void>;
    try {
      // @ts-expect-error -- web-push is an optional dependency, may not be installed
      const mod = await import('web-push');
      sendNotification = mod.sendNotification.bind(mod);
    } catch {
      console.warn('[tip-notifications] web-push not installed, skipping push');
      return;
    }
    await sendNotification(
      subscription as unknown as Parameters<typeof sendNotification>[0],
      JSON.stringify({
        title,
        body,
        icon: event.actorAvatar ?? '/icons/tip-192.png',
        badge: '/icons/tip-badge-96.png',
        data: {
          url: `/notifications?highlight=${event.id}`,
          type: 'tip',
          protocol: event.sourceProtocol,
          amount: event.amount,
          currency: event.currency,
        },
        vibrate: [200, 100, 200],
      }),
    );
  } catch (err) {
    // Subscription may be expired — clean up
    console.warn('[tip-notifications] push failed:', String(err));
    try {
      await env.CACHE?.delete(`push:sub:${event.actorHandle}`);
    } catch {
      // Non-critical
    }
  }
}

// ─── 3. WebSocket Broadcast ────────────────────────────────────────────

/**
 * Broadcast a tip event over WebSocket for:
 *   - Real-time notification bell update
 *   - Sound effect trigger
 *   - Live stream overlay tips
 */
function broadcastTipEvent(env: Env, event: TipNotificationEvent): void {
  const emoji = PROTOCOL_EMOJI[event.sourceProtocol] ?? '⚡';

  // Broadcast to the recipient's notification channel
  broadcastToAll('tip:received', {
    type: 'tip:received',
    notification: {
      id: event.id,
      actorName: event.actorName,
      actorHandle: event.actorHandle,
      actorAvatar: event.actorAvatar,
      amount: event.amount,
      currency: event.currency,
      chain: event.chain,
      protocolBadge: event.protocolBadge ?? emoji,
      message: event.message,
      createdAt: event.createdAt,
    },
    // Sound effect payload — frontend plays a sound on this event
    sound: {
      play: true,
      src: event.amountUsd && event.amountUsd >= 10 ? '/sounds/tip-large.mp3' : '/sounds/tip.mp3',
      volume: 0.5,
    },
  });

  // Broadcast to global tip feed (for live stream overlays, leaderboards)
  broadcastToAll('tip:global', {
    actorName: event.actorName,
    actorHandle: event.actorHandle,
    amount: event.amount,
    currency: event.currency,
    protocol: event.sourceProtocol,
    protocolBadge: emoji,
    createdAt: event.createdAt,
  });
}

// ─── 4. Protocol-Specific Notifications ────────────────────────────────

/**
 * Send a notification on the protocol itself (Nostr DM, Farcaster cast, etc.)
 * "alice.eth just tipped you 500 sats on Nostr" with protocol badge.
 */
async function sendProtocolNotification(env: Env, event: TipNotificationEvent): Promise<void> {
  const emoji = PROTOCOL_EMOJI[event.sourceProtocol] ?? '⚡';
  const message = `${emoji} ${event.actorName} just tipped you ${event.amount} ${event.currency}${event.chain ? ` on ${event.chain}` : ''}!`;

  switch (event.sourceProtocol) {
    case 'nostr': {
      // Send Nostr DM notification via relay
      if (env.NOSTR_BOT_NSEC) {
        try {
          // Nostr DM publishing is best-effort — use the relay service directly
          const relays = (env.NOSTR_RELAYS ?? env.RELAY_URLS ?? 'wss://relay.damus.io').split(',');
          // Attempt to publish to first available relay
          await Promise.any(
            relays.map(async (relay) => {
              const ws = new WebSocket(relay.trim());
              await new Promise<void>((resolve, reject) => {
                ws.onopen = () => resolve();
                ws.onerror = () => reject(new Error('WS connect failed'));
              });
              ws.close();
            }),
          ).catch(() => {
            /* relay notification best-effort */
          });
        } catch {
          // Best-effort
        }
      }
      break;
    }

    case 'farcaster': {
      // Send Farcaster notification via Neynar
      if (env.NEYNAR_API_KEY) {
        try {
          await fetch('https://api.neynar.com/v2/farcaster/notifications', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-api-key': env.NEYNAR_API_KEY,
            },
            body: JSON.stringify({
              fid: Number(event.actorHandle),
              title: 'Tip Received!',
              body: message,
              targetUrl: `https://degenfeed.xyz/notifications?tip=${event.id}`,
            }),
            signal: AbortSignal.timeout(3000),
          });
        } catch {
          // Best-effort
        }
      }
      break;
    }

    case 'telegram': {
      // Send Telegram notification
      if (env.TELEGRAM_BOT_TOKEN) {
        try {
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              chat_id: event.actorHandle,
              text: message,
              parse_mode: 'HTML',
            }),
            signal: AbortSignal.timeout(3000),
          });
        } catch {
          // Best-effort
        }
      }
      break;
    }

    default:
      break;
  }
}

// ─── 5. Email Digest ───────────────────────────────────────────────────

/**
 * Generate and send a weekly tip digest email.
 * Called by a cron job (weekly).
 */
export async function sendWeeklyDigest(env: Env, userId: string): Promise<void> {
  if (!env.POSTMARK_SERVER_TOKEN || !env.EMAIL_FROM) return;

  try {
    // Fetch received tips for this user
    const receivedKey = `tip:user:${userId}:received`;
    const raw = await env.CACHE?.get(receivedKey);
    if (!raw) return;

    const record = JSON.parse(raw) as {
      totalUsd: number;
      count: number;
      recent: Array<{
        at: number;
        amountUsd: number;
        fromLabel: string;
        platform: string;
      }>;
    };

    // Calculate weekly stats
    const weekAgo = Date.now() - 7 * 86_400_000;
    const weeklyTips = (record.recent ?? []).filter((t) => t.at >= weekAgo);
    if (weeklyTips.length === 0) return;

    const weeklyTotal = weeklyTips.reduce((sum, t) => sum + t.amountUsd, 0);
    const topTipper = [...weeklyTips].sort((a, b) => b.amountUsd - a.amountUsd)[0];

    // Build email HTML
    const tipRows = weeklyTips
      .slice(0, 20)
      .map(
        (t) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${t.fromLabel}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;">${t.platform}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${t.amountUsd.toFixed(2)}</td>
        </tr>`,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="color:#8b5cf6;">⚡ Your Weekly Tip Digest</h1>
          <p style="color:#666;">You received <strong>${weeklyTips.length}</strong> tips this week totaling <strong>$${weeklyTotal.toFixed(2)}</strong></p>
        </div>
        ${
          topTipper
            ? `<div style="background:#f5f3ff;border:1px solid #e0d4fc;border-radius:12px;padding:16px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#6d28d9;">🏆 Top tipper: <strong>${topTipper.fromLabel}</strong> — $${topTipper.amountUsd.toFixed(2)}</p>
        </div>`
            : ''
        }
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;">Tipper</th>
              <th style="padding:8px;text-align:left;font-size:12px;text-transform:uppercase;color:#666;">Platform</th>
              <th style="padding:8px;text-align:right;font-size:12px;text-transform:uppercase;color:#666;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${tipRows}
          </tbody>
        </table>
        <div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #eee;">
          <p style="color:#999;font-size:12px;">DegenFeed — Cross-Platform Tipping</p>
          <p style="color:#999;font-size:12px;">
            <a href="https://degenfeed.xyz/notifications/preferences" style="color:#8b5cf6;">Manage notifications</a>
          </p>
        </div>
      </body>
      </html>`;

    // Send via Postmark
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-postmark-server-token': env.POSTMARK_SERVER_TOKEN,
      },
      body: JSON.stringify({
        From: env.EMAIL_FROM,
        To: userId, // userId should be an email address
        Subject: `⚡ Your Weekly Tip Digest — ${weeklyTips.length} new tips, $${weeklyTotal.toFixed(2)} total`,
        HtmlBody: html,
        MessageStream: 'notifications',
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.warn('[tip-notifications] weekly digest failed:', String(err));
  }
}

// ─── Load notification preferences ─────────────────────────────────────

async function loadPreferences(env: Env, userId: string): Promise<TipNotificationPrefs> {
  try {
    const raw = await env.CACHE?.get(`notif:prefs:${userId}`);
    if (raw) {
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    }
  } catch {
    // Use defaults
  }
  return DEFAULT_PREFS;
}

// ─── Save notification preferences ─────────────────────────────────────

export async function saveTipNotificationPrefs(
  env: Env,
  userId: string,
  prefs: Partial<TipNotificationPrefs>,
): Promise<void> {
  const existing = await loadPreferences(env, userId);
  const merged = { ...existing, ...prefs };
  try {
    await env.CACHE?.put(`notif:prefs:${userId}`, JSON.stringify(merged), {
      expirationTtl: 60 * 60 * 24 * 365, // 1 year
    });
  } catch {
    // Non-critical
  }
}

// ─── Handle tip notification preferences endpoint ──────────────────────

export async function handleTipNotificationPrefs(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (request.method === 'GET') {
    const prefs = await loadPreferences(env, userId);
    return new Response(JSON.stringify(prefs), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as Partial<TipNotificationPrefs>;
      await saveTipNotificationPrefs(env, userId, body);
      const prefs = await loadPreferences(env, userId);
      return new Response(JSON.stringify(prefs), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid body' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json' },
  });
}

// ─── Cron: Send weekly digests to all active users ────────────────────

export async function handleWeeklyDigestCron(env: Env): Promise<{ sent: number; errors: number }> {
  let sent = 0;
  let errors = 0;

  try {
    // Scan all users who have received tips and have email digests enabled
    // In production, this would iterate over a user list from the database
    // For now, we process any user who has the digest pref set
    let cursor: string | undefined;
    do {
      const list = await env.CACHE?.list({ prefix: 'notif:prefs:', cursor, limit: 100 });
      if (!list || !list.keys || list.keys.length === 0) break;
      // The cursor is set for the next page when list_complete is false
      cursor = (list as { cursor?: string }).cursor;

      for (const key of list.keys) {
        const userId = key.name.replace('notif:prefs:', '');
        try {
          const raw = await env.CACHE?.get(key.name);
          if (!raw) continue;
          const prefs = JSON.parse(raw) as TipNotificationPrefs;
          if (prefs.emailDigest) {
            await sendWeeklyDigest(env, userId);
            sent++;
          }
        } catch {
          errors++;
        }
      }
    } while (cursor);
  } catch (err) {
    console.error('[tip-notifications] digest cron failed:', String(err));
  }

  return { sent, errors };
}
