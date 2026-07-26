/**
 * @degenfeed/api-worker — Social/Lemmy route registration
 *
 * Registers ALL Lemmy-related routes on the Hono app:
 *   - Registration & Auth
 *   - Community Management
 *   - Community Discovery (via existing routes)
 *   - Federation Management (admin)
 *   - Voting, Commenting, Following
 *
 * This is the centralized place where all /api/lemmy/* endpoints
 * are registered.
 */

import type { Hono } from 'hono';
import { jsonResponse } from '../../response-helpers';
import type { Env } from '../../types';

// ─── Import route handlers ─────────────────────────────────────────────

// Existing Lemmy routes
import {
