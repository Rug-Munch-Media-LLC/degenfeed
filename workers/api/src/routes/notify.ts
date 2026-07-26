/**
 * /api/notify — Landing page email subscription
 *
 * The landing page at degenfeed.xyz posts { email, source } to this
 * endpoint. Emails are stored in the SUBSCRIPTIONS KV namespace under
 * `notify:sub:<safeKey(email)>`. A Notion/Postmark integration can
 * then pull and send launch emails.
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import type { Env } from '../types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAILS = 10000;

function safeKey(s: string): string {
