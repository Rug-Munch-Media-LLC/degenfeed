/**
 * @degenfeed/api-worker — Newsletter Engine
 *
 * Handles free and paid newsletter distribution via email providers
 * (Mailgun / SendGrid), message template rendering, and cross-posting
 * summaries to all social protocols.
 */

import { GhostBridge, type GhostPost } from '@degenfeed/ghost-bridge';
import type { Protocol } from '@degenfeed/types';

// ─── Types ─────────────────────────────────────────────────────────

export type NewsletterConfig = {}
