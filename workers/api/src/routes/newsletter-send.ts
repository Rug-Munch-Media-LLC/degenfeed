/**
 * /api/newsletter — Email Newsletter Send Integration
 *
 * Provide email sending capabilities via SendGrid, Mailgun, or SMTP.
 * Manages subscribers, drafts, and delivery.
 *
 * Endpoints:
 *   POST   /api/newsletter/send       { subject, htmlContent, textContent?, fromName?, replyTo? }
 *   GET    /api/newsletter/subscribers → list subscribers (admin)
 *   DELETE /api/newsletter/subscriber  { email }
 *   POST   /api/newsletter/draft       { subject, htmlContent, textContent? }
 *   POST   /api/newsletter/test        { subject, htmlContent, testEmails[] }
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import type { Env } from '../types';

function safeKey(s: string): string {
