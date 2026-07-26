/**
 * @degenfeed/api-worker — SSO Routes & Dashboard
 *
 * Single Sign-On across ALL self-hosted networks.
 * One wallet sign-in → auto-provisioned accounts on every protocol.
 *
 * Routes:
 *   POST   /api/sso/provision          — Provision all missing protocol accounts
 *   GET    /api/sso/dashboard           — Get account status across all protocols
 *   POST   /api/sso/session/create      — Create a cross-network session
 *   POST   /api/sso/session/verify      — Verify a cross-network session token
 *   POST   /api/sso/session/refresh     — Refresh the session TTL
 *   POST   /api/sso/session/revoke      — Revoke a specific session
 *   POST   /api/sso/session/revoke-all  — Revoke ALL sessions
 *   GET    /api/sso/activity            — Get cross-network activity feed
 *   POST   /api/sso/activity/record     — Record an activity event
 *   GET    /api/sso/export              — Export identity bundle
 *   POST   /api/sso/import              — Import identity bundle
 *   POST   /api/sso/recovery/generate   — Generate recovery code
 *   POST   /api/sso/recovery/restore    — Restore from recovery code
 *   GET    /api/sso/health              — Check health of all protocol instances
 *   POST   /api/sso/provision/:protocol — Provision a specific protocol account
 *
 * Authentication: All routes except /health require a valid session.
 */

import { log } from '../logger';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';
import {
