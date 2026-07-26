/**
 * @degenfeed/api-worker — Lens Protocol route registration
 *
 * Registers all Lens Protocol ownership routes on the Hono app instance.
 * Routes are organized by domain:
 *   Auth/Registration  → /api/lens/auth*, /api/lens/register
 *   Publish/Engage      → /api/lens/publish*, /api/lens/react
 *   Profile/Followers   → /api/lens/profile*, /api/lens/followers*, /api/lens/follow*
 *   Feed                → /api/lens/feed*, /api/lens/publications*
 *   Data Export         → /api/lens/export*
 *
 * Every provider integration has error handling and rate limiting.
 * No silent failures. No paid API dependency.
 */

import type { Hono } from 'hono';
import { ok, serverError } from '../../response-helpers';
import { withSession } from '../../routes/route-registry';
import type { Env } from '../../types';

// ─── Auth & Registration ────────────────────────────────────────────────────

import {
