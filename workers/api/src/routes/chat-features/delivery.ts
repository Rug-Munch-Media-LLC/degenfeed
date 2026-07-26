/**
 * @degenfeed/api-worker — Chat Delivery Status & Read Receipts
 */

import { jsonResponse, noCacheJsonResponse } from '../../response-helpers';
import { requireSession } from '../../session';
import type { Env } from '../../types';

/**
 * POST /api/messages/delivery/status — Get delivery status for one or more messages.
 */
export async function handleDeliveryStatus(request: Request, env: Env): Promise<Response> {
