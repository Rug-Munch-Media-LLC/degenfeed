/**
 * @degenfeed/api-worker — Chat Delivery Status & Read Receipts
 */

import type { Env } from '../../index';
import { jsonResponse, noCacheJsonResponse } from '../../index';
import { requireSession } from '../../session';

/**
 * POST /api/messages/delivery/status — Get delivery status for one or more messages.
 */
export async function handleDeliveryStatus(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;

  let body: { conversationId: string; messageIds: string[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.conversationId || !body.messageIds?.length) {
    return jsonResponse({ error: 'conversationId and messageIds required' }, 400);
  }

  try {
    const { getConversationDeliveryStatus } = await import('../../lib/message-delivery');
    const statuses = await getConversationDeliveryStatus(env, body.conversationId, body.messageIds);
    return noCacheJsonResponse({ statuses });
  } catch {
    return jsonResponse({ error: 'Failed to get delivery status' }, 500);
  }
}

/**
 * POST /api/messages/delivery/read — Mark a message as read.
 */
export async function handleMarkRead(request: Request, env: Env): Promise<Response> {
  const session = await requireSession(request, env);
  if (session instanceof Response) return session;
  const userId = session.address.toLowerCase();

  let body: { messageId: string; conversationId: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.messageId || !body.conversationId) {
    return jsonResponse({ error: 'messageId and conversationId required' }, 400);
  }

  try {
    const { markMessageRead, notifyDeliveryWebhook } = await import('../../lib/message-delivery');
    const record = await markMessageRead(env, body.messageId, userId);
    if (record) {
      await notifyDeliveryWebhook(env, record);
    }
    return noCacheJsonResponse({ ok: true, status: record?.status ?? 'unknown' });
  } catch {
    return jsonResponse({ error: 'Failed to mark as read' }, 500);
  }
}
