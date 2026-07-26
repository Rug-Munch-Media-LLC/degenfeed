/**
 * /api/newsletter/creator — Creator-facing newsletter endpoints
 *
 * Handles sending newsletters, subscriber management, analytics,
 * and Mailgun webhook processing for DegenFeed's email distribution system.
 *
 * Endpoints:
 *   POST   /api/newsletter/creator/send           Send newsletter to subscribers
 *   GET    /api/newsletter/creator/subscribers     List subscribers for creator
 *   POST   /api/newsletter/creator/subscribe       Subscribe to creator
 *   DELETE /api/newsletter/creator/subscribe       Unsubscribe from creator
 *   GET    /api/newsletter/creator/stats/:postId   Newsletter analytics per post
 *   GET    /api/newsletter/creator/count           Subscriber count breakdown
 *   POST   /api/newsletter/creator/webhook/mailgun Mailgun event webhook
 *   GET    /api/newsletter/creator/health          EmailEngine health check
 */

import { EmailEngine, type EmailEngineConfig } from '../lib/email-engine';
import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

// ─── Helpers ─────────────────────────────────────────────────

function safeKey(s: string): string {
