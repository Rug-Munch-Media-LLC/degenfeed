/**
 * @degenfeed/api-worker — Feddy Communities shared helpers
 *
 * Shared utilities extracted from the monolithic feddy-communities.ts.
 * Each split route file imports what it needs from here.
 */

import type { GtSClient } from '@degenfeed/mastodon-sdk';
import type { MemberRole } from '../lib/feddy-store';
import { getMemberRole } from '../lib/feddy-store';
import { jsonResponse } from '../response-helpers';
import { parseSessionCookie, requireSession, validateCsrfToken } from '../session';
import type { Env } from '../types';

// ─── GoToSocial Client ─────────────────────────────────────────

export function getGtsClient(env: Env, accessToken?: string): GtSClient {
