/**
 * @degenfeed/api-worker — Cross-platform registration route
 *
 * POST /api/register-platform — Register the authenticated user on a social platform
 * GET  /api/register-platform/status — Get all registered platforms for current user
 * GET  /api/register-platform/bluesky-pool — Get Bluesky invite pool stats (admin)
 */

import {
