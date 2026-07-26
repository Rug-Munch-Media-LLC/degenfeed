/**
 * moderation — Content moderation routes.
 *
 * Provides:
 *   - Report submission (from ReportModal)
 *   - Report listing / resolution / post removal (admin-only)
 *   - Cross-protocol user bans
 *   - Block/mute sync (existing, preserved)
 *
 * Admin access is gated by an ADMIN_WALLETS env var (comma-separated,
 * lowercase addresses).
 */

import { jsonResponse, methodNotAllowed, noCacheJsonResponse } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';

// ─── KV key helpers ───────────────────────────────────────────────────

function reportKey(id: string): string {
