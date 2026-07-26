/**
 * /api/newsletter/subscriptions — Creator Newsletter Subscription System
 *
 * Tiered newsletter subscriptions for creators:
 *   Free tier      → Public posts
 *   Paid tier      → $5/mo — Premium content, early access
 *   Founding tier  → $25/mo — Everything + recognition
 *
 * Endpoints:
 *   POST   /api/newsletter/:id/subscribe       — Subscribe (free or paid)
 *   POST   /api/newsletter/:id/unsubscribe     — Unsubscribe
 *   GET    /api/newsletter/:id/subscribers     — Subscriber list (creator only)
 *   GET    /api/newsletter/my-subscriptions    — My subscriptions
 *   POST   /api/newsletter/:id/tier            — Create/update paid tier
 *   GET    /api/newsletter/:id/settings        — Get newsletter settings
 */

import { log } from '../logger';
import { jsonResponse } from '../response-helpers';
import { sanitizeString, validateBodySize } from '../sanitize';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── Types ─────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'paid' | 'founding';

export const TIER_PRICES: Record<
  Exclude<SubscriptionTier, 'free'>,
  { monthlyUsd: number; monthlyCents: number }
> = {
