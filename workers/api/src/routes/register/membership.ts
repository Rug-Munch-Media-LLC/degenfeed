/**
 * @degenfeed/api-worker — Membership & billing route registration
 *
 * Mounts the membership tier API (Hono sub-app) and the billing handlers
 * on the Hono app. Both modules previously shipped full implementations
 * but were never registered, so /api/membership/* and /api/billing/*
 * returned the catch-all 404.
 *
 * Routes mounted here:
 *   GET    /api/membership/tier               — current tier + status
 *   GET    /api/membership/features           — feature catalog w/ unlock state
 *   POST   /api/membership/upgrade            — upgrade tier (on-chain payment)
 *   GET    /api/membership/history            — payment history
 *   POST   /api/membership/cancel             — cancel subscription
 *   POST   /api/membership/verify-payment     — verify upgrade payment
 *   GET    /api/membership/protocols          — protocol catalog by tier
 *   GET    /api/membership/protocols/status   — user protocol dashboard
 *   GET    /api/membership/protocols/:id      — single protocol detail
 *   GET    /api/billing/checkout              — blink checkout URL
 *   POST   /api/billing/verify                — verify Solana tx
 *   GET    /api/billing/status                — subscription status
 *   POST   /api/billing/subscribe             — create platform subscription
 *   POST   /api/billing/cancel                — cancel platform subscription
 *   GET    /api/billing/my-status             — current user premium status
 */

import type { Hono } from 'hono';
import type { Env } from '../../types';
import {
  handleBillingCancel,
  handleBillingCheckout,
  handleBillingMyStatus,
  handleBillingStatus,
  handleBillingSubscribe,
  handleBillingVerify,
} from '../billing';
import membership from '../membership';

/**
 * Register membership + billing routes on the given Hono app.
 */
export function registerMembershipRoutes(app: Hono<{ Bindings: Env }>): void {
  // ─── Membership tier API (Hono sub-app) ─────────────────────
  app.route('/api/membership', membership);

  // ─── Billing ────────────────────────────────────────────────
  app.get('/api/billing/checkout', async (c) => handleBillingCheckout(c.req.raw, c.env));
  app.post('/api/billing/verify', async (c) => handleBillingVerify(c.req.raw, c.env));
  app.get('/api/billing/status', async (c) => handleBillingStatus(c.req.raw, c.env));
  app.post('/api/billing/subscribe', async (c) => handleBillingSubscribe(c.req.raw, c.env));
  app.post('/api/billing/cancel', async (c) => handleBillingCancel(c.req.raw, c.env));
  app.get('/api/billing/my-status', async (c) => handleBillingMyStatus(c.req.raw, c.env));
}
