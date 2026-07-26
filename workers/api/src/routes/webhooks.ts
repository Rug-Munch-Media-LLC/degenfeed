/**
 * /api/webhooks — Webhook System
 *
 * Let users connect ANY external service via webhooks.
 * Supports configurable triggers and JSON POST delivery.
 *
 * Endpoints:
 *   POST   /api/webhooks/create    { name, url, triggers[], secret? }
 *   POST   /api/webhooks/test      { id }
 *   GET    /api/webhooks           → list user's webhooks
 *   DELETE /api/webhooks           { id }
 *   POST   /api/webhooks/trigger   { trigger, payload } (internal)
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

const VALID_TRIGGERS = new Set([
  'new_post',
  'new_follower',
  'new_tip',
  'stream_start',
  'coin_milestone',
  'mention',
]);

function safeKey(s: string): string {
