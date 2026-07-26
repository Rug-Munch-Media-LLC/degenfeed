/**
 * @degenfeed/api-worker — Cross-Post to Centralized Platforms (Dispatch)
 *
 * Publishes content to platforms we CAN'T fork: Medium, Substack, YouTube,
 * TikTok, Instagram, LinkedIn, Reddit, Pinterest.
 *
 * Dispatches to platform-specific handlers in cross-post-platforms.ts.
 * Types and limits are in cross-post-types.ts.
 *
 * All handlers require the user to have connected their account first via
 * the /api/accounts/connect/:platform flow.
 */

import { jsonResponse, methodNotAllowed } from '../response-helpers';
import { requireSession } from '../session';
import type { Env } from '../types';
import { getConnectedAccount } from './connected-accounts';
import type { CrossPostInput, CrossPostResult } from './cross-post-types';
import {
