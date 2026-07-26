/**
 * PWA Push Notification Worker
 *
 * Routes:
 *   POST /api/push/subscribe — store a push subscription in KV
 *   POST /api/push/send     — send a push to all subscribers (admin)
 *
 * VAPID keys (generate once):
 *   npx web-push generate-vapid-notes
 * Store in env: VAPID_SUBJECT (mailto:), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
 */
import { authenticateApiKey } from '../admin';
import { jsonResponse } from '../response-helpers';
import { validateBodySize } from '../sanitize';
import type { Env } from '../types';

type PushSubscription = {};
