/**
 * Bluesky Webhook Receiver
 *
 * Handles incoming webhooks from external services that integrate
 * with Bluesky (e.g., feed generators, moderation services).
 *
 * Also provides webhook delivery for Bluesky events to user-configured
 * webhook URLs (e.g., cross-posting, notifications).
 *
 * @module @degenfeed/bridge/bluesky-webhooks
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type http from 'node:http';

// ─── Types ───────────────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  created: number;
  data: Record<string, unknown>;
}

export type WebhookEventType =
  | 'bluesky.post.created'
  | 'bluesky.post.deleted'
  | 'bluesky.like.created'
  | 'bluesky.repost.created'
  | 'bluesky.follow.created'
  | 'bluesky.follow.deleted'
  | 'bluesky.block.created'
  | 'bluesky.profile.updated'
  | 'bluesky.account.migrated';

export interface WebhookSubscription {
  id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  createdAt: string;
  lastDelivery?: string;
  lastSuccess?: boolean;
}

// ─── In-Memory Store (replace with DB in production) ─────────────────

const webhookSubscriptions: Map<string, WebhookSubscription> = new Map();

// ─── Signature Verification ──────────────────────────────────────────

/**
 * Verify HMAC-SHA256 webhook signature.
 */
export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    const parts = signatureHeader.split(',');
    if (parts.length < 2) return false;

    const timestampPart = parts[0]!.trim();
    const sigPart = parts[1]!.trim();

    const timestamp = timestampPart.split('=')[1];
    const signature = sigPart.split('=')[1];

    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');

    // Constant-time comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature!));
  } catch {
    return false;
  }
}

// ─── Webhook Delivery ────────────────────────────────────────────────

/**
 * Deliver a webhook event to all subscribed endpoints.
 */
export async function deliverWebhookEvent(event: WebhookEvent): Promise<void> {
  const payload = JSON.stringify(event);
  const deliveries: Promise<void>[] = [];

  for (const sub of webhookSubscriptions.values()) {
    if (!sub.enabled) continue;
    if (!sub.events.includes(event.type)) continue;

    deliveries.push(
      deliverToEndpoint(sub, payload).catch((err) => {
        console.error(`[webhook] Delivery to ${sub.url} failed:`, err);
      }),
    );
  }

  await Promise.allSettled(deliveries);
}

async function deliverToEndpoint(sub: WebhookSubscription, payload: string): Promise<void> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', sub.secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  const signatureHeader = `t=${timestamp},v1=${signature}`;

  const res = await fetch(sub.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': signatureHeader,
      'user-agent': 'DegenFeed-Bluesky-Webhook/1.0',
    },
    body: payload,
    signal: AbortSignal.timeout(5000), // 5 second timeout
  });

  if (!res.ok) {
    throw new Error(`Webhook delivery failed with status ${res.status}`);
  }

  sub.lastDelivery = new Date().toISOString();
  sub.lastSuccess = true;
}

// ─── Webhook Subscription Management ─────────────────────────────────

export function registerWebhookSubscription(sub: WebhookSubscription): void {
  webhookSubscriptions.set(sub.id, sub);
}

export function removeWebhookSubscription(id: string): boolean {
  return webhookSubscriptions.delete(id);
}

export function getWebhookSubscription(id: string): WebhookSubscription | undefined {
  return webhookSubscriptions.get(id);
}

export function listWebhookSubscriptions(): WebhookSubscription[] {
  return Array.from(webhookSubscriptions.values());
}

// ─── Webhook API Route Handler ───────────────────────────────────────

export async function handleWebhookRoutes(
  path: string,
  method: string,
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<boolean> {
  if (!path.startsWith('/api/bluesky/webhooks')) return false;

  const jsonOk = (data: unknown) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  const jsonError = (status: number, code: string, message: string) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: { code, message } }));
  };

  const parseBody = (): Promise<Record<string, unknown>> => {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error('Invalid JSON'));
        }
      });
      req.on('error', reject);
    });
  };

  try {
    // GET /api/bluesky/webhooks — List all webhook subscriptions
    if (method === 'GET') {
      return jsonOk({ ok: true, data: { subscriptions: listWebhookSubscriptions() } }), true;
    }

    // POST /api/bluesky/webhooks — Register a new webhook subscription
    if (method === 'POST') {
      const body = await parseBody();
      const url = body.url as string;
      const secret = body.secret as string;
      const events = body.events as string[];
      const id =
        (body.id as string) || `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      if (!url || !secret || !events || !Array.isArray(events) || events.length === 0) {
        return jsonError(400, 'MISSING_FIELDS', 'url, secret, and events are required'), true;
      }

      const sub: WebhookSubscription = {
        id,
        url,
        secret,
        events: events as WebhookEventType[],
        enabled: true,
        createdAt: new Date().toISOString(),
      };

      registerWebhookSubscription(sub);
      return jsonOk({ ok: true, data: { id, url, events } }), true;
    }

    // DELETE /api/bluesky/webhooks?id=xxx — Remove a subscription
    if (method === 'DELETE') {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const id = url.searchParams.get('id');
      if (!id) {
        return jsonError(400, 'MISSING_ID', 'id query parameter is required'), true;
      }
      const removed = removeWebhookSubscription(id);
      return jsonOk({ ok: true, data: { removed } }), true;
    }
  } catch (err) {
    return jsonError(500, 'WEBHOOK_ERROR', (err as Error).message), true;
  }

  return false;
}
