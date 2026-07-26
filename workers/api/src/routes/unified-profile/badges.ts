/**
 * @degenfeed/api-worker — Unified Profile Badges
 *
 * Verification badges, attestations, and protocol verification levels.
 */

import { aggregateProfile } from '../../lib/profile-sync';
import { jsonResponse, noCacheJsonResponse } from '../response-helpers';
import type { Env } from '../types';

export async function handleProfileBadges(
  _request: Request,
  env: Env,
  wallet: string,
): Promise<Response> {
